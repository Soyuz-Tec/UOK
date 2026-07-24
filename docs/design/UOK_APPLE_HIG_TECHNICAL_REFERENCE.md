# UOK Apple HIG Technical Reference

**Reference version:** `2026-07-05.v1`

**Status:** Mandatory technical reference for durable UOK UI development.

**Applies to:** `web/` React + TypeScript + Vite UI, module workbenches, future reusable UI primitives, and candidate verification gates.

This document translates the official Apple Human Interface Guidelines into UOK-owned implementation rules. It does not authorize copying Apple assets, SF Symbols exports, Apple product marks, or Apple platform branding.

## Scan Coverage

Source root: https://developer.apple.com/design/human-interface-guidelines/

The HIG scan covered the six top-level branches exposed by Apple's HIG root payload:

- Getting started
- Foundations
- Patterns
- Components
- Inputs
- Technologies

The scan found:

- `176` alias-inclusive HIG route references.
- `172` unique HIG pages.
- `161` alias-inclusive article route references.
- `157` unique detailed article pages.
- `15` collection/index pages.
- `4` duplicate alias routes that must be deduplicated by Apple identifier, not URL: `Tab views`, `Page controls`, `Complications`, and `Nearby interactions`.

## First-Priority Source Pages

Use these pages first when resolving UOK UI decisions:

1. https://developer.apple.com/design/human-interface-guidelines/design-principles
2. https://developer.apple.com/design/human-interface-guidelines/accessibility
3. https://developer.apple.com/design/human-interface-guidelines/inclusion
4. https://developer.apple.com/design/human-interface-guidelines/privacy
5. https://developer.apple.com/design/human-interface-guidelines/layout
6. https://developer.apple.com/design/human-interface-guidelines/typography
7. https://developer.apple.com/design/human-interface-guidelines/color
8. https://developer.apple.com/design/human-interface-guidelines/writing
9. https://developer.apple.com/design/human-interface-guidelines/buttons
10. https://developer.apple.com/design/human-interface-guidelines/feedback

## Token Rules

- Define semantic tokens only: `bg.base`, `bg.elevated`, `bg.grouped.primary`, `bg.grouped.secondary`, `bg.grouped.tertiary`, `text.primary`, `text.secondary`, `text.tertiary`, `text.quaternary`, `text.placeholder`, `separator`, `link`, `accent`, `status.success`, `status.warning`, `status.danger`, and `status.info`.
- Every color token must support light, dark, light high-contrast, and dark high-contrast variants.
- Do not hard-code Apple system color values.
- Test all custom brand and accent colors in light mode, dark mode, increased contrast, reduced transparency, and over elevated/translucent surfaces.
- Typography tokens must map to semantic text styles: `largeTitle`, `title1`, `title2`, `title3`, `headline`, `body`, `callout`, `subhead`, `footnote`, `caption1`, and `caption2`.
- Use system-font stacks by default.
- Avoid ultralight, thin, or light weights for functional UI text.
- Target minimum text sizes: iOS/iPadOS `11pt`, macOS `10pt`, tvOS `23pt`, visionOS `12pt`, watchOS `12pt`.
- Target default body sizes: iOS/iPadOS `17pt`, macOS `13pt`, tvOS `29pt`, visionOS `17pt`, watchOS `16pt`.
- Control target tokens: default touch `44x44`, compact `28x28`, pointer/mac default `28x28`, pointer/mac minimum `20x20`.
- UOK web implementation maps the general enterprise target to `44x44 CSS px` for app controls unless a smaller compact preview control is explicitly justified.

## Workbench Layout Rules

