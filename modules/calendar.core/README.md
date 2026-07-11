# calendar.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`calendar.core` is the optional UOK calendar capability for organization calendars, events, recurrence, reminders, free-busy, availability, iCalendar export, and the Calendar workbench.

Backend and ORM ownership live under `modules/calendar.core/backend`; module migrations live under `modules/calendar.core/migrations`; production React and CSS live under `modules/calendar.core/web/src`; behavior and frontend tests live under `modules/calendar.core/tests`; candidate proof lives under `modules/calendar.core/verify`.

Planning may consume actor-visible availability context, but Planning-owned working calendars remain authoritative for schedule normalization, dependency propagation, and resource leveling.
