export type SearchWorkspaceOption = {
  value: string;
  label: string;
};

export type SearchWorkspaceFilter = {
  id: string;
  label: string;
  value: string;
  defaultValue: string;
  options: SearchWorkspaceOption[];
  onChange: (value: string) => void;
};

export type SearchWorkspaceSortDirection = "asc" | "desc";

export type SearchWorkspaceSort = {
  label: string;
  value: string;
  defaultValue: string;
  options: SearchWorkspaceOption[];
  direction: SearchWorkspaceSortDirection;
  defaultDirection: SearchWorkspaceSortDirection;
  fieldLabel?: string;
  directionLabel?: string;
  onChange: (value: string) => void;
  onDirectionChange: (value: SearchWorkspaceSortDirection) => void;
};

export type SearchWorkspaceChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

export type SavedSearchView = {
  id: string;
  name: string;
  query: string;
  filters: Record<string, string>;
  groupBy: string;
  sortBy?: string;
  sortDir?: SearchWorkspaceSortDirection;
};
