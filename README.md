# UOK

**Version:** `3.1.0-alpha.2`

UOK is the short name for Unified Operating Kernel. This is the first real-development baseline rebuilt from the RC9 policies and lessons while removing active RC-era source history.

## Key Discipline

- `apps.manager` is the only required starter module.
- Apps Manager lists and operates optional modules for system setup with minimal baseline load.
- `contacts.core` is the first optional module and is installed only when the user chooses it.
- Domain and business capabilities are future separately installable modules, not hard-coded baseline features.
- One active initial migration baseline: `migrations/001_initial_baseline.sql`.
- Durable UI stack: React + TypeScript + Vite.
- Backend stack: Python + FastAPI + Pydantic + SQLAlchemy + PostgreSQL 18.

## Run Locally

```powershell
cd C:\Users\vasan\OneDrive\Documents\UOK
podman compose -p uok -f deploy\compose-local-18088.yaml up -d --build
```

Open:

```text
http://127.0.0.1:18088/
```

Default login:

```text
admin / admin
```

These credentials are only enabled by the local compose profile. The container image does not enable demo seeding, schema creation, self-registration, or weak secrets by default.

## Runtime Gates

- Set `UOK_SECRET` to a deployment-specific value of at least 32 characters before issuing tokens outside local testing.
- Use `UOK_ALLOW_INSECURE_LOCAL_DEFAULTS=1` only for disposable local testing.
- Keep `UOK_AUTO_CREATE_SCHEMA=0` in production-like environments and apply audited migrations instead.
- Keep `UOK_SEED_LOCAL_DATA=0` unless explicitly creating a local sandbox.
- Keep `UOK_SELF_REGISTRATION=0` unless the deployment intentionally allows user self-registration.
- Demo user passwords must be supplied through `UOK_DEMO_*_PASSWORD` variables when local defaults are not allowed.

## Verify

```powershell
python -m compileall -q src
python -m pytest -q
cd web
npm run test
npm run build:static
cd ..
powershell -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Dependency checks expected before GitHub publication:

```powershell
python -m pip_audit -r requirements.txt
cd web
npm audit
```