- Use explicit workbench regions: top toolbar/search, leading navigation, primary list/table/grid, secondary detail canvas, optional tertiary inspector, and optional status/footer.
- Do not model page sections as nested cards. Panes are structural regions.
- Put highest-value content at the top and leading edge.
- Use alignment, indentation, spacing, separators, and persistent selection to communicate hierarchy.
- Keep sidebar hierarchy to two levels. Deeper structures require split view: sidebar to list/outline to detail/inspector.
- Use sidebars for broad enterprise navigation on wide layouts.
- Use tab bars only for compact top-level sections.
- Preserve selected state in every pane that leads to the current detail view.
- Hide tertiary/inspector panes before collapsing primary navigation.
- Toolbars should have at most three logical groups.
- Text-heavy records belong in lists/tables. Visual records belong in collections. Hierarchical rows belong in outline views.
- Enterprise tables must support succinct row text, descriptive column headings, sorting, resizing, centered ellipsis for identifiers, and alternating row color only when it improves wide-table tracking.
- Avoid same-axis nested scrolling.
- Make scrollability visible when indicators are hidden.
- Auto-scroll only enough to reveal a selected, edited, or searched item.
- Respect safe areas, margins, toolbar/sidebar overlays, and browser/system chrome.
- Do not place critical actions at the bottom of resizable sidebars or windows.

## Component Rules

Build reusable primitives around explicit semantics:

- `Button`
- `IconButton`
- `Menu`
- `SegmentedControl`
- `Toolbar`
- `Sidebar`
- `TabBar`
- `SearchField`
- `TextField`
- `Picker`
- `Toggle`
- `Alert`
- `Sheet`
- `Popover`
- `Progress`
- `ListTable`

Every interactive control must model these states where applicable:

- default
- hover
- focus-visible
- pressed
- selected/on
- expanded/open
- disabled
- loading
- invalid
- destructive
- primary

Component constraints:

- Use one primary action per surface by default.
- Never combine `primary` and `destructive`.
- Destructive actions require clear destructive styling and either undo or confirmation for uncommon or unrecoverable actions.
- Always provide a Cancel escape path in alerts and action sheets.
- Icon-only controls require `aria-label` plus tooltip/help text.
- Labels must be short and direct.
- Action labels should usually start with verbs.
- Tab, segment, list, and table headings should use nouns or noun phrases.
- Error text must say how to fix the issue and appear next to the problem.
- Menus are for space-efficient commands: important items first, logical groups, one submenu level max, icons sparingly.
- Context-menu commands must also exist in the main UI.
- Segmented controls are only for closely related choices. Do not mix action segments with selection-state segments.
- Toolbars hold frequent commands, navigation, search, and one trailing primary action.
- UOK workspace command grouping and visible labels follow `docs/architecture/ADR-0025-uniform-workspace-command-surface-and-action-vocabulary.md`; this technical reference does not define a competing vocabulary.
- Tab bars are top-level navigation only, not actions.
- Sidebars are for top-level areas or collections. Keep hierarchy shallow.
- Popovers are transient and small, not warnings.
- Sheets are scoped tasks, one at a time, with Cancel, Done, and Back rules.
- Alerts are only for critical, actionable interruptions.
- Progress indicators must keep moving, use determinate progress when possible, avoid vague labels, stay in a consistent location, and expose cancel/pause when safe.

## Interaction Rules

- Every enterprise workflow must be completable with keyboard alone.
- Preserve standard shortcuts.
- Custom shortcuts are allowed only for frequent app-specific commands and must not repurpose expected system shortcuts.
- Expose commands through visible menus/buttons, not only gestures.
- Menus should keep unavailable commands visible but disabled when discoverability matters.
- Focus must be visible, ordered logically, and stable.
- Do not move focus without user action except when the focused item disappears during keyboard or remote navigation.
- Pointer, touch, gesture, drag/drop, and keyboard paths must produce consistent results.
- Gesture-only actions must have a button, menu item, shortcut, or assistive-technology-accessible alternative.
- Drag/drop must show source, valid destination, invalid destination, drop failure, and result state.
- Drag/drop must support undo or explicit confirmation for irreversible drops.
- Useful static text such as IDs, error messages, and IPs should be selectable or copyable.

## Command Lifecycle Rules

Commands must expose explicit lifecycle states:

- available
- unavailable
- executing
- succeeded
- failed
- canceled

