# planning.core

`planning.core` is the optional UOK project planning capability module. It owns project schedules, task dependencies, task participant roles, planned/forecast/actual/deadline semantics, schedule validation, immutable revision/outbox evidence, Gantt read models, and module-local candidate verification.

It also owns the controlled Planning project lifecycle and separate finish
authority defined by ADR-0020: `end` remains a compatibility horizon,
`target_finish` is the exact commitment, and `calculated_finish` is persisted
from CPM v2. Migration 015 requires quiesced Planning writers and is not a
rolling-deploy or old-binary rollback boundary.

Planning's manifest replay guard runs only for an exact stored command request.
It permits visible and archived replay, supports allowlisted legacy result
shapes, and hides purged results without returning recovered project or command
identifiers. Mismatched idempotency-key reuse remains the kernel-owned `409`.

The runtime kernel provides auth, API composition, command logging, module lifecycle, and static asset serving. Schedule truth belongs in this module. Planning write failures use module-owned structured validation details while the kernel supplies stable permission, idempotency, precondition, and command-log correlation contracts. The Planning outbox is same-transaction persistence evidence only; no external dispatcher or delivery state is implemented.
