# UOK UI Design Policy

**Policy version:** `2026-07-05.v2`

**Status:** Mandatory for current and durable UOK UI work.

**Applies to:** The current `web/` React + TypeScript + Vite UI, UOK module-testing screens, and module surface registry entries.

This is a policy, not a recommendation. Current UI implementation and new durable UI code must follow this document unless an architecture decision record explicitly replaces it.

## Source Basis

This policy adopts Apple-informed design principles from:

- UOK Apple HIG Technical Reference: `docs/design/UOK_APPLE_HIG_TECHNICAL_REFERENCE.md`
- Apple Developer Design: https://developer.apple.com/design/
- Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Human Interface Guidelines - Getting started: https://developer.apple.com/design/human-interface-guidelines/getting-started
- Human Interface Guidelines - Foundations: https://developer.apple.com/design/human-interface-guidelines/foundations
- Human Interface Guidelines - Patterns: https://developer.apple.com/design/human-interface-guidelines/patterns
- Human Interface Guidelines - Components: https://developer.apple.com/design/human-interface-guidelines/components
- Human Interface Guidelines - Inputs: https://developer.apple.com/design/human-interface-guidelines/inputs
- Human Interface Guidelines - Technologies: https://developer.apple.com/design/human-interface-guidelines/technologies
- Human Interface Guidelines - Icons: https://developer.apple.com/design/human-interface-guidelines/icons
- Human Interface Guidelines - Dark Mode: https://developer.apple.com/design/human-interface-guidelines/dark-mode
- Human Interface Guidelines - Layout and organization: https://developer.apple.com/design/human-interface-guidelines/layout-and-organization
- Human Interface Guidelines - Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Apple Design Resources: https://developer.apple.com/design/resources/
- Apple Design What's New: https://developer.apple.com/design/whats-new/

The UOK implementation must not copy Apple assets or imply Apple platform branding. The intended adoption is conceptual: clarity, content-first hierarchy, accessibility, adaptive layout, semantic color, and disciplined interaction patterns.

For implementation decisions, developers must use `docs/design/UOK_APPLE_HIG_TECHNICAL_REFERENCE.md` as the mandatory technical reference for component state, layout, interaction, accessibility, appearance, and verification rules.

## Mandatory Principles

1. Clarity first
   - Every screen must make the current module, object, workflow state, next action, and evidence status immediately understandable.
   - Labels must be direct and operational. Avoid decorative or vague UI text.

2. Content before chrome
   - The interface must support records, workflows, verification evidence, and exceptions without visual noise.
   - Avoid decorative backgrounds, nested cards, oversized marketing composition, and color-heavy layouts.

3. Semantic visual system
   - Colors must be assigned by role, not by one-off hex values.
   - Required roles include: `surface`, `surfaceElevated`, `separator`, `text`, `textMuted`, `accent`, `success`, `warning`, `danger`, and `info`.
   - Status must never rely on color alone.

4. Typography discipline
   - Use a restrained system-font stack and a named type scale.
   - Text sizing must use scalable units and survive browser zoom, localization, and longer labels.
   - Page, section, table, status, and caption styles must be distinct.

5. Adaptive workbench layout
   - UOK is an enterprise testing workbench, not a landing page.
   - Preferred layout is sidebar navigation plus main work area plus optional inspector/detail region.
   - Mobile and narrow desktop layouts must retain all critical workflows without overlap.
   - Layout must be consistent across modules and adapt to desktop, tablet, narrow browser, and enlarged text contexts.
   - Primary content must receive the most usable space; secondary evidence, logs, and supporting records may scroll or move below primary content.

6. Layout and organization discipline
   - Use a visible layout grid with named spacing tokens. Do not place unrelated content by one-off margins.
   - Use alignment, indentation, separators, and negative space to show hierarchy and grouping.
   - Keep module navigation, workflow commands, record lists, status evidence, and architecture checks in predictable regions across screens.
   - Respect safe areas and viewport edges with shell-level padding, especially on narrow and touch devices.
   - Control targets must be large enough for touch and pointer use; compact controls are allowed only for low-risk preview modes.
   - Lists, rows, and stepper controls must keep stable dimensions so dynamic data does not shift the layout unpredictably.
   - Preserve image, chart, and media aspect ratios. Do not stretch visual content to fill available space.
   - When content overflows, prefer clear scrolling regions, truncation with preserved full values in accessible text, or responsive reflow. Do not overlap content.

7. Accessibility as a release gate
   - Keyboard navigation, visible focus states, accessible labels, contrast, and non-color indicators are required.
   - UI must be testable under zoom, narrow widths, and high-contrast conditions.
   - Light and dark appearances must both be verified before packaging a candidate.

