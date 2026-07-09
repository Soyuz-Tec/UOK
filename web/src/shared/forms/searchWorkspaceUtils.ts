import type { SearchWorkspaceOption } from "./SearchWorkspace.types";

export function optionLabel(options: SearchWorkspaceOption[], value: string) {
  return options.find((option) => option.value === value)?.label || value;
}
