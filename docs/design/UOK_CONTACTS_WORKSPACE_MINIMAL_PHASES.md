# UOK Contacts Workspace Minimal Design Plan

**Status:** Active phased implementation target.

**Reference mockup:** `docs/design/assets/contacts-workspace-minimal-reference.png`

This plan applies the mandatory UOK UI policy and Apple-informed HIG technical reference to the Contacts module. The goal is a clean, low-distraction workspace that keeps essential work visible and moves secondary work behind clear disclosure controls.

The current workspace pass also uses the user's Apple Contacts-style screenshots as visual references for interaction shape only. UOK must adopt the pattern principles, not the screenshot content or Apple assets:

- Split mode follows the List + Detail reference: searchable results, restrained selection, large identity in the detail area, and contact facts presented as simple rows with clear icons and labels. If a group/list-sidebar is present, it stays secondary to the List + Detail workflow.
- Table mode follows the list-view reference: dense rows, stable columns, compact initials, muted dividers, and selected rows that remain readable without decorative weight.
- Card mode follows the card-view reference: larger initial blocks, compact business facts, readable address/phone/email lines, and a grid that scans quickly without becoming decorative.
- Color usage remains governed by the adopted UOK UI policy. Screenshot colors are not a target; UOK uses neutral surfaces, semantic status colors only where needed, and token-driven light/dark/system appearance.

## Design Target

- Keep one calm primary command row: search, view mode, and New contact.
- Keep the split-view workspace stable: records on the primary side, selected contact detail on the secondary side.
- Hide advanced filters, review queue, import tools, and maintenance details until relevant.
- Preserve accessible names, visible focus, keyboard use, and light/dark/system appearance.
- Avoid Apple assets or Apple branding. Use UOK-owned tokens and licensed open-source icons.

## Phased Sections

1. Command and review area
   - Simplify the Contacts toolbar.
   - Keep search, view mode, and New contact visible.
   - Move filters into a compact disclosure.
   - Move review queue into a compact disclosure.

2. Results pane
   - Reduce table visual weight.
   - Improve selected row state and empty states.
   - Keep list, table, and cards aligned under one results contract.

3. Inspector pane
   - Reduce repeated badges and action density.
   - Group detail, activity, and relationships with clearer hierarchy.
   - Keep inline editing visible but quiet.

4. Data-entry flow
   - Make New contact and Edit contact forms progressive.
   - Keep minimum required fields first.
   - Move optional fields into clearly labeled sections.

5. Responsive and appearance pass
   - Verify wide desktop, desktop, tablet, and narrow browser widths.
   - Verify light, dark, and system appearance.
   - Confirm no overlap, clipped labels, or hidden critical actions.
   - Tune the contact workspace toward the reference List + Detail pattern: calm supporting navigation, searchable contact results, quiet alphabetical scanning, and a detail pane that prioritizes identity and readable contact facts.
   - Tune table and card modes so they are not duplicate presentations of the same data: table mode is dense operational review; card mode is quick visual browsing.

## Acceptance Check

Each phase must pass:

- React build.
- Unit tests.
- Source-size guardrail.
- Local UOK runtime smoke check on the active loopback port.
- Browser check for no console errors.
- Visual check against the reference mockup direction.

## Implementation Progress

- Phase 1 complete: command row, filters, and review queue were simplified into a minimal visible toolbar plus compact disclosures.
- Phase 2 complete: list, table, and card results now share quiet state labels, a consistent empty state, and clearer selected-record treatment.
- Phase 3 complete: inspector identity, state, and commands were simplified; secondary archive/purge commands moved into a compact Manage disclosure, and overview details now use a quieter list presentation.
- Phase 4 complete: create/edit forms now show essential contact fields first and move person, organization, website, address, and note fields into progressive disclosure sections while preserving validation and the minimum-any-field save rule.
- Phase 5 complete: Contacts now has distinct visual behavior for List + Detail, table, and card modes. Split mode is the primary low-distraction workflow, table mode is dense operational review, card mode is visual browsing, and all modes stay within UOK's token-based color policy.
- Phase 6 complete: default Contacts now removes diagnostic and secondary maintenance surfaces from the everyday workspace. The large workflow header, filter disclosure, review queue strip, CSV import utility, and global Last Result debug pane are no longer rendered in the Contacts flow.
- Phase 7 complete: filter functions are integrated into the search toolbar instead of a separate filter bar. Runtime search uses PostgreSQL-native full-text search when UOK is running on Postgres, with the Python search fallback retained for SQLite tests and non-Postgres workflows.
- Phase 8 complete: persistent Contacts groups are added as a quiet secondary rail and unified search filter. Result sectioning is labeled `Section by` so it does not conflict with persistent groups, and contact detail supports group add/remove actions without leaving the workspace.
