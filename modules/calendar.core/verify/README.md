# Calendar Core Verification

`UokCandidateCalendar.ps1` verifies Calendar installation, permissions, event creation, recurrence, and readback as the manifest-declared candidate scenario.

The scenario intentionally exercises a real Calendar aggregate. It is therefore
run only through `scripts/verify_uok_candidate_isolated.ps1`, which destroys the
GUID-labelled disposable PostgreSQL and file state after each pass. Recoverable
Calendar Delete is product lifecycle behavior, not candidate cleanup, and the
raw module verifier refuses persistent targets.
