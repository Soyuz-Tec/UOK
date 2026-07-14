# Contacts Core Verification

The Contacts entry verifier, support functions, and evidence checks are module-owned release assets. The entry script invokes its evidence internally and returns only its scenario result to the generic root verifier.

The current group scenario is self-cleaning: it removes its temporary membership and recoverably archives the exact manual group it created. Its group name, description, command idempotency key, creation event, and cleanup keys are deterministic enough to support audit verification without treating a user-created group as verifier data.

Historical empty groups and exact one-member groups left by older verifier runs are handled only through `ContactsVerifierGroupCleanup` in `scripts/uok_ops.ps1`. The operation:

- defaults to a non-mutating dry run;
- intersects authorized API-visible groups with exact PostgreSQL command/event evidence;
- accepts only empty manual groups or the exact legacy shape named `Operations Contacts <13-digit stamp>` with the verifier description;
- requires matching group/contact stamps, an archived exclusively grouped verifier person, the complete successful command chain, create-event name containment, and API count reconciliation;
- removes the exact legacy membership and proves empty readback before archive;
- writes reviewable local-only artifacts under `var/operations/contacts`;
- requires an existing backup, the reviewed plan, and two explicit execution switches;
- uses recoverable `ArchiveContactGroup`, never mutating SQL or broad deletion.

See `docs/operations/UOK_CONTACTS_CORE_OPERATIONS.md` for commands and rollback.