Additional command rules:

- Return or the primary action may confirm the likely nondestructive choice.
- Destructive commands must not be primary/default.
- Long-running button actions should show inline activity and an updated action label.
- Use ellipses for commands that require more input before completion.
- Confirm success only for significant actions.
- Failures and risks deserve clearer feedback than routine success.

## Data Entry Rules

- Prefer choices, pickers, menus, paste, and drag/drop over unnecessary free-text entry.
- Prefill from trusted/system data only when permission and source are clear.
- Validate as early as useful.
- Keep required-flow actions unavailable until required data is present.
- Use secure fields for sensitive values.
- Never prepopulate passwords.
- Tab order must follow visual/logical reading order.
- Text fields need persistent labels or clear context, placeholder hints, secure mode where needed, locale-aware numeric formatting, and validation timing matched to the field.

## Feedback, Loading, and Error Rules

- Feedback severity must match interruption level.
- Use inline/passive feedback for routine status.
- Use alert/modal interruptions only for critical actionable issues.
- Never rely on color alone.
- Pair state with text, icon, shape, position, sound, haptic, or another accessible cue.
- Show content, placeholder, skeleton, or cached state immediately.
- Never leave an enterprise surface blank while loading.
- Use determinate progress when duration is knowable.
- Switch from indeterminate to determinate when possible.
- Provide Cancel or Pause when halting is safe.
- Warn if cancellation loses progress.
- Error alerts must explain what happened, why it matters, and what action is available.
- Avoid generic titles like `Error`.
- Notifications must not be used for errors and must not contain sensitive information.

## Privacy, Security, and Account Rules

- Request only data/access actually needed.
- Ask for access at the moment the feature needs it.
- Avoid launch-time permission requests unless required for the app to function.
- Purpose text must be specific, plain, and truthful.
- Account creation/sign-in must be delayed until there is user value.
- Account deletion paths must be discoverable when supported or required.
- Prefer passkeys and system authentication where applicable.
- Search history, notifications, lock-screen/glanceable surfaces, and shared surfaces must avoid exposing sensitive data.
- Secure text fields, permission copy, keychain/secrets storage, account deletion, and audit logs must be centralized in UOK patterns.

## Accessibility Rules

- WCAG AA contrast gate: `4.5:1` for normal text up to `17pt`.
- WCAG AA contrast gate: `3:1` for `18pt+` or bold text.
- For custom foreground/background pairs, target `7:1`.
- UI must remain usable at `200%` text size with minimal truncation and no overlap.
- Meaningful icons must scale with text or remain clear at larger text settings.
- Keyboard-only, screen-reader, switch-control, and voice-control paths must expose all core actions.
- Every image/icon conveying meaning needs an accessible name or description.
- Decorative assets must be hidden from assistive technology.
- Avoid auto-dismiss timers for important UI.
- Provide explicit close/dismiss actions.
- Avoid flashing, fast repetitive motion, excessive bounce, peripheral motion, and sustained oscillation.
- Reduced-motion mode must replace or reduce motion without blocking task completion.

## Cross-Platform Rules

- Cross-platform UOK UI must share product intent, not identical layout.
- Each supported platform needs native-feeling navigation, controls, inputs, window behavior, and accessibility behavior.
- Desktop/regular layouts are the primary enterprise shape: persistent sidebar or split view, visible toolbar/search, sortable/resizable tables, inspectors beside content, and commands reachable through toolbar, context menu, keyboard, and menu bar where applicable.
- Compact behavior must be adaptive, not feature-reduced.
- Keep the full layout as long as it fits.
- Collapse tertiary/inspector panes first.
- Switch to compact single-column or tab-bar pattern only when required.
- Preserve selection and task context across resizing.
- Core actions must work with pointer, keyboard, touch, assistive tech, and platform-specific inputs where supported.
- Desktop commands must be command-complete: toolbar items cannot be the only route.

Platform notes:

