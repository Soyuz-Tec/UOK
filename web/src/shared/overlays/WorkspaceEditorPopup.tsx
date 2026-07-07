import type { ReactNode } from "react";

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
  className = ""
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
}) {
  return (
    <WorkspacePopup open={open} label={label} onClose={onClose} size={size} className={`workspace-editor-popup workspace-editor-popup-${chrome} ${className}`.trim()}>
      {chrome === "standard" ? (
        <header className="workspace-editor-popup-header">
          <p className="eyebrow">Workspace editor</p>
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
