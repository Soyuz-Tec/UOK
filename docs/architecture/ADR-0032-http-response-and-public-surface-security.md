# ADR-0032: HTTP Response And Public Surface Security

**Status:** Accepted

**Implementation status:** Implemented

**Current candidate:** `UOK-3.1.0-alpha.3`

**Date:** 2026-07-24

## Context

The UOK host served the compiled same-origin React application and FastAPI API
without an explicit response-header policy or Host allowlist. FastAPI also
published Swagger UI, ReDoc, and the OpenAPI document in every environment.
The local candidate must keep those developer surfaces convenient, while an
unconfigured production-style process must fail closed.

UOK can be deployed directly over HTTPS or behind a trusted reverse proxy. The
application cannot safely infer which intermediaries are trusted from an
unvalidated `X-Forwarded-Proto` request header.

## Decision

The product-neutral Host owns one HTTP security layer under
`src/uok/host/http_security.py`.

- Every HTTP response receives a Content Security Policy, `nosniff`,
  deny-framing, no-referrer, restricted browser permissions, and a disabled
  cross-domain policy. The compiled SPA permits same-origin scripts and
  connections. Its existing React inline style attributes require
  `style-src 'unsafe-inline'`; scripts do not receive that exception.
- Authentication responses additionally receive `Cache-Control: no-store`
  and legacy-compatible `Pragma: no-cache` so bearer-token payloads are not
  retained by ordinary HTTP caches.
- Local Swagger UI and ReDoc receive a separate CSP limited to their existing
  jsDelivr assets. That relaxed policy is never needed when documentation
  routes are disabled.
- Swagger UI, ReDoc, and `/openapi.json` default to disabled. They default to
  enabled only when `UOK_ALLOW_INSECURE_LOCAL_DEFAULTS=1`, preserving the
  established disposable local profile. `UOK_EXPOSE_API_DOCS` provides an
  explicit boolean override.
- `TrustedHostMiddleware` accepts only `127.0.0.1`, `localhost`, and
  `testserver` by default. Production names must be supplied as a comma-
  separated `UOK_TRUSTED_HOSTS` allowlist. Exact names and leading wildcard
  domains are supported; an allow-all `*`, schemes, ports, paths, and empty
  lists fail at startup. Host-based `www` redirects are disabled.
- HSTS defaults on outside the insecure local profile and may be controlled
  with `UOK_HSTS`. It is emitted only when the ASGI request scheme is `https`.
  The middleware never interprets raw forwarding headers. A reverse proxy
  deployment must configure the ASGI server's trusted proxy addresses so the
  server, rather than application code, establishes the request scheme.
- Security-sensitive boolean configuration accepts only documented true and
  false values. Typos fail during application construction.

The generated OpenAPI contract remains available through `app.openapi()` for
build and drift checks even when the public HTTP route is disabled.

## Consequences

- A production deployment that does not declare its public hostname returns
  HTTP 400 instead of accepting arbitrary Host headers.
- Local Compose, container health checks, repository tests, and the browser
  target remain usable through loopback names without deployment changes.
- HTTPS deployments receive HSTS without accidentally setting it because an
  untrusted client spoofed `X-Forwarded-Proto`.
- The CSP materially reduces script, object, framing, and data-exfiltration
  surfaces while retaining the current same-origin SPA behavior.
- This decision does not provide external IAM, session revocation, database
  row-level security, TLS termination, or reverse-proxy trust configuration.
  Those remain separate production-hardening responsibilities.

## Alternatives Considered

- Keep FastAPI defaults in every environment. Rejected because it expands the
  unauthenticated production surface and provides no Host or response policy.
- Trust `X-Forwarded-Proto` directly in application middleware. Rejected
  because any client could trigger transport-security behavior unless the
  proxy source itself is authenticated.
- Use an allow-all trusted-host default. Rejected because it converts a
  security boundary into documentation only.
- Remove API documentation entirely. Rejected because local contract
  exploration remains useful and can be safely scoped to the local profile.

## Validation

Focused tests prove:

- production-safe and local-development documentation defaults;
- strict SPA headers and the scoped local documentation CSP;
- no-store handling for authentication responses;
- Host allowlisting and headers on rejected responses;
- HSTS on ASGI HTTPS only, including rejection of a spoofed forwarding header;
- non-disclosing unhandled HTTP 500 responses with the complete security-header policy;
- fail-fast handling of unsafe Host and boolean configuration.

Run:

```powershell
python -m pytest -q -p no:cacheprovider tests/test_http_security.py
python -m pytest -q -p no:cacheprovider tests/test_auth_security.py
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```