8. Familiar controls
   - Use familiar controls for familiar jobs: tabs for views, segmented controls for modes, toggles for binary state, inputs for data entry, buttons for commands, and tables/lists for records.
   - Icons must clarify actions, not replace required business meaning.
   - Interface icons must express one clear concept, use a consistent stroke/size system, inherit semantic color through `currentColor`, and remain paired with visible text for business-critical actions.
   - UOK must not copy Apple-owned symbols or branding. Use project-owned icons or a licensed open-source React icon library while applying Apple-informed icon discipline.

9. Measured depth
   - Use layering, shadow, translucency, or glass-like effects only when they improve hierarchy.
   - Do not turn visual depth into a theme. Data density and legibility win.

10. Appearance discipline
   - The UI must respect the user's system appearance by default and must support light and dark mode with semantic tokens.
   - Any local appearance switch must include `System` as the default and exist as a testing/preview control, not as an excuse to ignore system preference.
   - Dark mode must use base and elevated surface levels so background areas recede and foreground work areas advance.
   - Foreground content, icons, separators, controls, and status pills must adapt through semantic tokens rather than one-off light/dark hex values.
   - Text, icons, and status labels must remain legible in light mode, dark mode, increased contrast, and reduced transparency conditions.
   - Full-color images, logos, product marks, and generated media must be tested in both appearances. If one asset does not work in both, provide appearance-specific variants.

## Required Implementation Pattern

All durable UI work must use:

- React
- TypeScript
- Vite
- Shared design tokens
- Reusable UI components
- A consistent icon component system
- The frontend module surface registry for module-owned workbench composition
- Layout tokens for spacing, control target size, content max width, and safe-area-aware shell padding
- No executable durable UI outside the React + TypeScript source tree
- `docs/design/UOK_APPLE_HIG_TECHNICAL_REFERENCE.md` for component state, interaction, accessibility, and verification decisions

The next UI iteration must introduce or preserve:

- `web/src/design-tokens.css` or equivalent token module
- Shared shell components: app shell, sidebar, toolbar, panel, table/list, status pill, workflow stepper, command button, icon-bearing navigation/control patterns
- Shared module-neutral workflow primitives for repeated module behavior, including workflow headers, search fields, inline field messages, confirmed destructive commands, inline text editing, reusable in-workspace pop-ups for record detail/edit workflows, and reusable data tables with accessible resizable columns. Current homes: `web/src/shared/*`.
- Module surface registry entries that keep module navigation and rendering out of the generic shell component
- Shared component states: default, hover, focus-visible, pressed, selected/on, expanded/open, disabled, loading, invalid, destructive, and primary
- Light and dark mode foundations
- Consistent layout grid behavior for wide desktop, desktop, tablet, and narrow browser widths
- Visible focus styles
- Responsive breakpoints for desktop, tablet, and narrow browser widths

## Acceptance Gates

A UI change is not acceptable if it:

- Introduces hard-coded status colors without semantic tokens.
- Hides workflow state, verification state, or errors behind decoration.
- Depends on color alone to communicate status.
- Breaks keyboard navigation or visible focus.
- Causes text overlap at narrow widths or common browser zoom levels.
- Adds durable UI behavior outside the React + TypeScript source tree.
- Uses Apple-owned assets, SF Symbols exports, or Apple branding without an explicit legal/design decision.
- Adds unlabeled critical command icons.
- Adds an icon that does not adapt to light/dark mode through semantic color.
- Breaks system/default appearance behavior or removes light/dark verification.
- Adds one-off spacing or layout rules outside the token system.
- Allows text, controls, rows, panels, or workflow steps to overlap at supported widths.
- Places unrelated workflow regions inconsistently across modules.
- Hardcodes module-specific rendering directly in the shell when it belongs in the module surface registry.
- Uses media, chart, or image sizing that distorts aspect ratio.
- Bypasses the mandatory technical reference for UI state, layout, accessibility, interaction, appearance, or verification decisions.

Before packaging a candidate, developers must verify:

- The React build succeeds.
- The local browser shows the expected screen without console errors.
- Critical UI text fits at desktop and narrow widths.
- Status labels remain readable without color.
- Light, dark, and system appearance modes render the same workflows without overlap.
- Icons remain meaningful, consistently sized, and paired with text where the command affects business state.
- Wide desktop, desktop, tablet, and narrow browser widths preserve navigation, workflow command access, visible hierarchy, and readable grouping.
- Control targets, spacing, row separators, and scroll regions remain stable when records or labels are long.
- Shared component state coverage includes default, hover, focus-visible, pressed, selected/on, expanded/open, disabled, loading, invalid, destructive, and primary states.
- The design policy is still linked from the README and verification notes.

## Current UOK Visual Direction

UOK should look like a calm enterprise operations console:

- Product-neutral shell.
- Dense but readable information.
- Clear workflow states and commands.
- Low-noise surfaces.
- Strong accessibility.
- Consistent module testing patterns.

The visual target is Apple-informed discipline, not Apple imitation.
