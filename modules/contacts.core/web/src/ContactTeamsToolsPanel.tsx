import { useEffect, useMemo, useState } from "react";
import { Archive, Plus, Save, Trash2, UserPlus } from "lucide-react";

import { ConfirmCommandButton } from "@uok/shared/actions";
import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ContactTeamRow } from "./contactDataToolsApi";
import type { ContactDataToolsPanelProps } from "./contactDataToolsUi";

export function ContactTeamsToolsPanel(props: ContactDataToolsPanelProps) {
  const { t } = useUokLocalization();
  const [teams, setTeams] = useState<ContactTeamRow[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [userId, setUserId] = useState("");
  const [memberRole, setMemberRole] = useState("member");
  const selectedTeam = useMemo(() => teams.find((team) => team.id === selectedTeamId) || null, [selectedTeamId, teams]);

  const loadTeams = async () => {
    const result = await props.api.teams();
    setTeams(result);
    setSelectedTeamId((current) => result.some((team) => team.id === current) ? current : result[0]?.id || "");
  };

  useEffect(() => {
    let active = true;
    props.api.teams().then((result) => {
      if (!active) return;
      setTeams(result);
      setSelectedTeamId((current) => result.some((team) => team.id === current) ? current : result[0]?.id || "");
    }).catch(() => { if (active) setTeams([]); });
    return () => { active = false; };
  }, [props.api]);

  useEffect(() => {
    setName(selectedTeam?.name || "");
    setDescription(selectedTeam?.description || "");
  }, [selectedTeam?.id]);

  const createTeam = async () => {
    if (!name.trim()) return;
    const result = await props.run("team-create", () => props.api.createTeam({ name: name.trim(), description: description.trim() }), t("contacts.dataTools.teamCreated", "Contact team created."));
    if (!result) return;
    await loadTeams();
    setSelectedTeamId(result.id);
  };

  const updateTeam = async () => {
    if (!selectedTeam || !name.trim()) return;
    const result = await props.run("team-save", () => props.api.updateTeam(selectedTeam.id, { name: name.trim(), description: description.trim() }), t("contacts.dataTools.teamUpdated", "Contact team updated."));
    if (result) await loadTeams();
  };

  const archiveTeam = async () => {
    if (!selectedTeam) return;
    const result = await props.run("team-archive", () => props.api.archiveTeam(selectedTeam.id), t("contacts.dataTools.teamArchived", "Contact team archived."));
    if (result) await loadTeams();
  };

  const addMember = async () => {
    if (!selectedTeam || !userId.trim()) return;
    const result = await props.run("team-member-add", () => props.api.addTeamMember(selectedTeam.id, { user_id: userId.trim(), role: memberRole }), t("contacts.dataTools.memberAdded", "Team member added."));
    if (!result) return;
    setUserId("");
    await loadTeams();
  };

  const removeMember = async (memberUserId: string) => {
    if (!selectedTeam) return;
    const result = await props.run("team-member-remove", () => props.api.removeTeamMember(selectedTeam.id, memberUserId), t("contacts.dataTools.memberRemoved", "Team member removed."));
    if (result) await loadTeams();
  };

  return (
    <section className="contact-data-tool-panel" aria-label={t("contacts.dataTools.teams", "Contact teams") }>
      <header><div><p className="eyebrow">{t("contacts.dataTools.accessScope", "Access scope")}</p><h3>{t("contacts.dataTools.teams", "Contact teams")}</h3></div></header>
      <div className="contact-data-tools-split">
        <aside className="contact-data-tools-selector" aria-label={t("contacts.dataTools.teamList", "Contact teams") }>
          {teams.length ? teams.map((team) => (
            <button type="button" key={team.id} className={team.id === selectedTeamId ? "selected" : ""} aria-pressed={team.id === selectedTeamId} onClick={() => setSelectedTeamId(team.id)}>
              <strong>{team.name}</strong><span>{team.status} · {team.member_count} {t("contacts.dataTools.members", "members")}</span>
            </button>
          )) : <EmptyState text={t("contacts.dataTools.noTeams", "No contact teams are visible to this role.")} />}
          {props.canGovern ? <CommandButton icon={Plus} onClick={() => { setSelectedTeamId(""); setName(""); setDescription(""); }}>{t("contacts.dataTools.newTeam", "New team")}</CommandButton> : null}
        </aside>
        <div className="contact-data-tools-detail">
          {props.canGovern ? (
            <fieldset className="contact-data-tools-form" disabled={Boolean(props.busyAction)}>
              <legend>{selectedTeam ? t("contacts.dataTools.teamDetails", "Team details") : t("contacts.dataTools.newTeam", "New team")}</legend>
              <label><span>{t("contacts.dataTools.teamName", "Team name")}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
              <label className="wide"><span>{t("contacts.dataTools.descriptionLabel", "Description")}</span><textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
              <div className="contact-data-tools-form-actions wide">
                <CommandButton icon={selectedTeam ? Save : Plus} primary onClick={() => void (selectedTeam ? updateTeam() : createTeam())} disabled={!name.trim()} loading={props.busyAction === "team-create" || props.busyAction === "team-save"}>{selectedTeam ? t("command.save", "Save") : t("contacts.dataTools.createTeam", "Create team")}</CommandButton>
                {selectedTeam?.status === "active" ? <ConfirmCommandButton icon={Archive} message={t("contacts.dataTools.archiveTeamConfirm", "Archive this contact team?")} onConfirm={() => void archiveTeam()} destructive disabled={Boolean(props.busyAction)}>{t("contacts.dataTools.archiveTeam", "Archive team")}</ConfirmCommandButton> : null}
              </div>
            </fieldset>
          ) : null}
          {selectedTeam ? (
            <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.teamMembers", "Team members") }>
              <h4>{t("contacts.dataTools.teamMembers", "Team members")}</h4>
              {selectedTeam.members.length ? <div className="contact-data-tools-record-list" role="list">{selectedTeam.members.map((member) => (
                <div className="contact-data-tools-record" role="listitem" key={member.id}><div><strong>{member.user_id}</strong><span>{member.role}</span></div>{props.canGovern ? <ConfirmCommandButton icon={Trash2} message={t("contacts.dataTools.removeMemberConfirm", "Remove this member from the team?")} onConfirm={() => void removeMember(member.user_id)} disabled={Boolean(props.busyAction)} destructive>{t("command.remove", "Remove")}</ConfirmCommandButton> : null}</div>
              ))}</div> : <p className="contact-data-tools-empty">{t("contacts.dataTools.noMembers", "No active members.")}</p>}
              {props.canGovern && selectedTeam.status === "active" ? <div className="contact-data-tools-inline-form"><label><span>{t("contacts.dataTools.userId", "User ID")}</span><input value={userId} onChange={(event) => setUserId(event.target.value)} /></label><label><span>{t("contacts.dataTools.memberRole", "Role")}</span><select value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>{["owner", "manager", "member", "viewer"].map((value) => <option key={value}>{value}</option>)}</select></label><CommandButton icon={UserPlus} onClick={() => void addMember()} disabled={!userId.trim()} loading={props.busyAction === "team-member-add"}>{t("contacts.dataTools.addMember", "Add member")}</CommandButton></div> : null}
            </section>
          ) : null}
        </div>
      </div>
      <p className="contact-data-tools-hint">{t("contacts.dataTools.teamAssignmentHint", "Assign selected contacts to a team from Import, export and bulk.")}</p>
    </section>
  );
}
