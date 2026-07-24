# Contacts Core Verification

The Contacts entry verifier, support functions, and evidence checks are module-owned release assets. The entry script invokes its evidence internally and returns only its scenario result to the generic root verifier.

The current group scenario removes its temporary membership, reloads the exact
manual group's strong ETag, proves recoverable Delete and Restore through the
public lifecycle endpoints, then archives the group again with the restored
validator. That final archive is lifecycle evidence, not data-neutral cleanup:
the group remains recoverable. Full candidate verification therefore runs only
through `scripts/verify_uok_candidate_isolated.ps1`, which destroys the exact
GUID-labelled disposable PostgreSQL and file state after each pass.

Historical empty groups and exact one-member groups left by older verifier runs are handled only through `ContactsVerifierGroupCleanup` in `scripts/uok_ops.ps1`. The operation:

- defaults to a non-mutating dry run;
- intersects authorized API-visible groups with exact PostgreSQL command/event evidence;
- accepts only empty manual groups or the exact legacy shape named `Operations Contacts <13-digit stamp>` with the verifier description;
- requires matching group/contact stamps, an archived exclusively grouped verifier person, the complete successful command chain, create-event name containment, and API count reconciliation;
- removes the exact legacy membership and proves empty readback before archive;
- writes reviewable local-only artifacts under `var/operations/contacts`;
- requires an existing backup, the reviewed plan, and two explicit execution switches;
- uses recoverable `ArchiveContactGroup`, never mutating SQL or broad deletion.

The historical operation is a separately reviewed remediation and does not
replace disposable-state qualification for new candidate runs.

See `docs/operations/UOK_CONTACTS_CORE_OPERATIONS.md` for commands and rollback.
