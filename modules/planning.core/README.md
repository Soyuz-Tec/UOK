# planning.core

`planning.core` is the optional UOK project planning capability module. It owns project schedules, task dependencies, schedule validation, Gantt read models, and module-local candidate verification.

The runtime kernel provides auth, API composition, command logging, module lifecycle, and static asset serving. Schedule truth belongs in this module. Planning write failures use module-owned structured validation details while the kernel supplies stable permission, idempotency, precondition, and command-log correlation contracts.
