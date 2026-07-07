# UOK Contact Business Intelligence Profiles

**Target:** `UOK-3.1.0-alpha.3`

**Status:** Draft architecture guidance for the Contacts capability module.

## Purpose

This document defines how UOK should represent contact business intelligence profiles without turning them into a second source of truth.

A business intelligence profile is a derived, read-only view of a contact party that summarizes the signals needed for operational screening, account review, relationship mapping, and future enrichment workflows.

## Scope

The profile layer applies to the `contacts.core` module and any later module that consumes contact-derived intelligence. It does not introduce a new kernel-owned business object.

Profiles are derived from existing contacts data:

- `Party`
- `PartyNote`
- `PartyRelationship`
- `ContactGroup`
- `ContactGroupMember`
- `ContactImportBatch`

## Profile Contract

Each profile should answer the following questions for a single party:

- What kind of party is this?
- Which organization is this party associated with?
- Which groups does the party belong to?
- What recent notes or relationship signals exist?
- Does the record look complete, imported, or still in review?
- Which business-domain grouping or enrichment signals are available?

The profile may include:

- party identity and display name
- party type and status
- review state
- owner and team readiness fields
- primary organization signal
- group membership summary
- relationship summary
- note summary
- import provenance summary
- derived tags or flags

The profile must remain derived from authoritative records. It must not replace the underlying `Party` row or duplicate editable business facts as a new source of truth.

## Data Sources

The following signals are available today and should be treated as authoritative inputs for profile derivation:

- party fields and contact attributes
- contact notes and note chronology
- contact relationships and related-party labels
- group membership and business-domain group placement
- review queue state and import provenance
- duplicate-candidate evidence

The current Contacts implementation already exposes read-model search, review queue, group membership, and relationship surfaces. A profile layer should build on those records rather than bypass them.

## Ownership And Storage

Profile derivation belongs to `contacts.core`.

If future work introduces a cache, projection, or export format for profiles, that storage must remain module-owned and module-migrated. The runtime kernel should only provide the generic runtime, auth, persistence, and API composition primitives.

The kernel must not hard-code contact-specific intelligence rules.

## Refresh Rules

Profiles should refresh when the underlying party, note, relationship, group, or import evidence changes.

Good refresh triggers include:

- create or update a party
- add or edit a note
- link, update, or remove a relationship
- add or remove group membership
- import CSV rows or resolve review queue items
- archive, restore, or purge a party

The profile layer should tolerate incomplete data. It should surface missing or conflicting evidence instead of silently collapsing it.

## Consumption Rules

Profile data may be consumed by:

- Contacts workspace views
- review and triage workflows
- dashboard counts or evidence fragments
- future reporting or export endpoints

The profile layer must not force the UI into a single presentation style. It should support list, table, card, and detail-oriented consumption patterns.

## Non-Goals

This document does not:

- define a new global customer master record
- move contact ownership into the kernel
- add product-specific CRM, sales, or accounting behavior to UOK core
- require separate persistence before the module has a clear read-model need
- change the current module-manifest extension contract

## Validation Guidance

When profile work is implemented, verify that:

- profiles are derived from module-owned data
- missing facts remain visible
- review state and duplicate evidence stay aligned with the underlying records
- search, group, and relationship filters still behave through the Contacts read model
- no profile-only table becomes a hidden source of truth

If a future implementation needs persistence, add a module-owned migration, update the contacts plan, and document the storage boundary before shipping the change.
