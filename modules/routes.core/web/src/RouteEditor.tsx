import { useEffect, useMemo, useRef, useState } from "react";

import { WorkspaceActionButton } from "@uok/shared/actions";
import { FieldMessage } from "@uok/shared/forms";
import { RoutePathEditor } from "./RoutePathEditor";
import type { LocationReference, RouteDefinition, RouteDraft, RouteMode } from "./types";
import { draftFromRoute, emptyRouteDraft, orderedLocationIds } from "./types";

export function RouteEditor({
  mode,
  route,
  locationOptions,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  route: RouteDefinition | null;
  locationOptions: LocationReference[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (draft: RouteDraft) => void;
}) {
  const [draft, setDraft] = useState<RouteDraft>(() => initialDraft(mode, route));
  const currentRoute = useRef(route);
  currentRoute.current = route;
  const options = useMemo(() => mergeOptions(locationOptions, route), [locationOptions, route]);
  const validation = validateDraft(draft, locationOptions);
  const validationId = "route-editor-validation";

  useEffect(() => {
    setDraft(initialDraft(mode, currentRoute.current));
  }, [mode, route?.id, route?.version]);

  return (
    <form
      className="route-editor-form"
      aria-label={mode === "create" ? "Create route definition" : "Edit route definition"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!validation && !busy) onSubmit(draft);
      }}
    >
      <div className="route-editor-grid">
        <label className="field">
          <span>Route code</span>
          <input
            autoFocus={mode === "create"}
            value={draft.code}
            maxLength={80}
            required
            disabled={busy || mode === "edit"}
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Canonical name</span>
          <input
            autoFocus={mode === "edit"}
            value={draft.canonicalName}
            maxLength={180}
            required
            disabled={busy}
            onChange={(event) => setDraft({ ...draft, canonicalName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Mode hint</span>
          <select value={draft.modeHint} disabled={busy} onChange={(event) => setDraft({ ...draft, modeHint: event.target.value as RouteMode | "" })}>
            <option value="">No mode hint</option>
            <option value="sea">Sea</option>
            <option value="road">Road</option>
            <option value="rail">Rail</option>
            <option value="air">Air</option>
            <option value="multimodal">Multimodal</option>
          </select>
        </label>
        {mode === "edit" ? (
          <label className="field">
            <span>Name-change reason</span>
            <input value={draft.reason} maxLength={500} disabled={busy} placeholder="Optional unless more context is needed" onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
          </label>
        ) : null}
      </div>
      <RoutePathEditor draft={draft} options={options} busy={busy} onChange={setDraft} />
      {validation ? <FieldMessage id={validationId}>{validation}</FieldMessage> : null}
      {error ? <FieldMessage id="route-editor-error">{error}</FieldMessage> : null}
      <div className="route-editor-actions">
        <WorkspaceActionButton action="cancel" disabled={busy} onClick={onCancel} />
        <WorkspaceActionButton
          action={mode === "create" ? "create" : "save"}
          labelKey={mode === "create" ? "command.createRoute" : "command.saveRoute"}
          fallbackLabel={mode === "create" ? "Create route" : "Save route"}
          type="submit"
          primary
          loading={busy}
          disabled={Boolean(validation)}
        />
      </div>
    </form>
  );
}

function initialDraft(mode: "create" | "edit", route: RouteDefinition | null) {
  return mode === "edit" && route ? draftFromRoute(route) : { ...emptyRouteDraft, waypointLocationIds: [] };
}

function mergeOptions(options: LocationReference[], route: RouteDefinition | null) {
  const merged = new Map(options.map((option) => [option.location_definition_id, option]));
  for (const stop of route?.stops || []) {
    if (!merged.has(stop.location.location_definition_id)) {
      merged.set(stop.location.location_definition_id, stop.location);
    }
  }
  return [...merged.values()];
}

function validateDraft(draft: RouteDraft, options: LocationReference[]) {
  if (!draft.code.trim() || !draft.canonicalName.trim()) return "Route code and canonical name are required.";
  const ids = orderedLocationIds(draft);
  if (ids.some((id) => !id)) return "Origin, destination, and every waypoint must select a location.";
  if (new Set(ids).size !== ids.length) return "Each location may appear only once in the ordered route path.";
  const ready = new Set(options.filter((option) => option.status === "ready").map((option) => option.location_definition_id));
  if (ids.some((id) => !ready.has(id))) return "Every route stop must be an active, available Location.";
  return "";
}
