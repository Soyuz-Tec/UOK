from __future__ import annotations

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from uok.host.http_security import (
    build_http_security_settings,
    fastapi_docs_urls,
    install_http_security,
)


def security_test_app(environment: dict[str, str]) -> FastAPI:
    settings = build_http_security_settings(environment)
    app = FastAPI(**fastapi_docs_urls(settings))

    @app.get("/")
    def index() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/auth/login")
    def login() -> dict[str, str]:
        return {"access_token": "test-token"}

    @app.get("/unhandled-error")
    def unhandled_error() -> None:
        raise RuntimeError("private failure detail")

    install_http_security(app, settings)
    return app


def test_production_defaults_fail_closed() -> None:
    settings = build_http_security_settings({})

    assert settings.expose_api_docs is False
    assert settings.emit_hsts is True
    assert settings.trusted_hosts == ("127.0.0.1", "localhost", "testserver")

    with TestClient(security_test_app({})) as client:
        assert client.get("/docs").status_code == 404
        assert client.get("/redoc").status_code == 404
        assert client.get("/openapi.json").status_code == 404


def test_local_mode_preserves_api_docs_with_scoped_csp() -> None:
    app = security_test_app({"UOK_ALLOW_INSECURE_LOCAL_DEFAULTS": "1"})

    with TestClient(app) as client:
        docs = client.get("/docs")
        assert docs.status_code == 200
        assert "https://cdn.jsdelivr.net" in docs.headers["content-security-policy"]

        response = client.get("/")
        assert response.status_code == 200
        assert "https://cdn.jsdelivr.net" not in response.headers["content-security-policy"]
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["referrer-policy"] == "no-referrer"
        assert response.headers["permissions-policy"] == (
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        )
        assert "strict-transport-security" not in response.headers

        login = client.post("/api/auth/login")
        assert login.headers["cache-control"] == "no-store"
        assert login.headers["pragma"] == "no-cache"


def test_hsts_requires_trusted_asgi_https_scheme() -> None:
    app = security_test_app({})

    with TestClient(app) as http_client:
        spoofed = http_client.get("/", headers={"X-Forwarded-Proto": "https"})
        assert spoofed.status_code == 200
        assert "strict-transport-security" not in spoofed.headers

    with TestClient(app, base_url="https://testserver") as https_client:
        secure = https_client.get("/")
        assert secure.status_code == 200
        assert secure.headers["strict-transport-security"] == "max-age=31536000"


def test_trusted_hosts_reject_unconfigured_host_and_keep_headers() -> None:
    app = security_test_app({"UOK_TRUSTED_HOSTS": "uok.example.com"})

    with TestClient(app, base_url="http://uok.example.com") as client:
        accepted = client.get("/")
        assert accepted.status_code == 200

        rejected = client.get("/", headers={"Host": "attacker.example"})
        assert rejected.status_code == 400
        assert rejected.text == "Invalid host header"
        assert rejected.headers["x-content-type-options"] == "nosniff"
        assert rejected.headers["x-frame-options"] == "DENY"


def test_unhandled_errors_keep_security_headers_without_disclosure() -> None:
    app = security_test_app({})

    with TestClient(
        app,
        base_url="https://testserver",
        raise_server_exceptions=False,
    ) as client:
        response = client.get("/unhandled-error")

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal Server Error"}
    assert "private failure detail" not in response.text
    assert response.headers["content-security-policy"]
    assert response.headers["permissions-policy"]
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["x-permitted-cross-domain-policies"] == "none"
    assert response.headers["strict-transport-security"] == "max-age=31536000"


@pytest.mark.parametrize(
    ("name", "value"),
    (
        ("UOK_TRUSTED_HOSTS", "*"),
        ("UOK_TRUSTED_HOSTS", "https://uok.example.com"),
        ("UOK_TRUSTED_HOSTS", "uok.example.com:443"),
        ("UOK_EXPOSE_API_DOCS", "sometimes"),
        ("UOK_HSTS", "enabled"),
    ),
)
def test_security_configuration_rejects_unsafe_values(
    name: str,
    value: str,
) -> None:
    with pytest.raises(RuntimeError):
        build_http_security_settings({name: value})
