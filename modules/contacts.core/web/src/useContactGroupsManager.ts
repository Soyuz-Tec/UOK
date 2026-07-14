import { useCallback, useEffect, useMemo, useState } from "react";

import { useUokLocalization } from "@uok/shared/localization";
import {
  createContactGroupsManagerApi,
  type ContactGroupMemberRow,
  type ManagedContactGroup
} from "./contactGroupsManagerApi";

export type ContactGroupManagerNotice =
  | "created"
  | "updated"
  | "archived"
  | "restored"
  | "memberAdded"
  | "memberRemoved"
  | "generated";

export function useContactGroupsManager({
  token,
  open,
  canManage,
  onChanged,
  onGroupArchived
}: {
  token: string;
  open: boolean;
  canManage: boolean;
  onChanged: () => Promise<void> | void;
  onGroupArchived: (groupId: string) => void;
}) {
  const { t } = useUokLocalization();
  const fallbackError = t("contacts.groups.error", "Contact groups could not be updated.");
  const api = useMemo(() => createContactGroupsManagerApi(token), [token]);
  const [groups, setGroups] = useState<ManagedContactGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [members, setMembers] = useState<ContactGroupMemberRow[]>([]);
  const [candidates, setCandidates] = useState<ContactGroupMemberRow[]>([]);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<ContactGroupManagerNotice | "">("");

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;

  const refreshGroups = useCallback(async (preferredGroupId = "") => {
    const rows = await api.groups();
    setGroups(rows);
    setSelectedGroupId((current) => {
      const preferred = preferredGroupId || current;
      if (preferred && rows.some((row) => row.id === preferred)) return preferred;
      return rows.find((row) => row.status === "active")?.id || rows[0]?.id || "";
    });
    return rows;
  }, [api]);

  const refreshMembers = useCallback(async (group: ManagedContactGroup | null) => {
    if (!group || group.status === "archived") {
      setMembers([]);
      return;
    }
    setMembers(await api.members(group.id));
  }, [api]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError("");
    setNotice("");
    void refreshGroups()
      .catch((reason) => active && setError(errorMessage(reason, fallbackError)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [fallbackError, open, refreshGroups]);

  useEffect(() => {
    if (!open || creating) return;
    setName(selectedGroup?.name || "");
    setDescription(selectedGroup?.description || "");
    setError("");
    void refreshMembers(selectedGroup).catch((reason) => setError(errorMessage(reason, fallbackError)));
  }, [creating, fallbackError, open, refreshMembers, selectedGroup?.description, selectedGroup?.id, selectedGroup?.kind, selectedGroup?.name, selectedGroup?.status]);

  useEffect(() => {
    if (!open || !canManage || creating || selectedGroup?.kind !== "manual" || selectedGroup.status === "archived") {
      setCandidates([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void api.candidates(candidateQuery.trim())
        .then((rows) => active && setCandidates(rows))
        .catch((reason) => active && setError(errorMessage(reason, fallbackError)));
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [api, canManage, candidateQuery, creating, fallbackError, open, selectedGroup?.id, selectedGroup?.kind, selectedGroup?.status]);

  const perform = useCallback(async (action: string, nextNotice: ContactGroupManagerNotice, operation: () => Promise<void>) => {
    setBusyAction(action);
    setError("");
    setNotice("");
    try {
      await operation();
      setNotice(nextNotice);
      await onChanged();
    } catch (reason) {
      setError(errorMessage(reason, fallbackError));
    } finally {
      setBusyAction("");
    }
  }, [fallbackError, onChanged]);

  const startCreate = () => {
    setCreating(true);
    setSelectedGroupId("");
    setName("");
    setDescription("");
    setMembers([]);
    setError("");
    setNotice("");
  };

  const cancelCreate = () => {
    setCreating(false);
    setSelectedGroupId(groups.find((group) => group.status === "active")?.id || groups[0]?.id || "");
  };

  const createGroup = () => perform("create", "created", async () => {
    const group = await api.create({ name: name.trim(), description: description.trim() || undefined });
    await refreshGroups(group.id);
    setCreating(false);
  });

  const updateGroup = () => selectedGroup && perform("update", "updated", async () => {
    await api.update(selectedGroup.id, { name: name.trim(), description: description.trim() });
    await refreshGroups(selectedGroup.id);
  });

  const archiveGroup = () => selectedGroup && perform("archive", "archived", async () => {
    await api.archive(selectedGroup.id);
    onGroupArchived(selectedGroup.id);
    await refreshGroups(selectedGroup.id);
    setMembers([]);
  });

  const restoreGroup = () => selectedGroup && perform("restore", "restored", async () => {
    const restored = await api.restore(selectedGroup.id);
    await refreshGroups(restored.id);
    await refreshMembers(restored);
  });

  const addMember = (partyId: string) => selectedGroup && perform("add-member", "memberAdded", async () => {
    await api.addMember(selectedGroup.id, partyId);
    await refreshGroups(selectedGroup.id);
    await refreshMembers(selectedGroup);
  });

  const removeMember = (partyId: string) => selectedGroup && perform(`remove-member:${partyId}`, "memberRemoved", async () => {
    await api.removeMember(selectedGroup.id, partyId);
    await refreshGroups(selectedGroup.id);
    await refreshMembers(selectedGroup);
  });

  const generateBusinessDomains = () => perform("generate-domains", "generated", async () => {
    await api.generateBusinessDomains();
    const rows = await refreshGroups(selectedGroupId);
    await refreshMembers(rows.find((row) => row.id === selectedGroupId) || null);
  });

  const generateSmartGroups = () => perform("generate-smart", "generated", async () => {
    await api.generateSmartGroups();
    const rows = await refreshGroups(selectedGroupId);
    await refreshMembers(rows.find((row) => row.id === selectedGroupId) || null);
  });

  return {
    addMember,
    archiveGroup,
    busyAction,
    cancelCreate,
    candidateQuery,
    candidates,
    createGroup,
    creating,
    description,
    error,
    generateBusinessDomains,
    generateSmartGroups,
    groups,
    loading,
    members,
    name,
    notice,
    removeMember,
    restoreGroup,
    selectedGroup,
    selectedGroupId,
    setCandidateQuery,
    setDescription,
    setName,
    setSelectedGroupId: (value: string) => {
      setCreating(false);
      setSelectedGroupId(value);
      setCandidateQuery("");
      setNotice("");
    },
    startCreate,
    updateGroup
  };
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
