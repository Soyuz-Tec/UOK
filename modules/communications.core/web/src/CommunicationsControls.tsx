import { WorkspaceActionButton, WorkspaceActionsMenu } from "@uok/shared/actions";
import { SearchWorkspace } from "@uok/shared/forms";
import { WorkspaceCommandBar } from "@uok/shared/layout";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import type { ThreadSort, ThreadSortDirection } from "./communicationsWorkspaceModel";

type Option = { value: string; label: string };

export function CommunicationsCommandSurface({
  query, statusFilter, contextFilter, sortBy, sortDirection, statusOptions, contextOptions,
  refreshing, operationBusy, canCreate, onQueryChange, onStatusChange, onContextChange,
  onSortChange, onSortDirectionChange, onClear, onRefresh, onOpenCreate,
}: {
  query: string;
  statusFilter: string;
  contextFilter: string;
  sortBy: ThreadSort;
  sortDirection: ThreadSortDirection;
  statusOptions: Option[];
  contextOptions: Option[];
  refreshing: boolean;
  operationBusy: boolean;
  canCreate: boolean;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onContextChange: (value: string) => void;
  onSortChange: (value: ThreadSort) => void;
  onSortDirectionChange: (value: ThreadSortDirection) => void;
  onClear: () => void;
  onRefresh: () => void;
  onOpenCreate: () => void;
}) {
  return <WorkspaceCommandBar
    label="K Connect controls"
    query={<SearchWorkspace
      label="Search communication threads"
      value={query}
      placeholder="Search threads"
      defaultSummaryLabel="All threads"
      filters={[
        { id: "status", label: "Status", value: statusFilter, defaultValue: "active", options: statusOptions, onChange: onStatusChange },
        { id: "context", label: "Context", value: contextFilter, defaultValue: "all", options: contextOptions, onChange: onContextChange },
      ]}
      sort={{
        label: "Thread sort field",
        value: sortBy,
        defaultValue: "updated",
        options: [{ value: "updated", label: "Updated" }, { value: "title", label: "Title" }],
        direction: sortDirection,
        defaultDirection: "desc",
        onChange: (value) => onSortChange(value as ThreadSort),
        onDirectionChange: onSortDirectionChange,
      }}
      groupBy="none"
      groupOptions={[]}
      savedViewsStorageKey="uok_communications_saved_search_views"
      onChange={onQueryChange}
      onGroupByChange={() => undefined}
      onClear={onClear}
    />}
    secondaryActions={<WorkspaceActionsMenu items={[
      { id: "refresh", action: "refresh", loading: refreshing, disabled: operationBusy && !refreshing, onSelect: onRefresh },
    ]} />}
    primaryAction={canCreate ? <WorkspaceActionButton
      action="create" labelKey="command.newThread" fallbackLabel="New thread" primary
      disabled={operationBusy} onClick={onOpenCreate}
    /> : null}
  />;
}

export function CommunicationsThreadCreator({
  open, title, creating, operationBusy, onTitleChange, onClose, onSubmit,
}: {
  open: boolean;
  title: string;
  creating: boolean;
  operationBusy: boolean;
  onTitleChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return <WorkspaceEditorPopup
    open={open}
    label="Create communication thread"
    title="New thread"
    description="Create a governed organization thread without leaving K Connect."
    onClose={() => { if (!creating) onClose(); }}
  >
    <form className="communications-create-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <label className="field"><span>Thread title</span><input
        autoFocus value={title} maxLength={180} onChange={(event) => onTitleChange(event.target.value)}
      /></label>
      <div className="communications-create-actions">
        <WorkspaceActionButton action="cancel" disabled={creating} onClick={onClose} />
        <WorkspaceActionButton
          action="create" labelKey="command.createThread" fallbackLabel="Create thread" type="submit"
          primary loading={creating} disabled={operationBusy && !creating || title.trim().length < 2}
        />
      </div>
    </form>
  </WorkspaceEditorPopup>;
}
