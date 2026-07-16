import type { CommunicationThread } from "./types";

export type ThreadSort = "updated" | "title";
export type ThreadSortDirection = "asc" | "desc";

export function filterAndSortThreads(threads: CommunicationThread[], options: {
  contextFilter: string;
  query: string;
  sortBy: ThreadSort;
  sortDirection: ThreadSortDirection;
  statusFilter: string;
}) {
  const normalizedQuery = options.query.trim().toLocaleLowerCase();
  const direction = options.sortDirection === "asc" ? 1 : -1;
  return threads
    .filter((thread) => {
      if (options.statusFilter === "active" && thread.status === "archived") return false;
      if (!["active", "all"].includes(options.statusFilter) && thread.status !== options.statusFilter) return false;
      if (options.contextFilter !== "all" && thread.context_type !== options.contextFilter) return false;
      if (!normalizedQuery) return true;
      return `${thread.title} ${thread.context_type} ${thread.context_id || ""}`.toLocaleLowerCase().includes(normalizedQuery);
    })
    .sort((left, right) => {
      const comparison = options.sortBy === "title"
        ? left.title.localeCompare(right.title)
        : left.updated_at.localeCompare(right.updated_at);
      return direction * (comparison || left.title.localeCompare(right.title));
    });
}

export function threadOptions(
  threads: CommunicationThread[],
  field: "status" | "context_type",
  allLabel: string,
) {
  const values = Array.from(new Set(threads.map((thread) => thread[field]))).sort();
  return [{ value: "all", label: allLabel }, ...values.map((value) => ({
    value,
    label: value.replaceAll("_", " "),
  }))];
}
