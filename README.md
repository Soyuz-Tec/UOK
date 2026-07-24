# UOK

**Version:** `3.1.0-alpha.3`

UOK is the short name for Unified Operating Kernel. This is the first real-development baseline rebuilt from the RC9 policies and lessons while removing active RC-era source history.

Architecture entry point: `docs/ARCHITECTURE.md`.

Documentation index: `docs/DOCUMENTATION_INDEX.md`.

Standard operations runbook: `docs/operations/UOK_STANDARD_OPERATIONS.md`.

GitHub engineering guardrails: `docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md`.

Internal engineering system: `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md`.

Code quality and technology audit standard: `docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md`.

GitHub is the shared source of truth for UOK code, documentation, tests, workflows, deployment definitions, and team synchronization. Local runtime state and local evidence remain disposable until deliberately promoted into versioned source.

## Key Discipline

- `apps.manager` is the only required starter module.
- Apps Manager lists and operates optional modules for system setup with minimal baseline load.
- `contacts.core` is the first optional module and is installed only when the user chooses it.
- Module runtime extension surfaces are manifest-declared. API routers, command handlers, command permissions, role grants, dashboard counts, baseline evidence providers, model exports, and candidate verifier scenarios now resolve from module-owned declarations.
- The React shell composes manifest-declared module UI through the generated catalog and `web/src/features/modules/moduleSurfaceRegistry.tsx`; this is compile-time composition, not runtime code loading from YAML.
- Domain and business capabilities are future separately installable modules, not hard-coded baseline features.
- One active initial migration baseline: `migrations/001_initial_baseline.sql`.
- Durable UI stack: React + TypeScript + Vite.
- Backend stack: Python + FastAPI + Pydantic + SQLAlchemy + PostgreSQL 18.

## Repository Map

| Path | Ownership |
|---|---|
| `src/uok` | Product-neutral FastAPI kernel, security, module composition, shared database primitives, and static serving. |
| `modules` | Installable module packages. Each module owns its manifest, backend, migrations, production UI, tests, and verifier assets where declared. |
| `web/src` | React workbench shell, navigation, shared controls and tokens, generated contracts, and compile-time module composition. Module-specific UI does not live here. |
| `tests` | Kernel, repository-policy, and cross-module contract tests. Module behavior and frontend tests stay in the owning module. |
| `migrations` | Shared initial baseline only; later capability schema changes belong to module-owned migrations. |
| `scripts` | Repeatable audits, generation, candidate verification, evidence, and operations tooling. |
| `deploy` | Local candidate deployment definitions. |
| `docs` | Architecture, ADRs, policies, module plans, design standards, and operations runbooks. |
| `.github` | CI, dependency automation, ownership, PR, and contributor guardrails. |

Start with `modules/README.md` for the module catalog and `web/README.md` for the shell-versus-module frontend boundary. The exact scheduling boundary remains: Python module service first, with React UI receiving validated schedule read models.

## Run Locally

```powershell
cd .\UOK
podman compose -p uok -f deploy\compose-local-18088.yaml up -d --build
```

On Windows, install and verify the supported user-scoped sign-in recovery after
the first successful build:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartInstall
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartVerify
```

Use `AutoStartStatus`, `AutoStartDisable`, `AutoStartEnable`, or
`AutoStartUninstall` for the managed lifecycle. The task starts after user
sign-in, never before login, and restores only the frozen no-build local
candidate. See `docs/operations/UOK_WINDOWS_PODMAN_AUTOSTART.md`.

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

Install the pinned developer tool layer before running repository checks. The container image
installs only `requirements.txt`; tests, HTTP verification clients, and dependency-audit tooling
stay in `requirements-dev.txt` and the aligned `pyproject.toml` `dev` extra.

```powershell
python -m pip install -r requirements-dev.txt
npm --prefix web ci
```

```powershell
python -m compileall -q src modules tests conftest.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate_isolated.ps1
```

Focused technology and code-quality audit:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

Standard wrapper:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

Dependency checks expected before GitHub publication:

```powershell
python -m pip_audit -r requirements-dev.txt
cd web
npm audit
```
