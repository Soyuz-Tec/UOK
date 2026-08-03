from __future__ import annotations

import os
import re
from collections.abc import Mapping
from dataclasses import dataclass

from starlette.applications import Starlette
from starlette.datastructures import MutableHeaders
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send


DEFAULT_TRUSTED_HOSTS = ("127.0.0.1", "localhost", "testserver")
HOST_PATTERN = re.compile(r"^(?:\*\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$")
TRUE_VALUES = {"1", "true", "yes", "on"}
FALSE_VALUES = {"0", "false", "no", "off"}

APP_CONTENT_SECURITY_POLICY = "; ".join((
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "manifest-src 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
))

LOCAL_DOCS_CONTENT_SECURITY_POLICY = "; ".join((
    "default-src 'none'",
    "base-uri 'none'",
    "connect-src 'self'",
    "font-src 'self' data: https://cdn.jsdelivr.net",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https://fastapi.tiangolo.com",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
))


@dataclass(frozen=True)
class HttpSecuritySettings:
    trusted_hosts: tuple[str, ...]
    expose_api_docs: bool
    emit_hsts: bool


def _strict_flag(
    environment: Mapping[str, str],
    name: str,
    *,
    default: bool,
) -> bool:
    raw = environment.get(name)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in TRUE_VALUES:
        return True
    if value in FALSE_VALUES:
        return False
    raise RuntimeError(f"{name} must be a boolean value")


def _trusted_hosts(environment: Mapping[str, str]) -> tuple[str, ...]:
    raw = environment.get("UOK_TRUSTED_HOSTS")
    if raw is None:
        return DEFAULT_TRUSTED_HOSTS
    values = tuple(dict.fromkeys(
        value.strip().lower()
        for value in raw.split(",")
        if value.strip()
    ))
    if not values:
        raise RuntimeError("UOK_TRUSTED_HOSTS must contain at least one host")
    for value in values:
        if value == "*" or not HOST_PATTERN.fullmatch(value) or ".." in value:
            raise RuntimeError(
                "UOK_TRUSTED_HOSTS accepts only exact hostnames or leading "
                f"wildcard domains; invalid value: {value!r}"
            )
    return values


def build_http_security_settings(
    environment: Mapping[str, str] | None = None,
) -> HttpSecuritySettings:
    current = os.environ if environment is None else environment
    local_mode = _strict_flag(
        current,
        "UOK_ALLOW_INSECURE_LOCAL_DEFAULTS",
        default=False,
    )
    return HttpSecuritySettings(
        trusted_hosts=_trusted_hosts(current),
        expose_api_docs=_strict_flag(
            current,
            "UOK_EXPOSE_API_DOCS",
            default=local_mode,
        ),
        emit_hsts=_strict_flag(
            current,
            "UOK_HSTS",
            default=not local_mode,
        ),
    )


def fastapi_docs_urls(settings: HttpSecuritySettings) -> dict[str, str | None]:
    if settings.expose_api_docs:
        return {
            "docs_url": "/docs",
            "redoc_url": "/redoc",
            "openapi_url": "/openapi.json",
        }
    return {
        "docs_url": None,
        "redoc_url": None,
        "openapi_url": None,
    }


def response_security_headers(
    settings: HttpSecuritySettings,
    *,
    path: str,
    scheme: str,
) -> dict[str, str]:
    docs_response = (
        settings.expose_api_docs
        and (
            path == "/docs"
            or path.startswith("/docs/")
            or path == "/redoc"
            or path.startswith("/redoc/")
        )
    )
    headers = {
        "Content-Security-Policy": (
            LOCAL_DOCS_CONTENT_SECURITY_POLICY
            if docs_response
            else APP_CONTENT_SECURITY_POLICY
        ),
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-Permitted-Cross-Domain-Policies": "none",
    }
    if path.startswith("/api/auth/"):
        headers["Cache-Control"] = "no-store"
        headers["Pragma"] = "no-cache"
    if settings.emit_hsts and scheme == "https":
        headers["Strict-Transport-Security"] = "max-age=31536000"
    return headers


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, settings: HttpSecuritySettings) -> None:
        self.app = app
        self.settings = settings

    async def __call__(
        self,
        scope: Scope,
        receive: Receive,
        send: Send,
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_security_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                path = str(scope.get("path", ""))
                for name, value in response_security_headers(
                    self.settings,
                    path=path,
                    scheme=str(scope.get("scheme", "")),
                ).items():
                    headers.setdefault(name, value)
            await send(message)

        await self.app(scope, receive, send_with_security_headers)


def install_http_security(
    app: Starlette,
    settings: HttpSecuritySettings,
) -> None:
    async def unhandled_error_response(
        request: Request,
        _: Exception,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error"},
            headers=response_security_headers(
                settings,
                path=request.url.path,
                scheme=request.url.scheme,
            ),
        )

    app.add_exception_handler(Exception, unhandled_error_response)
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.trusted_hosts,
        www_redirect=False,
    )
    app.add_middleware(
        SecurityHeadersMiddleware,
        settings=settings,
    )


__all__ = [
    "HttpSecuritySettings",
    "SecurityHeadersMiddleware",
    "build_http_security_settings",
    "fastapi_docs_urls",
    "install_http_security",
    "response_security_headers",
]
