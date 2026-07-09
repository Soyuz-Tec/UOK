# UOK ASUH Test Events

**Status:** Mandatory local incident-drill standard.

**Current candidate:** `UOK-3.1.0-alpha.3`

ASUH means Application/System UOK Health for local candidate testing. It standardizes when UOK should create a local incident event and run a health-oriented verification drill.

ASUH is not a production monitoring platform. It is the local testing discipline used until UOK has a dedicated operations module or external monitoring integration.

## Event Types

| Event | Trigger | Required action |
|---|---|---|
| `asuh.manual` | Developer or tester explicitly requests a health drill | Run `AsuhTest` |
| `asuh.post-rebuild` | Podman stack is rebuilt or restarted for candidate testing | Run `Health`; run `Verify` if code or database changed |
| `asuh.pre-push` | Changes are about to be committed or pushed to GitHub | Run `GithubPreflight` and `Verify` |
| `asuh.pre-restore` | A database restore will be tested | Run `BackupDb` first |
| `asuh.post-restore` | A database restore completed | Run `Health`, candidate verifier, and module-specific workflow check |
| `asuh.verification-failure` | Any standardized check fails | Record incident reason, fix, and re-run failed gate |
| `asuh.boundary-drift` | Naming, module contract, or source-boundary issue is found | Stop expansion and fix the boundary before new work |
| `asuh.ui-regression` | UI build passes but visual or workflow behavior is wrong | Run frontend tests, rebuild, local browser or HTTP check, and update UI docs if policy changed |

## Manual Trigger

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AsuhTest -IncidentSeverity warning -IncidentReason "manual drill"
```

The script writes a local event record under:

```text
var/incidents/
```

That directory is ignored by Git.

## Suggested Local Schedule

Use Windows Task Scheduler or a manual checklist. Do not schedule destructive restore automatically.

| Cadence | Operation |
|---|---|
| Every active development day | `Audit` |
| Before GitHub push or PR | `GithubPreflight` then `Verify` |
| After any Podman rebuild | `Health` |
| After database migration work | `BackupDb`, `Rebuild`, `Verify` |
| Weekly during active candidate hardening | `BackupDb`, `Verify`, `AsuhTest` |
| Monthly or before major module expansion | Manual restore drill from a recent backup, then `Verify` |

Example Task Scheduler command for a non-destructive daily audit:

```powershell
schtasks /Create /TN "UOK Daily Audit" /SC DAILY /ST 18:00 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\vasan\OneDrive\Documents\UOK\scripts\uok_ops.ps1 -Action Audit"
```

Example weekly backup and ASUH drill:

```powershell
schtasks /Create /TN "UOK Weekly ASUH" /SC WEEKLY /D SUN /ST 18:30 /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\vasan\OneDrive\Documents\UOK\scripts\uok_ops.ps1 -Action AsuhTest -IncidentReason weekly-health-drill"
```

Review scheduled tasks before enabling them on a machine with limited CPU, memory, or battery constraints.

## Incident Record Fields

Local ASUH incident records should include:

- `type`
- `severity`
- `reason`
- `created_at`
- `base_url`
- command output in the terminal session or follow-up notes

If an incident exposes a reusable issue, update the relevant durable artifact:

- operations issue: `docs/operations/UOK_STANDARD_OPERATIONS.md`
- architecture issue: `docs/ARCHITECTURE.md` or `docs/architecture/*`
- UI policy issue: `docs/design/*`
- module issue: `docs/modules/<module-name>/*`
- CI issue: `.github/workflows/uok-ci.yml`

## Completion Standard

An ASUH incident drill is complete when:

- an incident event was written or the reason for skipping was recorded;
- `/health` was checked;
- the failed or relevant verification gate was run;
- remediation was applied or the remaining blocker was documented;
- local evidence stayed out of Git unless explicitly promoted.
