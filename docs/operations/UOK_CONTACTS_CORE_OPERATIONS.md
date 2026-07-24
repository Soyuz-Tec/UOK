# UOK Contacts Core Operations

**Status:** Mandatory runbook for Contacts verifier hygiene, legacy membership cleanup, backup, archive execution, and rollback.

**Scope:** Local or explicitly authorized UOK environments running PostgreSQL and the `contacts.core` module.

## Safety Model

Current Contacts candidate verification removes its temporary membership and archives its temporary group. This runbook handles both empty manual verifier groups and the older one-member shape left when the verifier archived its contact but retained the group membership.

The cleanup operation is deliberately narrow:

- dry run is the default and writes only a local JSON plan;
- the authenticated API limits candidates to groups visible to the cleanup operator;
- PostgreSQL evidence must show a manual group with the exact name `Operations Contacts <13-digit stamp>` and exact description `Candidate verification contact group.`;
- the same organization must contain the successful `CreateContactGroup` command with idempotency key `uok-contact-group-<stamp>`, exact request payload, and matching response group ID;
- the same organization must contain the matching `ContactGroupCreated` event whose payload contains the exact group name; actor metadata is allowed because current audited events add it;
- an empty candidate must have zero total and active API members and no database membership row;
- a legacy candidate must have exactly one database/API membership, zero active API members, and one exclusively grouped, archived, manually sourced person named `UOK Contact <same stamp>`;
- the legacy contact must have the exact successful verifier command chain: `CreateContact`, initial `AddContactsToGroup`, `RemoveContactFromGroup`, final `AddContactsToGroup`, and cleanup `ArchiveContact`, including expected idempotency keys, payloads, response IDs, and one-row outcomes;
- execution revalidates every planned ID before mutation;
- for a legacy candidate, execution uses `RemoveContactFromGroup`, proves the group is strictly empty through API/database reconciliation, then uses recoverable `ArchiveContactGroup` and verifies archived readback;
- the operation never issues mutating SQL and never deletes a group or contact.

A similar user-created name is insufficient. Missing, changed, inaccessible, generated, multiply grouped, active-member, stamp-mismatched, or incompletely audited groups fail closed.

## Prerequisites

1. Confirm the repository, branch, `BaseUrl`, and Podman project name.
2. Confirm the local API and PostgreSQL container refer to the same environment.
3. Use an operator with `contacts.read` and `contacts.manage` in the intended organization.
4. Supply the password only through the process environment. It is not written to plan/report artifacts:

```powershell
$env:UOK_CONTACTS_CLEANUP_PASSWORD = Read-Host "Contacts cleanup password"
```

Clear the variable when finished:

```powershell
Remove-Item Env:UOK_CONTACTS_CLEANUP_PASSWORD
```

## Step 1: Dry Run

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 `
  -Action ContactsVerifierGroupCleanup `
  -BaseUrl http://127.0.0.1:18088 `
  -ProjectName uok `
  -ContactsCleanupUsername ops
```

The action makes no data changes. It writes a v2 plan and SHA-256 under:

```text
var/operations/contacts/contacts_verifier_group_cleanup_<timestamp>.plan.json
```

Artifacts under `var/` are local-only and must not be committed. Review every candidate ID, name, creation timestamp, cleanup mode, command-log ID, and event ID. For `legacy_one_member`, also review the membership, party, and complete command-chain IDs. An empty plan is a successful no-op.

## Step 2: Create And Verify A Backup

Create a PostgreSQL custom-format dump immediately before execution:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 `
  -Action BackupDb `
  -BackupPath .\var\backups\postgres\contacts_cleanup_prearchive.dump
```

Confirm the file exists, is non-empty, and belongs to the intended environment. Keep it outside Git. The cleanup execution checks that the supplied backup path exists; the operator remains responsible for verifying its provenance and restore suitability.

## Step 3: Explicit Archive Execution

Use the exact reviewed dry-run plan and verified backup:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 `
  -Action ContactsVerifierGroupCleanup `
  -BaseUrl http://127.0.0.1:18088 `
  -ProjectName uok `
  -ContactsCleanupUsername ops `
  -ContactsCleanupPlanPath .\var\operations\contacts\<reviewed-plan>.plan.json `
  -BackupPath .\var\backups\postgres\contacts_cleanup_prearchive.dump `
  -ExecuteContactsCleanup `
  -ConfirmContactsCleanup
```

Execution requires all four controls: reviewed v2 plan, non-empty backup, `-ExecuteContactsCleanup`, and `-ConfirmContactsCleanup`. It first validates the whole plan, then rechecks each group immediately before any command. Legacy candidates have their one exact membership removed first; empty readback is mandatory before archive. An already archived exact candidate is reported as `already_archived`.

The local execution report records the plan, backup, IDs, and outcomes under `var/operations/contacts`. It contains no password or access token.

## Verification

After execution:

1. Open Contacts > Groups Manager and include archived groups.
2. Confirm each reported ID is archived and no normal group changed.
3. For legacy rows, confirm the reviewed verifier membership is absent while the archived verifier contact remains archived.
4. Confirm contacts and memberships outside the reviewed candidate set are unchanged.
5. Run the focused Contacts candidate verifier and relevant release gates.
6. Preserve the local plan/report long enough for review, then dispose of them under the organization's local evidence-retention policy.

## Rollback

Archive is recoverable and should be rolled back at group level whenever possible:

1. Open Groups Manager with the archived filter.
2. Select each affected group ID from the execution report.
3. Use **Restore group**, which invokes authorized, audited `RestoreContactGroup` behavior.
4. Recheck the group status. Historical verifier candidates should remain empty; use the reviewed plan's party ID only if an explicitly approved rollback also requires restoring its legacy membership.

An authorized operator may equivalently submit `RestoreContactGroup` through `/api/commands` with a unique idempotency key and the exact reported `group_id`.

Use full database restore only if separately approved recovery requires reverting more than the recoverable archive commands:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 `
  -Action RestoreDb `
  -BackupPath .\var\backups\postgres\contacts_cleanup_prearchive.dump `
  -ConfirmRestore
```

Database restore stops the API, replaces database state from the dump, restarts the API, and runs health verification. Do not use it casually against shared or non-disposable data.

## Failure Handling

- If dry run cannot authenticate, cannot reach PostgreSQL, or cannot reconcile API and audit evidence, fix the target/operator issue and rerun dry run.
- If a candidate changes after plan generation, rerun dry run and review a new plan; do not edit criteria or bypass revalidation.
- If execution stops after legacy membership removal but before archive, keep the plan/report and rerun the same plan: the exact group now qualifies through the empty path and can be archived safely.
- If execution stops after some groups archive, keep the output and report available, inspect archived state, then either rerun the same plan idempotently or restore the reported IDs.
- Never replace this workflow with a name-only SQL update, wildcard delete, or direct removal of command/event evidence.
