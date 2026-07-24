# ADR-0025: Uniform Workspace Command Surface and Action Vocabulary

**Status:** Accepted
**Date:** 2026-07-12
**Current candidate:** `UOK-3.1.0-alpha.3`

## Context

UOK workspaces need module-owned workflows without module-specific command
chrome. Apps, Calendar, Communications, Contacts, and Planning already compose
the shared workspace command bar, but layout guidance alone does not prevent
duplicate actions, inconsistent verbs, multiple competing primary commands, or
low-frequency controls crowding the main work surface.

The command surface is a cross-module frontend boundary. Its structure,
responsive behavior, accessibility, and common vocabulary must be shared while
business nouns, permissions, state, options, and command handlers remain owned
by the consuming module.

## Decision

1. Every durable record or work-management module workspace uses
   `WorkspaceCommandBar` from `web/src/shared/layout` unless its module plan
   records a justified exception.
2. The command surface has at most three labelled logical groups in stable
   order: `query`, `context`, and `actions`. Slots remain optional so a module
   does not expose unsupported workflows.
3. Each active surface has at most one visually emphasized primary action. It
   appears last in the actions group and uses `New <singular noun>` for
   top-level record creation.
4. Frequent query, view, field, navigation, and workflow controls remain
   directly reachable. Low-frequency commands belong in a labelled
   supplemental section of the expandable search/options panel or an
   appropriate module-tools panel. A command must not be duplicated in
   competing visible regions.
5. UOK uses this common visible action vocabulary and placement:

   | Intent | Standard label | Default placement |
   |---|---|---|
   | Search | `Search <plural noun>` | Query group |
   | Default unfiltered set | `All <plural noun>` | Query or context group |
   | Open an existing record or workspace | `Open` or `Open <singular noun>` when context is needed | Owning row, card, result, or contextual action area |
   | Close a popup, editor, or transient surface | `Close` | Shared surface chrome or action area; not a competing workspace command |
   | Create a top-level record | `New <singular noun>`; the shared action primitive uses the base verb `Create` | One trailing primary action |
   | Add or associate inside an existing record | `Add <noun>` | Owning record workflow |
   | Query refinements | `Filters`, `Sort`, `Group by`, `Saved views` | Query or context group |
   | Presentation | `Fields`, `View` | Context group |
   | Reload or history | `Refresh`, `Undo`, `Redo` | Direct when frequent; otherwise labelled supplemental actions |
   | Export or print the current governed result | `Export` or `Export <format>`, and `Print` | Labelled supplemental actions unless central to the workflow |
   | Reset or finish an options panel | `Clear all`, `Done` | Panel action area |
   | Edit completion | `Edit`, `Save`, `Discard` | Owning detail or editor action area |
   | Abandon a dialog or confirmation | `Cancel` | Dialog or confirmation action area |
   | Destroy an owned record | `Delete` | Contextual destructive action with confirmation when required |
   | Detach a relationship without destroying the related record | `Remove` | Owning relationship workflow |

6. Icons supplement visible business labels and do not replace critical-action
   text. Common labels use shared localization keys and follow the shared
   locale fallback contract; modules supply domain nouns without creating
   feature-local synonyms for standard actions.
7. Shared layout, localization, and primitive owners control grouping,
   responsive reflow, focus behavior, component states, and common label keys.
   Modules control query state, contextual data, permissions, loading and
   disabled conditions, options, mutations, and business validation.
8. The command surface does not use the ARIA `toolbar` role unless it implements
   the complete toolbar keyboard interaction pattern. Normal document-order
   tab navigation remains the default.
9. Narrow and enlarged-text layouts keep the primary action and current query
   summary reachable. Expandable panels remain bounded to the viewport, dismiss
   through Done, Escape, outside activation, or explicit saved-view apply, and
   restore focus to their trigger.
10. A module-specific placement or vocabulary exception must be recorded in
    the owning module plan with its user need and verification. A UOK-wide
    replacement requires a superseding ADR.

## Consequences

- Workspaces keep a predictable, low-noise command hierarchy without moving
  domain state or business commands into the shared shell.
- Shared localization and accessibility behavior can be verified once and
  exercised across every consuming module.
- Modules may omit irrelevant groups and use domain-specific nouns, but they
  cannot introduce competing command bars or synonyms for common actions.
- Context menus and shortcuts may provide alternate access, but a governed
  action must remain discoverable through the main workspace or an explicitly
  labelled supplemental panel.
- Existing module surfaces may require small adapters or label changes as the
  common vocabulary is applied; this decision does not require a new frontend
  framework or runtime dependency.

## Alternatives Considered

- **Allow each module to design its own command bar.** Rejected because layout,
  vocabulary, accessibility, and responsive behavior would drift.
- **Render every possible command in one universal toolbar.** Rejected because
  unsupported and low-frequency actions would create noise and hide the
  primary workflow.
- **Use an icon-only global action strip.** Rejected because business meaning,
  localization, and accessibility would be weakened.
- **Keep the rule only in implementation guidance.** Rejected because the
  shared/module ownership boundary and cross-module vocabulary need a durable,
  reviewable architecture decision.

## Validation

- Shared component tests prove optional slots, stable group order, at most one
  primary action, labelled controls, expandable-panel dismissal, and focus
  restoration.
- Apps, Calendar, Communications, Contacts, and Planning UI proof verifies the
  common command surface, direct frequent actions, labelled low-frequency
  actions, and absence of duplicate commands.
- Representative browser proof covers keyboard operation, English and Arabic,
  RTL, light/dark/system appearance, narrow layout, and 200% text scaling.
- UI changes run the frontend tests, UI proof, static build, TechnologyAudit,
  and the full repository Verify gate required by the owning policy.
