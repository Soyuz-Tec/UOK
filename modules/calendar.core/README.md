# calendar.core

**Status:** Active optional capability module.

**Current candidate:** `UOK-3.1.0-alpha.3`

`calendar.core` is the optional UOK calendar capability for organization calendars, events, recurrence, persisted reminder definitions, free-busy-derived availability context, iCalendar export, and the Calendar workbench. Reminder dispatch, working-hour schedules, slot rules, and public booking are deliberately not claimed.

Timed iCalendar export preserves IANA-zone wall time with RFC 5545 `TZID` and bounded `VTIMEZONE` components. The pinned `icalendar` dependency is used only for that standards boundary; UOK remains authoritative for Calendar storage, recurrence, commands, and visibility.

Backend and ORM ownership live under `modules/calendar.core/backend`; module migrations live under `modules/calendar.core/migrations`; production React and CSS live under `modules/calendar.core/web/src`; behavior and frontend tests live under `modules/calendar.core/tests`; candidate proof lives under `modules/calendar.core/verify`.

Planning may consume actor-visible availability context, but Planning-owned working calendars remain authoritative for schedule normalization, dependency propagation, and resource leveling.
