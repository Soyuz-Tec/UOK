# UOK Localization and Bidirectional UI Policy

**Status:** Mandatory for localized UOK UI work

**Current candidate:** `UOK-3.1.0-alpha.3`

## Ownership

Localization is a shared UOK capability. Modules consume
`web/src/shared/localization`; they must not add feature-local translation
frameworks, locale stores, document-direction state, or competing formatters.

The workbench preference owner:

- validates locale IDs against the shared registry;
- persists `uok_locale` locally for the current browser profile;
- sets `<html lang>`, `<html dir>`, and `data-locale`;
- exposes locale choice through the signed-in account menu.

Server-synchronized user preferences may replace local persistence later, but
must preserve the same provider contract and safe fallback.

## Current locale contract

| Locale | Direction | Purpose |
|---|---|---|
| `en-US` | LTR | Default and fallback messages |
| `ar` | RTL | Reviewed bidirectional reference locale with Arabic numerals |

Translation lookup uses current locale, then English, then the caller fallback,
then the visible key. Dates and numbers use `Intl`; project/task names and other
business data are never translated.

Reference-locale proof establishes the architecture and representative shell/
Planning surface. It does not label every module's current copy professionally
translated. New coverage belongs in the shared dictionary and must include both
directional and fallback tests.

## Bidirectional layout rules

- Use logical properties such as `padding-inline`, `border-inline-start`, and
  `inset-inline-end`; avoid new directional left/right layout rules.
- Pinned offsets originate at inline start in both directions.
- Use `dir=auto`, `bdi`, or `unicode-bidi` for mixed user content when needed.
- Do not mirror icons whose meaning is not directional.
- Chronological charts may use an explicit LTR isolate inside RTL, but the
  choice must be documented and tested. Planning follows this rule so dates,
  dependency geometry, pointer coordinates, and text remain coherent.
- Narrow and enlarged-text layouts must keep critical actions visible without
  document-level horizontal scrolling; complex data regions may scroll inside
  their labeled container.

## Input and accessibility rules

- Pointer, touch, keyboard, and assistive paths must reach the same governed
  server action.
- Coarse-pointer primary targets are at least 44 by 44 CSS pixels.
- Virtualized collections expose total row count and exact row indexes.
- Keyboard selection across a virtual boundary must mount, scroll, and focus
  the intended row.
- Buttons require an accessible name; status cannot rely on color alone.
- Verify 320 CSS-pixel reflow, 200% text scaling, focus, direction, persistence,
  screenshot integrity, and console cleanliness for representative surfaces.

## Verification

```powershell
Set-Location web
npm test -- --run src/App.test.tsx src/shared/localization/UokLocalization.test.tsx
npx playwright test e2e/planning-scale.spec.ts e2e/planning-reach.spec.ts --project=chromium
```

Run the full repository `Verify` action before advancing evidence state.
