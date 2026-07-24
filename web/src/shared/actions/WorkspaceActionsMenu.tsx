import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";

import { ExpandableControlPanel } from "../forms/ExpandableControlPanel";
import { useUokLocalization } from "../localization";
import { WorkspaceActionButton, type WorkspaceActionKind } from "./WorkspaceActionButton";

export type WorkspaceActionsMenuItem = {
  id: string;
  action: WorkspaceActionKind;
  label?: ReactNode;
  labelKey?: string;
  fallbackLabel?: string;
  loadingLabel?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  loading?: boolean;
  destructive?: boolean;
};

export function WorkspaceActionsMenu({
  items,
  label,
  className = "",
  onOpenChange,
}: {
  items: readonly WorkspaceActionsMenuItem[];
  label?: string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useUokLocalization();
  const accessibleLabel = label ?? t("command.moreActions", "More actions");

  return (
    <ExpandableControlPanel
      className={["workspace-actions-menu", className].filter(Boolean).join(" ")}
      panelClassName="workspace-actions-menu-panel"
      label={accessibleLabel}
      triggerIcon={MoreHorizontal}
      triggerLabel={accessibleLabel}
      triggerSummary={t("command.more", "More")}
      onOpenChange={onOpenChange}
    >
      {({ close }) => (
        <div className="workspace-actions-menu-list" role="group" aria-label={accessibleLabel}>
          {items.map((item) => (
            <WorkspaceActionButton
              key={item.id}
              action={item.action}
              labelKey={item.labelKey}
              fallbackLabel={item.fallbackLabel}
              disabled={item.disabled}
              loading={item.loading}
              loadingLabel={item.loadingLabel}
              destructive={item.destructive}
              onClick={() => {
                close();
                queueMicrotask(item.onSelect);
              }}
            >
              {item.label}
            </WorkspaceActionButton>
          ))}
        </div>
      )}
    </ExpandableControlPanel>
  );
}
