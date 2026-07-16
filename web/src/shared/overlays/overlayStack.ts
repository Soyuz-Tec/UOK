const openWorkspaceOverlays: string[] = [];

export function registerWorkspaceOverlay(id: string) {
  const existing = openWorkspaceOverlays.indexOf(id);
  if (existing >= 0) openWorkspaceOverlays.splice(existing, 1);
  openWorkspaceOverlays.push(id);

  return () => {
    const index = openWorkspaceOverlays.lastIndexOf(id);
    if (index >= 0) openWorkspaceOverlays.splice(index, 1);
  };
}

export function isTopWorkspaceOverlay(id: string) {
  return openWorkspaceOverlays.at(-1) === id;
}

export function hasOpenWorkspaceOverlay() {
  return openWorkspaceOverlays.length > 0;
}
