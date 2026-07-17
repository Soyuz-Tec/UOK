import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { WorkspaceActionButton, WorkspaceActionsMenu } from "@uok/shared/actions";
import { EmptyState } from "@uok/shared/data-display";
import { SearchWorkspace } from "@uok/shared/forms";
import { WorkflowSplitView, WorkspaceCommandBar } from "@uok/shared/layout";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import { ComplianceDocumentTypeDetail } from "./ComplianceDocumentTypeDetail";
import { ComplianceDocumentTypeEditor } from "./ComplianceDocumentTypeEditor";
import { ComplianceDocumentTypeTable } from "./ComplianceDocumentTypeTable";
import { ComplianceModuleState } from "./ComplianceModuleState";
import { COMPLIANCE_MODULE_ID } from "./complianceModule";
import type {
  ComplianceDocumentTypeSort,
  ComplianceDocumentTypeStatusFilter,
} from "./types";
import { useComplianceDocumentTypeWorkspace } from "./useComplianceDocumentTypeWorkspace";

export function ComplianceDocumentTypeWorkspace({
  host,
}: {
  host: ModuleSurfaceHostContext;
}) {
  const module = host.moduleRows.find((row) => row.name === COMPLIANCE_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const canManage = ["platform_admin", "ops_manager", "trader"].includes(
    host.currentUserRole,
  );
  const workspace = useComplianceDocumentTypeWorkspace(host, operational);

  if (!host.token) {
    return <EmptyState text="Sign in to open Compliance Document Types." />;
  }
  if (!operational) return <ComplianceModuleState module={module} host={host} />;

  return (
    <section
      className="compliance-document-type-workspace"
      aria-label="Compliance Document Types"
    >
      <WorkspaceCommandBar
        label="Compliance Document Types controls"
        query={(
          <SearchWorkspace
            label="Search compliance document types"
            value={workspace.query}
            placeholder="Search document types"
            defaultSummaryLabel="Current document types"
            filters={[
              {
                id: "status",
                label: "Status",
                value: workspace.statusFilter,
                defaultValue: "current",
                options: statusOptions,
                onChange: (value) => workspace.setStatusFilter(
                  value as ComplianceDocumentTypeStatusFilter,
                ),
              },
              {
                id: "category",
                label: "Category",
                value: workspace.categoryFilter,
                defaultValue: "all",
                options: [
                  { value: "all", label: "All categories" },
                  ...workspace.categories.map((category) => ({
                    value: category,
                    label: category,
                  })),
                ],
                onChange: workspace.setCategoryFilter,
              },
            ]}
            sort={{
              label: "Document type sort field",
              value: workspace.sortBy,
              defaultValue: "code",
              options: [
                { value: "code", label: "Code" },
                { value: "name", label: "Name" },
                { value: "category", label: "Category" },
              ],
              direction: workspace.sortDirection,
              defaultDirection: "asc",
              onChange: (value) => workspace.setSortBy(
                value as ComplianceDocumentTypeSort,
              ),
              onDirectionChange: workspace.setSortDirection,
            }}
            groupBy="none"
            groupOptions={[]}
            savedViewsStorageKey="uok_compliance_document_type_saved_search_views"
            onChange={workspace.setQuery}
            onGroupByChange={() => undefined}
            onClear={() => {
              workspace.setQuery("");
              workspace.setStatusFilter("current");
              workspace.setCategoryFilter("all");
            }}
          />
        )}
        secondaryActions={(
          <WorkspaceActionsMenu items={[{
            id: "refresh",
            action: "refresh",
            loading: workspace.busyAction === "refresh",
            disabled: Boolean(workspace.activeOperation.current),
            onSelect: () => void workspace.refreshDocumentTypes(),
          }]} />
        )}
        primaryAction={canManage ? (
          <WorkspaceActionButton
            action="create"
            labelKey="command.newComplianceDocumentType"
            fallbackLabel="New document type"
            primary
            disabled={Boolean(workspace.busyAction)}
            onClick={() => workspace.openEditor("create")}
          />
        ) : null}
      />
      <p className="compliance-document-type-status" role="status">
        {workspace.status}
      </p>
      <WorkflowSplitView
        primaryLabel="Compliance document type registry"
        secondaryLabel="Compliance document type details"
        primary={(
          <ComplianceDocumentTypeTable
            documentTypes={workspace.documentTypes}
            selectedId={workspace.selectedId}
            onSelect={workspace.setSelectedId}
          />
        )}
        secondary={(
          <ComplianceDocumentTypeDetail
            documentType={workspace.selected}
            history={workspace.history}
            historyLoading={workspace.historyLoading}
            busyAction={workspace.busyAction}
            canManage={canManage}
            onEdit={() => workspace.openEditor("edit")}
            onLifecycle={(action, reason) => void workspace.runLifecycle(action, reason)}
          />
        )}
      />
      <WorkspaceEditorPopup
        open={workspace.editorMode !== null}
        label={workspace.editorMode === "create"
          ? "Create compliance document type"
          : "Edit compliance document type"}
        title={workspace.editorMode === "create" ? "New document type" : "Edit document type"}
        description="Govern tenant-approved document vocabulary without creating files or shipment rules."
        dismissible={!workspace.activeOperation.current}
        onClose={workspace.closeEditor}
      >
        {workspace.editorMode ? (
          <ComplianceDocumentTypeEditor
            mode={workspace.editorMode}
            documentType={workspace.editorMode === "edit" ? workspace.selected : null}
            busy={["create", "update"].includes(workspace.busyAction)}
            error={workspace.editorError}
            onCancel={workspace.closeEditor}
            onSubmit={(draft) => void workspace.saveDocumentType(
              workspace.editorMode!,
              draft,
            )}
          />
        ) : null}
      </WorkspaceEditorPopup>
    </section>
  );
}

const statusOptions = [
  { value: "current", label: "Active and inactive" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All statuses" },
];
