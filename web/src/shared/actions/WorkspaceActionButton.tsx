import {
  ArrowRightLeft,
  Download,
  FolderOpen,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { useUokLocalization } from "../localization";
import { CommandButton, type CommandButtonProps } from "../primitives/CommandButton";

export type WorkspaceActionKind =
  | "open"
  | "close"
  | "create"
  | "delete"
  | "edit"
  | "move"
  | "save"
  | "cancel"
  | "search"
  | "export"
  | "print"
  | "refresh";

type WorkspaceActionDefinition = {
  icon: LucideIcon;
  labelKey: string;
  fallbackLabel: string;
};

const workspaceActionDefinitions: Record<WorkspaceActionKind, WorkspaceActionDefinition> = {
  open: { icon: FolderOpen, labelKey: "command.open", fallbackLabel: "Open" },
  close: { icon: X, labelKey: "command.close", fallbackLabel: "Close" },
  create: { icon: Plus, labelKey: "command.create", fallbackLabel: "Create" },
  delete: { icon: Trash2, labelKey: "command.delete", fallbackLabel: "Delete" },
  edit: { icon: Pencil, labelKey: "command.edit", fallbackLabel: "Edit" },
  move: { icon: ArrowRightLeft, labelKey: "command.move", fallbackLabel: "Move" },
  save: { icon: Save, labelKey: "command.save", fallbackLabel: "Save" },
  cancel: { icon: X, labelKey: "command.cancel", fallbackLabel: "Cancel" },
  search: { icon: Search, labelKey: "command.search", fallbackLabel: "Search" },
  export: { icon: Download, labelKey: "command.export", fallbackLabel: "Export" },
  print: { icon: Printer, labelKey: "command.print", fallbackLabel: "Print" },
  refresh: { icon: RefreshCw, labelKey: "command.refresh", fallbackLabel: "Refresh" },
};

export type WorkspaceActionButtonProps = Omit<
  CommandButtonProps,
  "children" | "data-command" | "icon"
> & {
  action: WorkspaceActionKind;
  children?: ReactNode;
  labelKey?: string;
  fallbackLabel?: string;
};

export function WorkspaceActionButton({
  action,
  children,
  className = "",
  destructive,
  labelKey,
  fallbackLabel,
  ...buttonProps
}: WorkspaceActionButtonProps) {
  const { t } = useUokLocalization();
  const definition = workspaceActionDefinitions[action];

  return (
    <CommandButton
      {...buttonProps}
      icon={definition.icon}
      className={["workspace-action-button", className].filter(Boolean).join(" ")}
      data-command={action}
      destructive={destructive ?? action === "delete"}
    >
      {labelKey
        ? t(labelKey, fallbackLabel ?? definition.fallbackLabel)
        : children ?? t(definition.labelKey, definition.fallbackLabel)}
    </CommandButton>
  );
}