- iOS: prioritize primary tasks, limited onscreen controls, reachable controls, portrait/landscape support where practical, touch-first interactions.
- iPadOS: large display, multiple input modes, multitasking/window resizing, drag/drop, convertible tab/sidebar, defer compact layout as long as possible.
- macOS: dense productivity, resizable windows, menu bar, keyboard shortcuts, pointer precision, customizable toolbars, sortable/resizable tables.
- tvOS: remote/focus model, no pointer-style menu UI, large legible artwork, safe areas, focus scaling must not overlap content.
- watchOS: glanceable, single-screen, shallow hierarchy, Digital Crown vertical navigation, no more than a few controls side by side.
- visionOS: windowed familiar UI first, indirect eye/hand gestures, field-of-view comfort, minimal motion/depth fatigue, avoid head-anchored content.

## Technology Adoption Rules

| Area | Adopt | Avoid | UOK guardrail |
|---|---|---|---|
| Charts | Operational metrics, trends, exceptions, comparison. | Decorative charts, hidden values, color-only meaning. | Define chart spec: data summary, units, empty state, accessibility text, keyboard/screen-reader navigation. |
| Maps | Real location, facility, routing, asset-map tasks. | Decorative maps, noninteractive screenshots. | Wrap provider, permissions, overlays, clustering, and offline fallback behind a UOK map adapter. |
| Glanceable surfaces | High-value, time-bound status and simple actions. | Ads, repeated nudges, generic open-app actions, sensitive lock-screen data. | Define `GlanceableSurfacePolicy`: sensitivity, redaction, auth-required actions, cadence, expiry. |
| AI and ML | Specific value, disclosure, correction, retry, revert, fallback. | Hidden decision-making, unverified facts, sensitive training without permission. | Maintain model registry: data used, runtime location, retention, confidence, review path. |
| Siri and shortcuts | Simple high-frequency tasks with concise responses. | Marketing content, long option lists, complex voice flows. | Model all shortcuts as UOK intents with permissions, confirmation, localization, fallback UI. |
| Collaboration | Shared sessions where synchronized state matters. | Divergent shared state, forced sign-up/payment before joining. | Add shared-session state machine: role, sync, prerequisites, conflict handling. |
| Payments, wallet, identity | Actual payment, pass, order, or identity workflows. | Custom payment confirmations, Apple marks as generic branding, excess ID data. | Gate through payments/identity service with eligibility, final amount checks, consent. |
| AR and spatial | Inspection, placement, 3D review, training where space improves task. | Forced movement, sudden immersion, head-anchored UI, critical controls at hidden edges. | Capability checks, comfort limits, permission gates, standard window/ornament patterns. |
| Regulated data | Explicit consent, clear privacy policy, system permission screens. | Extra data, duplicate privacy controls, custom copies of system permission flows. | Minimum data, consent versioning, withdrawal/deletion path, separate audit trail. |

## Verification Gates

Before accepting a UI-bearing candidate:

- Component stories cover every state, density, theme, and responsive breakpoint.
- Automated checks fail if an interactive target is under `44x44`, an icon-only control lacks an accessible name, a field lacks a label, or `primary && destructive` is true.
- Keyboard tests cover tab order, focus-visible, Enter/Space activation, Escape close/cancel, arrow-key behavior for menus/segments/tabs, and no focus traps.
- Accessibility tests cover names, roles, states, `aria-invalid`, error descriptions, `aria-expanded`, `aria-selected`, and `aria-pressed`.
- Visual tests cover light, dark, increased contrast, reduced transparency, `200%` text zoom, no clipped labels, no overlapping toolbar/sidebar/tab states.
- Validation tests cover inline field errors, disabled/available Continue behavior, destructive confirmation, cancel path, and undo path where promised.
- Responsive tests cover toolbar overflow, tab/sidebar adaptation, table truncation, popover fallback on compact widths, and search placement.
- Progress/status tests cover determinate and indeterminate states, stalled/error copy, cancel/pause behavior, and no stationary spinner during active work.
- Workbench screenshot gates cover wide desktop, narrow desktop/tablet, and mobile widths.
- RTL/localized labels and enlarged text must not clip critical controls.
- Same-axis nested scroll traps are not allowed.
- No sensitive data appears in notifications, glanceable surfaces, shared surfaces, or screenshots unless explicitly intended and protected.

