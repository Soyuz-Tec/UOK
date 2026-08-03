import { useEffect, useState } from "react";
import { GitMerge, History, Link2, NotebookText, RefreshCw, ShieldCheck, Tags, UsersRound } from "lucide-react";

import { EmptyState } from "@uok/shared/data-display";
import { formatLabel } from "@uok/shared/format";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import { PaginationControls } from "@uok/shared/tables";
import type { ContactReadBoundary } from "./app/contactReadAuthority";
import type { ContactActivityRecord } from "./contactActivityApi";
import { useContactActivity } from "./useContactActivity";

const activityPageSizes = [10, 25, 50];

export function ContactActivityTimeline({
  boundary,
  onUnauthorized,
  contactId,
  contactRevision,
  refreshGeneration,
}: {
  boundary: ContactReadBoundary;
  onUnauthorized: () => void;
  contactId: string;
  contactRevision: string;
  refreshGeneration?: string | number;
}) {
  const { formatDate, t } = useUokLocalization();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(activityPageSizes[0]);
  const activity = useContactActivity({
    boundary,
    onUnauthorized,
    partyId: contactId,
    contactRevision,
    page,
    pageSize,
    refreshGeneration,
  });

  useEffect(() => setPage(0), [contactId]);

  return (
    <section className="contact-activity-timeline" aria-label={t("contacts.activity.timeline", "Contact activity timeline")} aria-busy={activity.loading}>
      <div>
        <p className="eyebrow">{t("contacts.activity.eyebrow", "Timeline")}</p>
        <h3>{t("contacts.activity.title", "Activity history")}</h3>
        <p>{t("contacts.activity.description", "Server-recorded changes to this contact, newest first.")}</p>
      </div>
      {activity.loading ? <p role="status">{t("contacts.activity.loading", "Loading activity...")}</p> : null}
      {activity.error ? (
        <div className="contact-activity-error" role="alert">
          <p>{activity.error}</p>
          <CommandButton icon={RefreshCw} onClick={activity.retry}>{t("command.refresh", "Refresh")}</CommandButton>
        </div>
      ) : null}
      {!activity.loading && !activity.error && !activity.items.length ? (
        <EmptyState text={t("contacts.activity.empty", "No recorded activity yet.")} />
      ) : null}
      {activity.items.length ? (
        <div className="contact-timeline-list">
          {activity.items.map((item) => <ActivityItem key={item.id} item={item} />)}
        </div>
      ) : null}
      {activity.totalCount > activityPageSizes[0] ? (
        <PaginationControls
          label={t("contacts.activity.paging", "Activity paging")}
          page={page}
          pageSize={pageSize}
          pageSizeLabel={t("contacts.activity.pageSize", "Activity page size")}
          pageSizeOptions={activityPageSizes}
          visibleCount={activity.items.length}
          totalCount={activity.totalCount}
          hasNext={(page + 1) * pageSize < activity.totalCount}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPage(0);
            setPageSize(value);
          }}
        />
      ) : null}
    </section>
  );

  function ActivityItem({ item }: { item: ContactActivityRecord }) {
    const Icon = activityIcon(item.activity_type);
    const detail = activityDetail(item);
    const actor = item.actor_user_id
      ? t("contacts.activity.userAction", "User action")
      : t("contacts.activity.systemAction", "System action");
    return (
      <article className="contact-timeline-item">
        <span className="contact-timeline-icon"><Icon size={18} aria-hidden="true" /></span>
        <div>
          <strong>{item.summary || formatLabel(item.activity_type)}</strong>
          <p>{detail}</p>
          <small>{actor} · {formatDate(item.occurred_at)}</small>
        </div>
      </article>
    );
  }
}

function activityIcon(activityType: string) {
  const normalized = activityType.toLocaleLowerCase();
  if (normalized.includes("relationship")) return Link2;
  if (normalized.includes("group")) return UsersRound;
  if (normalized.includes("duplicate") || normalized.includes("merge")) return GitMerge;
  if (normalized.includes("note")) return NotebookText;
  if (normalized.includes("consent")) return ShieldCheck;
  if (normalized.includes("tag")) return Tags;
  return History;
}

function activityDetail(item: ContactActivityRecord) {
  const details = Object.entries(item.payload || {})
    .filter(([key, value]) => !key.endsWith("_id") && ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 3)
    .map(([key, value]) => `${formatLabel(key)}: ${String(value)}`);
  return details.length ? details.join(" · ") : formatLabel(item.object_type || item.activity_type);
}
