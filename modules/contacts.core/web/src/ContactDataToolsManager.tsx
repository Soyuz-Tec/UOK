import { useEffect, useMemo, useState } from "react";
import { DatabaseZap, FileUp, Fingerprint, GitCompareArrows, ListChecks, Puzzle, ShieldCheck, UsersRound } from "lucide-react";

import { useUokLocalization } from "@uok/shared/localization";
import { WorkspaceEditorPopup } from "@uok/shared/overlays";
import type { ContactGroupRecord, ContactRecord } from "./contracts";
import { createContactDataToolsApi } from "./contactDataToolsApi";
import { ContactConsentToolsPanel } from "./ContactConsentToolsPanel";
import { ContactCustomFieldsToolsPanel } from "./ContactCustomFieldsToolsPanel";
import { ContactDuplicateToolsPanel } from "./ContactDuplicateToolsPanel";
import { ContactExchangeToolsPanel } from "./ContactExchangeToolsPanel";
import { ContactFactsToolsPanel } from "./ContactFactsToolsPanel";
import { ContactInteroperabilityToolsPanel } from "./ContactInteroperabilityToolsPanel";
import { ContactTeamsToolsPanel } from "./ContactTeamsToolsPanel";
import type { ContactDataToolsPanelProps, ContactDataToolsRun } from "./contactDataToolsUi";

type DataToolId = "facts" | "consent" | "teams" | "exchange" | "duplicates" | "custom" | "interoperability";

const tools: Array<{ id: DataToolId; label: string; icon: typeof DatabaseZap }> = [
  { id: "facts", label: "Contact facts", icon: ListChecks },
  { id: "consent", label: "Consent history", icon: ShieldCheck },
  { id: "teams", label: "Contact teams", icon: UsersRound },
  { id: "exchange", label: "Import, export and bulk", icon: FileUp },
  { id: "duplicates", label: "Duplicate review", icon: GitCompareArrows },
  { id: "custom", label: "Custom fields", icon: Fingerprint },
  { id: "interoperability", label: "Interoperability", icon: Puzzle },
];

export function ContactDataToolsManager({
  open,
  token,
  currentUserRole,
  contacts,
  groups,
  selectedContact,
  onClose,
  onChanged,
}: {
  open: boolean;
  token: string;
  currentUserRole: string;
  contacts: ContactRecord[];
  groups: ContactGroupRecord[];
  selectedContact: ContactRecord | null;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const { t } = useUokLocalization();
  const api = useMemo(() => createContactDataToolsApi(token), [token]);
  const [activeTool, setActiveTool] = useState<DataToolId>("facts");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canGovern = currentUserRole === "platform_admin" || currentUserRole === "ops_manager";
  const canRestore = canGovern;

  useEffect(() => {
    if (!open) return;
    setError("");
    setNotice("");
    setSelectedIds(selectedContact ? [selectedContact.id] : []);
  }, [open, selectedContact?.id]);

  const run: ContactDataToolsRun = async (action, operation, successMessage) => {
    setBusyAction(action);
    setError("");
    setNotice("");
    try {
      const result = await operation();
      if (successMessage) setNotice(successMessage);
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("contacts.dataTools.failed", "The governed Contacts action failed."));
      return undefined;
    } finally {
      setBusyAction("");
    }
  };

  const panelProps: ContactDataToolsPanelProps = {
    api,
    canGovern,
    canRestore,
    contacts,
    groups,
    selectedContact,
    selectedIds,
    busyAction,
    run,
    onChanged,
    onSelectedIdsChange: setSelectedIds,
  };

  if (!open) return null;

  return (
    <WorkspaceEditorPopup
      open={open}
      label={t("contacts.dataTools.title", "Contacts data and governance")}
      title={t("contacts.dataTools.title", "Contacts data and governance")}
      description={t("contacts.dataTools.description", "Manage governed contact data without adding another permanent command bar.")}
      onClose={onClose}
      dismissible={!busyAction}
      size="wide"
      className="contact-data-tools-popup"
    >
      <div className="contact-data-tools-shell" aria-busy={Boolean(busyAction) || undefined}>
        <nav className="contact-data-tools-nav" aria-label={t("contacts.dataTools.navigation", "Data and governance tools") }>
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                type="button"
                key={tool.id}
                className={activeTool === tool.id ? "selected" : ""}
                aria-current={activeTool === tool.id ? "page" : undefined}
                onClick={() => {
                  setActiveTool(tool.id);
                  setError("");
                  setNotice("");
                }}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{toolLabel(tool.id, tool.label, t)}</span>
              </button>
            );
          })}
        </nav>
        <main className="contact-data-tools-main">
          {!canGovern ? (
            <p className="contact-data-tools-permission" role="note">
              {t("contacts.dataTools.readOnly", "Your role has read-only access. Controls requiring Contacts governance permissions are disabled.")}
            </p>
          ) : null}
          {error ? <p className="contact-data-tools-error" role="alert">{error}</p> : null}
          <p className="visually-hidden" aria-live="polite">{notice}</p>
          {notice ? <p className="contact-data-tools-notice" role="status">{notice}</p> : null}
          {activeTool === "facts" ? <ContactFactsToolsPanel {...panelProps} /> : null}
          {activeTool === "consent" ? <ContactConsentToolsPanel {...panelProps} /> : null}
          {activeTool === "teams" ? <ContactTeamsToolsPanel {...panelProps} /> : null}
          {activeTool === "exchange" ? <ContactExchangeToolsPanel {...panelProps} /> : null}
          {activeTool === "duplicates" ? <ContactDuplicateToolsPanel {...panelProps} /> : null}
          {activeTool === "custom" ? <ContactCustomFieldsToolsPanel {...panelProps} /> : null}
          {activeTool === "interoperability" ? <ContactInteroperabilityToolsPanel {...panelProps} /> : null}
        </main>
      </div>
    </WorkspaceEditorPopup>
  );
}

function toolLabel(id: DataToolId, fallback: string, t: (key: string, fallback?: string) => string) {
  return t(`contacts.dataTools.${id}`, fallback);
}
