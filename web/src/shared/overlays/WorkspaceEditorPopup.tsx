import type { ReactNode } from "react";

import { useUokLocalization } from "../localization";
import { WorkspacePopup } from "./WorkspacePopup";

export function WorkspaceEditorPopup({
  open,
  label,
  title,
  description,
  onClose,
  children,
  size = "wide",
  chrome = "standard",
  className = "",
  dismissible = true
}: {
  open: boolean;
  label: string;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "compact" | "default" | "wide";
  chrome?: "standard" | "minimal";
  className?: string;
  dismissible?: boolean;
}) {
  const { t } = useUokLocalization();

  return (
    <WorkspacePopup
      open={open}
      label={label}
      onClose={onClose}
      size={size}
      className={`workspace-editor-popup workspace-editor-popup-${chrome} ${className}`.trim()}
      dismissible={dismissible}
    >
      {chrome === "standard" ? (
        <header className="workspace-editor-popup-header">
          <p className="eyebrow">{t("command.workspaceEditor", "Workspace editor")}</p>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </header>
      ) : null}
      <div className="workspace-editor-popup-body">
        {children}
      </div>
    </WorkspacePopup>
  );
}