## Full HIG Page Inventory

Collection/index pages:

- https://developer.apple.com/design/human-interface-guidelines/
- https://developer.apple.com/design/human-interface-guidelines/getting-started
- https://developer.apple.com/design/human-interface-guidelines/foundations
- https://developer.apple.com/design/human-interface-guidelines/patterns
- https://developer.apple.com/design/human-interface-guidelines/components
- https://developer.apple.com/design/human-interface-guidelines/inputs
- https://developer.apple.com/design/human-interface-guidelines/technologies
- https://developer.apple.com/design/human-interface-guidelines/content
- https://developer.apple.com/design/human-interface-guidelines/layout-and-organization
- https://developer.apple.com/design/human-interface-guidelines/menus-and-actions
- https://developer.apple.com/design/human-interface-guidelines/navigation-and-search
- https://developer.apple.com/design/human-interface-guidelines/presentation
- https://developer.apple.com/design/human-interface-guidelines/selection-and-input
- https://developer.apple.com/design/human-interface-guidelines/status
- https://developer.apple.com/design/human-interface-guidelines/system-experiences

Detailed pages:

- https://developer.apple.com/design/human-interface-guidelines/design-principles
- https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
- https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados
- https://developer.apple.com/design/human-interface-guidelines/designing-for-macos
- https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos
- https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos
- https://developer.apple.com/design/human-interface-guidelines/designing-for-watchos
- https://developer.apple.com/design/human-interface-guidelines/designing-for-games
- https://developer.apple.com/design/human-interface-guidelines/accessibility
- https://developer.apple.com/design/human-interface-guidelines/app-icons
- https://developer.apple.com/design/human-interface-guidelines/branding
- https://developer.apple.com/design/human-interface-guidelines/color
- https://developer.apple.com/design/human-interface-guidelines/dark-mode
- https://developer.apple.com/design/human-interface-guidelines/icons
- https://developer.apple.com/design/human-interface-guidelines/images
- https://developer.apple.com/design/human-interface-guidelines/immersive-experiences
- https://developer.apple.com/design/human-interface-guidelines/inclusion
- https://developer.apple.com/design/human-interface-guidelines/layout
- https://developer.apple.com/design/human-interface-guidelines/materials
- https://developer.apple.com/design/human-interface-guidelines/motion
- https://developer.apple.com/design/human-interface-guidelines/privacy
- https://developer.apple.com/design/human-interface-guidelines/right-to-left
- https://developer.apple.com/design/human-interface-guidelines/sf-symbols
- https://developer.apple.com/design/human-interface-guidelines/spatial-layout
- https://developer.apple.com/design/human-interface-guidelines/typography
- https://developer.apple.com/design/human-interface-guidelines/writing
- https://developer.apple.com/design/human-interface-guidelines/charting-data
- https://developer.apple.com/design/human-interface-guidelines/collaboration-and-sharing
- https://developer.apple.com/design/human-interface-guidelines/drag-and-drop
- https://developer.apple.com/design/human-interface-guidelines/entering-data
- https://developer.apple.com/design/human-interface-guidelines/feedback
- https://developer.apple.com/design/human-interface-guidelines/file-management
- https://developer.apple.com/design/human-interface-guidelines/going-full-screen
- https://developer.apple.com/design/human-interface-guidelines/launching
- https://developer.apple.com/design/human-interface-guidelines/live-viewing-apps
- https://developer.apple.com/design/human-interface-guidelines/loading
- https://developer.apple.com/design/human-interface-guidelines/managing-accounts
- https://developer.apple.com/design/human-interface-guidelines/managing-notifications
- https://developer.apple.com/design/human-interface-guidelines/modality
- https://developer.apple.com/design/human-interface-guidelines/multitasking
- https://developer.apple.com/design/human-interface-guidelines/offering-help
- https://developer.apple.com/design/human-interface-guidelines/onboarding
- https://developer.apple.com/design/human-interface-guidelines/playing-audio
- https://developer.apple.com/design/human-interface-guidelines/playing-haptics
- https://developer.apple.com/design/human-interface-guidelines/playing-video
- https://developer.apple.com/design/human-interface-guidelines/printing
- https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews
- https://developer.apple.com/design/human-interface-guidelines/searching
- https://developer.apple.com/design/human-interface-guidelines/settings
- https://developer.apple.com/design/human-interface-guidelines/undo-and-redo
- https://developer.apple.com/design/human-interface-guidelines/workouts
- https://developer.apple.com/design/human-interface-guidelines/charts
- https://developer.apple.com/design/human-interface-guidelines/image-views
- https://developer.apple.com/design/human-interface-guidelines/text-views
- https://developer.apple.com/design/human-interface-guidelines/web-views
- https://developer.apple.com/design/human-interface-guidelines/boxes
- https://developer.apple.com/design/human-interface-guidelines/collections
- https://developer.apple.com/design/human-interface-guidelines/column-views
- https://developer.apple.com/design/human-interface-guidelines/disclosure-controls
- https://developer.apple.com/design/human-interface-guidelines/labels
- https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- https://developer.apple.com/design/human-interface-guidelines/lockups
- https://developer.apple.com/design/human-interface-guidelines/outline-views
- https://developer.apple.com/design/human-interface-guidelines/split-views
- https://developer.apple.com/design/human-interface-guidelines/tab-views
- https://developer.apple.com/design/human-interface-guidelines/activity-views
- https://developer.apple.com/design/human-interface-guidelines/buttons
- https://developer.apple.com/design/human-interface-guidelines/context-menus
- https://developer.apple.com/design/human-interface-guidelines/dock-menus
- https://developer.apple.com/design/human-interface-guidelines/edit-menus
- https://developer.apple.com/design/human-interface-guidelines/home-screen-quick-actions
- https://developer.apple.com/design/human-interface-guidelines/menus
- https://developer.apple.com/design/human-interface-guidelines/ornaments
- https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons
- https://developer.apple.com/design/human-interface-guidelines/pull-down-buttons
- https://developer.apple.com/design/human-interface-guidelines/the-menu-bar
- https://developer.apple.com/design/human-interface-guidelines/toolbars
- https://developer.apple.com/design/human-interface-guidelines/path-controls
- https://developer.apple.com/design/human-interface-guidelines/search-fields
- https://developer.apple.com/design/human-interface-guidelines/sidebars
- https://developer.apple.com/design/human-interface-guidelines/tab-bars
- https://developer.apple.com/design/human-interface-guidelines/token-fields
- https://developer.apple.com/design/human-interface-guidelines/action-sheets
- https://developer.apple.com/design/human-interface-guidelines/alerts
- https://developer.apple.com/design/human-interface-guidelines/page-controls
- https://developer.apple.com/design/human-interface-guidelines/panels
- https://developer.apple.com/design/human-interface-guidelines/popovers
- https://developer.apple.com/design/human-interface-guidelines/scroll-views
- https://developer.apple.com/design/human-interface-guidelines/sheets
- https://developer.apple.com/design/human-interface-guidelines/windows
- https://developer.apple.com/design/human-interface-guidelines/color-wells
- https://developer.apple.com/design/human-interface-guidelines/combo-boxes
- https://developer.apple.com/design/human-interface-guidelines/pickers
- https://developer.apple.com/design/human-interface-guidelines/segmented-controls
- https://developer.apple.com/design/human-interface-guidelines/sliders
- https://developer.apple.com/design/human-interface-guidelines/steppers
- https://developer.apple.com/design/human-interface-guidelines/text-fields
- https://developer.apple.com/design/human-interface-guidelines/toggles
- https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards
- https://developer.apple.com/design/human-interface-guidelines/activity-rings
- https://developer.apple.com/design/human-interface-guidelines/gauges
- https://developer.apple.com/design/human-interface-guidelines/progress-indicators
- https://developer.apple.com/design/human-interface-guidelines/rating-indicators
- https://developer.apple.com/design/human-interface-guidelines/app-shortcuts
- https://developer.apple.com/design/human-interface-guidelines/complications
- https://developer.apple.com/design/human-interface-guidelines/controls
- https://developer.apple.com/design/human-interface-guidelines/live-activities
- https://developer.apple.com/design/human-interface-guidelines/notifications
- https://developer.apple.com/design/human-interface-guidelines/snippets
- https://developer.apple.com/design/human-interface-guidelines/status-bars
- https://developer.apple.com/design/human-interface-guidelines/top-shelf
- https://developer.apple.com/design/human-interface-guidelines/watch-faces
- https://developer.apple.com/design/human-interface-guidelines/widgets
- https://developer.apple.com/design/human-interface-guidelines/action-button
- https://developer.apple.com/design/human-interface-guidelines/apple-pencil-and-scribble
- https://developer.apple.com/design/human-interface-guidelines/camera-control
- https://developer.apple.com/design/human-interface-guidelines/digital-crown
- https://developer.apple.com/design/human-interface-guidelines/eyes
- https://developer.apple.com/design/human-interface-guidelines/focus-and-selection
- https://developer.apple.com/design/human-interface-guidelines/game-controls
- https://developer.apple.com/design/human-interface-guidelines/gestures
- https://developer.apple.com/design/human-interface-guidelines/gyro-and-accelerometer
- https://developer.apple.com/design/human-interface-guidelines/keyboards
- https://developer.apple.com/design/human-interface-guidelines/nearby-interactions
- https://developer.apple.com/design/human-interface-guidelines/pointing-devices
- https://developer.apple.com/design/human-interface-guidelines/remotes
- https://developer.apple.com/design/human-interface-guidelines/airplay
- https://developer.apple.com/design/human-interface-guidelines/always-on
- https://developer.apple.com/design/human-interface-guidelines/app-clips
- https://developer.apple.com/design/human-interface-guidelines/apple-pay
- https://developer.apple.com/design/human-interface-guidelines/augmented-reality
- https://developer.apple.com/design/human-interface-guidelines/carekit
- https://developer.apple.com/design/human-interface-guidelines/carplay
- https://developer.apple.com/design/human-interface-guidelines/game-center
- https://developer.apple.com/design/human-interface-guidelines/generative-ai
- https://developer.apple.com/design/human-interface-guidelines/healthkit
- https://developer.apple.com/design/human-interface-guidelines/homekit
- https://developer.apple.com/design/human-interface-guidelines/icloud
- https://developer.apple.com/design/human-interface-guidelines/id-verifier
- https://developer.apple.com/design/human-interface-guidelines/imessage-apps-and-stickers
- https://developer.apple.com/design/human-interface-guidelines/in-app-purchase
- https://developer.apple.com/design/human-interface-guidelines/live-photos
- https://developer.apple.com/design/human-interface-guidelines/mac-catalyst
- https://developer.apple.com/design/human-interface-guidelines/machine-learning
- https://developer.apple.com/design/human-interface-guidelines/maps
- https://developer.apple.com/design/human-interface-guidelines/nfc
- https://developer.apple.com/design/human-interface-guidelines/photo-editing
- https://developer.apple.com/design/human-interface-guidelines/researchkit
- https://developer.apple.com/design/human-interface-guidelines/shareplay
- https://developer.apple.com/design/human-interface-guidelines/shazamkit
- https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple
- https://developer.apple.com/design/human-interface-guidelines/siri
- https://developer.apple.com/design/human-interface-guidelines/tap-to-pay-on-iphone
- https://developer.apple.com/design/human-interface-guidelines/voiceover
- https://developer.apple.com/design/human-interface-guidelines/wallet
