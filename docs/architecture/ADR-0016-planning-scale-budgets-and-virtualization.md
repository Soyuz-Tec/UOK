# ADR-0016: Planning Scale Budgets and Measured Virtualization

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Gate E requires explicit performance budgets for schedule reads, deterministic
validation, atomic batches, and a 500-row Gantt. The review decision register
permits row/timeline virtualization only after a measured breach and requires
alignment and accessibility proof. Unconditional virtualization would add
interaction complexity without evidence.

## Decision

Adopt the review guide budgets as executable thresholds:

- 500 tasks / 800 dependencies schedule read: p95 below 500 milliseconds;
- 2,000 tasks / 3,000 dependencies validation: p95 below 2 seconds;
- 100 task updates in one transaction: p95 below 2 seconds;
- 500-row Gantt: usable interaction below 2 seconds and no post-idle long task
  above 200 milliseconds.

The backend benchmark builds transaction-local fixtures and always rolls them
back. It records database, Python, platform, machine, processor, CPU count, all
samples, mean, maximum, and p95.

The official Chromium budget profile uses one worker. Functional scenarios may
run concurrently elsewhere, but synthetic browser contention is not included
inside the renderer budget.

The unwindowed Chromium baseline took 4,073.60 milliseconds, so the browser
budget was breached. Enable first-party row and timeline windowing only above
200 visible tasks. Use a shared row layout, 480-pixel overscan, synchronized
vertical scrolling, total-height spacers, `aria-rowcount`, and exact
`aria-rowindex` values. Schedules of 200 tasks or fewer retain the original
complete render path. No virtualization package is added.

## Consequences

- Backend work remains unchanged because its measured p95 values are well
  inside budget.
- A 500-task schedule mounts only the current overscanned grid/timeline window
  while preserving the full scroll range and stable row coordinates.
- Off-screen rows are created when scrolling or selection brings them into the
  window; keyboard and assistive-technology proof remains mandatory.
- Dependency calculation remains Python-authoritative and is not moved into
  the browser.
- Future threshold, overscan, horizontal/time-window virtualization, or lazy
  server paging changes require new measurement and regression evidence.

## Alternatives

- Rendering all 500 rows was rejected after the browser budget breach.
- Adding a third-party virtual-list package was rejected because the current
  fixed/variable row layout supports a small first-party implementation.
- Server pagination was deferred because it would break the current complete
  schedule/CPM contract and was not required by the measured backend profile.
- Virtualizing every schedule was rejected because it would add complexity to
  small schedules without a measured benefit.

## Validation

- deterministic window-boundary tests for small, initial, middle, and final
  row windows;
- full existing frontend and Chromium regression suites;
- 500-row Chromium trace with mounted row/task counts and long-task evidence;
- rollback-only SQLite and PostgreSQL benchmark profiles;
- explicit database readback proving zero persisted benchmark projects.
