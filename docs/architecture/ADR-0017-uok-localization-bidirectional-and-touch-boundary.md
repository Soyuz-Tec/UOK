# ADR-0017: UOK Localization, Bidirectional, and Touch Boundary

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Gate E requires Planning localization and RTL support, but the review package
explicitly forbids a Planning-only internationalization framework. The same
slice must close keyboard navigation across virtual windows, coarse-pointer
targets, narrow reflow, enlarged text, and representative accessibility proof.

## Decision

UOK owns one shared locale registry and React localization provider. The
provider supplies locale, text direction, translation with English fallback,
and locale-aware date/number formatting. Workbench preferences persist the
selected locale and set the document `lang`, `dir`, and `data-locale`
attributes. The initial reviewed locales are `en-US` and Arabic `ar`; Arabic
number formatting explicitly uses the Arabic numbering system.

Shell navigation, account controls, and representative Planning Gantt labels
consume the shared provider. Planning does not own a translation registry.
Layout uses CSS logical properties for start/end placement and pinned columns.
The chronological timeline remains an explicitly LTR-isolated data surface
inside an RTL workspace so dates and dependency geometry are not mirrored or
text-reflected accidentally.

Coarse-pointer CSS raises primary navigation, menu, command, sort/header,
summary, and row-action controls to at least 44 by 44 CSS pixels. Every drag
workflow keeps its existing non-drag command/form equivalent. Virtual keyboard
navigation records pending focus, scrolls the selected row into the shared
window, then restores focus after the row mounts.

## Consequences

- Locale and direction behavior is reusable by every module.
- Missing translations fail visibly but safely through the English/fallback
  path; no feature creates a second framework.
- User/project content remains data and is never translated.
- Arabic is a reference locale proving the architecture, not a claim that all
  current module strings have complete professional translation.
- Timeline chronology is stable in both directions while surrounding layout,
  controls, pinned columns, and labels follow RTL.
- Future locales extend the shared registry and policy tests.

## Alternatives

- A Planning-only dictionary was rejected because it would fragment shell and
  module behavior.
- Automatic machine translation at runtime was rejected for determinism,
  privacy, terminology, and offline behavior.
- Mirroring the SVG with CSS transforms was rejected because it mirrors text
  and corrupts pointer/date geometry.
- Keeping compact pointer targets on touch devices was rejected by the UOK UI
  policy and WCAG-aligned target guidance.

## Validation

- shared provider translation, fallback, Arabic number, and direction tests;
- account-menu selection, persistence, document metadata, and translated
  navigation test;
- 500-row virtual-boundary ArrowDown selection, scroll, mount, and focus proof;
- Arabic Planning grid/timeline render with RTL grid and LTR chronology;
- coarse-pointer row selection and 44-by-44 action-target proof;
- zero unnamed buttons in the representative workspace;
- 320 CSS-pixel reflow, 200% root text scaling, reload persistence, screenshot,
  and console-clean Chromium proof.
