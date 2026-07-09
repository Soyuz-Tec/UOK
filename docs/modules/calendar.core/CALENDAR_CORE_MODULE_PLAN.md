# Calendar Core Module Plan

**Status:** Active module plan.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

`calendar.core` provides reusable organization calendars, events, recurrence, reminders, free/busy, availability, and iCalendar export for UOK modules. It is a shared capability module, not app-local scheduling code.

## Implemented UI Scope

- Traditional Calendar workspace with Month, Week, Day, and Agenda views.
- Calendar command bar with calendar selector, Today, previous/next navigation, view switching, New event, Refresh, and ICS export.
- Mini month picker and calendar list side panel.
- Visual event blocks on month and time-grid views.
- Event editor for create and update flows.
- Event fields for title, location, start/end, all-day, busy/free transparency, recurrence, recurrence-until, reminder minutes, participant name/email, and description.
- Event cancellation and restore actions.
- Free/busy count surfaced in the workspace summary.

## Backend Scope

- Calendar CRUD.
- Calendar event CRUD, cancellation, and restore.
- Participants on event creation.
- Reminders.
- Free/busy endpoint.
- ICS export.
- Safe RRULE validation and expansion for daily, weekly, monthly, and yearly recurrence.
- Organization-scoped data and permission-gated APIs.

## Boundaries

- `calendar.core` owns shared calendar records and availability services.
- `planning.core` may consume calendar availability and free/busy context, but Planning owns Gantt scheduling rules.
- External sync adapters such as Google Calendar, Microsoft Outlook, CalDAV, and ICS import remain future adapter work.

## Validation

Run:

```powershell
npm --prefix web test -- CalendarWorkspace calendarDates
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify -BaseUrl http://127.0.0.1:18088
```
