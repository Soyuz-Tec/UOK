# ADR-0011: Planning Resource-Specific Calendar Correlation

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Planning previously compared every organization busy event with every task.
That produced unrelated warnings and could expose event context to actors whose
visible Planning resources did not identify the event participant. Gate C
requires free/busy evidence to follow the linked person or resource instead.

## Decision

`calendar.core` remains the owner of calendars, events, recurrence,
participants, visibility, and free/busy authorization. It exposes filtered
occurrence and free/busy facade reads for a bounded set of canonical Party IDs.

For each actor-visible Planning schedule:

- Planning derives a Party set per task from ready task participants and
  assigned resources whose canonical target is a ready Party;
- denied, missing, archived, or unavailable Party targets contribute no Party
  identity to the query;
- `calendar.core` returns only busy occurrences having a `party` participant in
  the authorized correlated set;
- Planning annotates each occurrence with the exact linked task IDs and emits a
  warning only when that occurrence overlaps one of those tasks;
- organization events without a linked Party, and Party events unrelated to a
  task, do not appear in Planning availability.

An authorized linked calendar change may change the actor-visible strong ETag
without incrementing the Planning revision. That is correct because the read
representation changed while the Planning aggregate did not.

Calendar evidence remains contextual. It never moves a task automatically.
Resource calendars under ADR-0010 remain hard capacity inputs; `calendar.core`
busy events remain warnings until an explicit approved scheduling workflow is
introduced.

## Consequences

- Two tasks assigned to different people receive only their own free/busy
  warnings.
- Private Party and event titles remain absent when the actor cannot resolve
  the Party through `contacts.core` policy.
- Planning availability can be empty and `ready` when there are no correlated
  Parties; this is different from provider `unavailable`.
- Gate E must measure and optimize participant occurrence lookup before large
  portfolio-scale claims.

## Alternatives

- Organization-wide overlap was rejected because it is noisy and not
  resource-specific.
- Copying event or participant records into Planning was rejected because it
  would duplicate identity, recurrence, privacy, and retention state.
- Correlating by participant email or display name was rejected because those
  values are mutable and not canonical identity.

## Validation

- two Party-linked resources with unrelated overlapping events;
- participant/resource task correlation and exact `task_ids` readback;
- unlinked event exclusion;
- private Party denial hides target identity, event title, and warning;
- linked event changes ETag without changing Planning revision;
- provider permission/lifecycle regressions, candidate proof, and full gates.
