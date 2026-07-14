import { AtSign, Layers3, Plus, RefreshCw } from "lucide-react";

import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ManagedContactGroup } from "./contactGroupsManagerApi";

export type ContactGroupKindFilter = "all" | "manual" | "generated";
export type ContactGroupStatusFilter = "active" | "archived";

export function ContactGroupsManagerList({
  groups,
  selectedGroupId,
  search,
  kindFilter,
  statusFilter,
  emptyOnly,
  canManage,
  busyAction,
  onSearchChange,
  onKindFilterChange,
  onStatusFilterChange,
  onEmptyOnlyChange,
  onSelect,
  onStartCreate,
  onGenerateBusinessDomains,
  onGenerateSmartGroups
}: {
  groups: ManagedContactGroup[];
  selectedGroupId: string;
  search: string;
  kindFilter: ContactGroupKindFilter;
  statusFilter: ContactGroupStatusFilter;
  emptyOnly: boolean;
  canManage: boolean;
  busyAction: string;
  onSearchChange: (value: string) => void;
  onKindFilterChange: (value: ContactGroupKindFilter) => void;
  onStatusFilterChange: (value: ContactGroupStatusFilter) => void;
  onEmptyOnlyChange: (value: boolean) => void;
  onSelect: (value: string) => void;
  onStartCreate: () => void;
  onGenerateBusinessDomains: () => void;
  onGenerateSmartGroups: () => void;
}) {
  const { t, formatNumber } = useUokLocalization();
  const filteredGroups = filterContactGroups(groups, search, kindFilter, statusFilter, emptyOnly);
  const manualCount = groups.filter((group) => group.kind === "manual").length;
  const generatedCount = groups.length - manualCount;
  const emptyCount = groups.filter((group) => group.member_count === 0).length;

  return (
    <section className="contact-groups-manager-list" aria-label={t("contacts.groups.list", "Contact group list")}>
      <div className="contact-groups-manager-list-heading">
        <div>
          <h3>{t("contacts.groups.title", "Groups")}</h3>
          <p>{t("contacts.groups.summary", "Organize working sets without duplicating contact facts.")}</p>
        </div>
        <CommandButton icon={Plus} onClick={onStartCreate} disabled={!canManage || Boolean(busyAction)}>
          {t("contacts.groups.new", "New group")}
        </CommandButton>
      </div>

      <dl className="contact-groups-manager-counts" aria-label={t("contacts.groups.counts", "Group counts")}>
        <GroupCount label={t("contacts.groups.manual", "Manual")} value={manualCount} format={formatNumber} />
        <GroupCount label={t("contacts.groups.generated", "Generated")} value={generatedCount} format={formatNumber} />
        <GroupCount label={t("contacts.groups.empty", "Empty")} value={emptyCount} format={formatNumber} />
      </dl>

      <div className="contact-groups-manager-filters">
        <label className="field">
          <span>{t("contacts.groups.find", "Find groups")}</span>
          <input value={search} type="search" onChange={(event) => onSearchChange(event.target.value)} />
        </label>
        <label className="field">
          <span>{t("contacts.groups.kind", "Group type")}</span>
          <select value={kindFilter} onChange={(event) => onKindFilterChange(event.target.value as ContactGroupKindFilter)}>
            <option value="all">{t("contacts.groups.allKinds", "All types")}</option>
            <option value="manual">{t("contacts.groups.manual", "Manual")}</option>
            <option value="generated">{t("contacts.groups.generated", "Generated")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("contacts.groups.status", "Status")}</span>
          <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as ContactGroupStatusFilter)}>
            <option value="active">{t("contacts.groups.active", "Active")}</option>
            <option value="archived">{t("contacts.groups.archived", "Archived")}</option>
          </select>
        </label>
        <label className="contact-groups-manager-empty-filter">
          <input type="checkbox" checked={emptyOnly} onChange={(event) => onEmptyOnlyChange(event.target.checked)} />
          <span>{t("contacts.groups.emptyOnly", "Empty groups only")}</span>
        </label>
      </div>

      <div className="contact-groups-manager-rows" role="list">
        {filteredGroups.length ? filteredGroups.map((group) => (
          <div role="listitem" key={group.id}>
            <button
              type="button"
              className={group.id === selectedGroupId ? "contact-groups-manager-row selected" : "contact-groups-manager-row"}
              aria-current={group.id === selectedGroupId ? "true" : undefined}
              disabled={Boolean(busyAction)}
              onClick={() => onSelect(group.id)}
            >
              <span className="contact-groups-manager-row-main">
                <strong dir="auto">{group.name}</strong>
                <small>{group.kind === "manual" ? t("contacts.groups.manual", "Manual") : t("contacts.groups.generated", "Generated")}</small>
              </span>
              <span className="contact-groups-manager-member-count">
                {formatNumber(group.active_member_count ?? group.member_count)} {t("contacts.groups.members", "members")}
              </span>
            </button>
          </div>
        )) : <EmptyState text={t("contacts.groups.noMatch", "No groups match these filters.")} />}
      </div>

      <section className="contact-groups-manager-generation" aria-label={t("contacts.groups.generation", "Generated group refresh")}>
        <h4><RefreshCw size={16} aria-hidden="true" /> {t("contacts.groups.refreshGenerated", "Refresh generated groups")}</h4>
        <p>{t("contacts.groups.refreshGeneratedHint", "Reconcile generated groups from current contact facts. Their membership remains read-only.")}</p>
        <div>
          <CommandButton icon={AtSign} onClick={onGenerateBusinessDomains} disabled={!canManage || Boolean(busyAction)} loading={busyAction === "generate-domains"}>
            {t("contacts.groups.businessDomains", "Business domains")}
          </CommandButton>
          <CommandButton icon={Layers3} onClick={onGenerateSmartGroups} disabled={!canManage || Boolean(busyAction)} loading={busyAction === "generate-smart"}>
            {t("contacts.groups.smartGroups", "Smart groups")}
          </CommandButton>
        </div>
      </section>
    </section>
  );
}

function filterContactGroups(groups: ManagedContactGroup[], search: string, kind: ContactGroupKindFilter, status: ContactGroupStatusFilter, emptyOnly: boolean) {
  const query = search.trim().toLocaleLowerCase();
  return groups.filter((group) => {
    if (group.status !== status) return false;
    if (kind === "manual" && group.kind !== "manual") return false;
    if (kind === "generated" && group.kind === "manual") return false;
    if (emptyOnly && group.member_count !== 0) return false;
    return !query || `${group.name} ${group.description || ""}`.toLocaleLowerCase().includes(query);
  });
}

function GroupCount({ label, value, format }: { label: string; value: number; format: (value: number) => string }) {
  return <div><dt>{label}</dt><dd>{format(value)}</dd></div>;
}
