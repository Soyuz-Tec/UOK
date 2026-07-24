# UOK Windows Podman Auto-Start

**Status:** Supported local-candidate operation.

**Current candidate:** `UOK-3.1.0-alpha.3`

This runbook defines the user-scoped Windows sign-in and periodic recovery path
for the local UOK Podman candidate. It prevents a Windows restart or a later
runtime stop from leaving the Podman WSL machine and UOK containers stopped.

This is an interactive-user watchdog, not a pre-login Windows service or a
production boot architecture. Rootless Podman machine identity, SSH keys, and
connections belong to the interactive user. Do not run this task as `SYSTEM`,
with a stored password, or at highest privilege.

## Recovery Flow

```text
Windows sign-in or repeating time trigger
  -> 30-second delayed sign-in recovery or periodic recovery (one minute by default)
  -> maintenance-disable check and exclusive lock
  -> validated named Podman machine and pinned connection
  -> start the machine only when the connection is unavailable
  -> start existing image-pinned UOK db/api containers when present
  -> frozen Compose fallback only when a container is missing
  -> PostgreSQL health plus UOK identity/version health verification
  -> bounded structured local log and exit status
```

The automatic path never builds, pulls, removes, prunes, recreates an existing
service container, deletes an existing volume or Podman machine, restores a
database, or stops unrelated containers. The frozen fallback can create a
missing UOK service container and its required local network or volume.

## Prerequisites

Before installation:

1. Install Podman and initialize the intended user-scoped machine.
2. Install one supported Compose provider. `podman-compose` is preferred; Docker
   Compose is accepted when it is the available verified provider.
3. Run `Rebuild` at least once so the expected API and PostgreSQL images exist.
4. Confirm `http://127.0.0.1:18088/health` returns the expected UOK candidate.

The installer refuses a missing machine, connection, image, provider, or a
same-named foreign Scheduled Task.

## Install

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartInstall
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartVerify
```

Installation is idempotent. It creates one owned task under `\UOK\`, running as
the current interactive user with:

- a 30-second sign-in delay;
- a repeating recovery trigger every minute by default;
- limited privilege and no stored password;
- `MultipleInstances=IgnoreNew`;
- three one-minute failure retries;
- a 15-minute execution limit;
- battery execution and `StartWhenAvailable` enabled.

Set a reviewed interval from 1 through 1440 minutes when installing:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartInstall -CheckIntervalMinutes 5
```

The first periodic run is scheduled one minute after installation. Later runs
use the configured interval. The interval and exact UTC start boundary are
recorded in the frozen release configuration, and the interval is retained by
automatic payload refreshes. The exact task definition check requires one named
logon trigger and one named, unbounded time trigger with the recorded start
boundary and interval; missing, additional, disabled, malformed, or drifted
triggers invalidate the managed task.

The stable ownership marker is `uok.windows-autostart.v1`. A foreign task with
the same name is never overwritten or removed. A known earlier UOK prototype
task is migrated only after the managed task passes definition readback.

## Frozen Payload

Installation stages the worker, Compose definition, no-pull override, and
credential-free database-capacity environment as an immutable release under:

```text
%LOCALAPPDATA%\UOK\startup\releases\<release-id>\
```

The generated configuration records the source commit and whether its working
tree was clean or dirty, UOK version, periodic start boundary, check interval,
Podman machine and connection, Podman and Compose-provider paths, expected image
IDs, payload paths, and SHA-256 hashes. It does not contain passwords, tokens,
database URLs, or environment values.

Using a frozen payload prevents sign-in recovery from reading a partially
hydrated OneDrive worktree or reconciling containers from an unreviewed branch.
Install or refresh validates a complete versioned release before switching the
task, so a failed refresh leaves the previous task payload intact and an active
worker can finish from its original release. The `Rebuild` operation refreshes
the task after a new local image is proven healthy and within the
database-capacity budget.

## Status And Verification

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartStatus
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartVerify
```

`AutoStartStatus` is read-only. It reports ownership, task state, last result,
payload integrity, maintenance mode, source commit, check interval, and
configuration path. It does not start Podman or UOK.

`AutoStartVerify` refuses maintenance-disabled, drifted, or hash-invalid state;
starts the exact managed Scheduled Task; waits up to its bounded execution
window for a new run; and requires task result `0` plus HTTP health with the
configured UOK name and version. A controlled recovery test may stop only the
UOK API and database containers before running verification. Do not stop the
shared Podman machine when unrelated local projects are active.

Structured, sanitized JSON Lines logs are stored at:

```text
%LOCALAPPDATA%\UOK\logs\podman-autostart.jsonl
```

The current log rotates at 2 MiB to one `.previous` file. Native command output
is recorded only for diagnostics and redacts common credential forms.

## Maintenance Disable

Use the disable marker when an intentional maintenance stop must survive the
next sign-in and periodic check:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartDisable
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartEnable
```

Disable leaves the task, payload, containers, images, volumes, data, and logs in
place. The worker exits successfully without starting Podman or UOK until the
marker is removed with `AutoStartEnable`.

## Uninstall And Rollback

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action AutoStartUninstall
```

The wrapper supplies the explicit uninstall confirmation to the owned operation.
Uninstall removes only the owned task and installed worker/configuration payload.
It leaves Podman, other projects, UOK containers, images, volumes, PostgreSQL
data, restart policies, and logs unchanged. Direct invocation of
`scripts/uok_autostart_ops.ps1 -Action Uninstall` additionally requires
`-ConfirmUninstall`.

## Reboot Acceptance

The final cold-path acceptance check is:

1. Save unrelated work and restart Windows.
2. Sign in as the user who installed the task.
3. Allow the 30-second delay and bounded recovery time.
4. Run `AutoStartStatus` and require last result `0`.
5. Require the Podman machine running, PostgreSQL healthy, API running on
   `127.0.0.1:18088`, and `/health` returning the configured UOK identity.

After this cold-path check, a controlled API-container stop may be used to prove
the periodic path recovers UOK within the configured interval plus the bounded
worker duration. If the task fails, keep the JSONL log, correct the nearest
machine, connection, provider, image, payload-integrity, container-label, task
trigger, or health issue, reinstall when the image/provider contract changed,
then run `AutoStartVerify` again.
