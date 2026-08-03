import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

import { IconButton } from "@uok/shared/primitives";
import { ContactRelationshipLookup } from "./ContactRelationshipLookup";
import type {
  ContactRelationship,
  ContactRelationshipEditorIntent,
  ContactsWorkspaceProps,
} from "./types";

export function useContactRelationshipEditor(ownerKey: string) {
  const editorRef = useRef<RelationshipEditorAuthority>({
    generation: 0,
    mounted: true,
    ownerKey,
    editorKey: "",
    target: "",
    type: "primary_contact",
  });
  if (editorRef.current.ownerKey !== ownerKey) {
    editorRef.current = {
      ...editorRef.current,
      generation: editorRef.current.generation + 1,
      ownerKey,
      editorKey: "",
      target: "",
      type: "primary_contact",
    };
  }
  const [editingKey, setEditingKey] = useState("");
  const [target, setTarget] = useState("");
  const [type, setType] = useState("primary_contact");

  useEffect(() => () => {
    editorRef.current = {
      ...editorRef.current,
      generation: editorRef.current.generation + 1,
      mounted: false,
      editorKey: "",
    };
  }, []);

  function start(rel: ContactRelationship) {
    const editorKey = relationshipEditorKey(ownerKey, rel.id);
    const nextTarget = relatedPartyId(rel);
    editorRef.current = {
      generation: editorRef.current.generation + 1,
      mounted: true,
      ownerKey,
      editorKey,
      target: nextTarget,
      type: rel.relationship_type,
    };
    setEditingKey(editorKey);
    setTarget(nextTarget);
    setType(rel.relationship_type);
  }

  function changeTarget(value: string) {
    advance({ target: value });
    setTarget(value);
  }

  function changeType(value: string) {
    advance({ type: value });
    setType(value);
  }

  function cancel() {
    advance({ editorKey: "" });
    setEditingKey("");
  }

  function intent(relationshipId: string): ContactRelationshipEditorIntent | null {
    const captured = editorRef.current;
    if (captured.editorKey !== relationshipEditorKey(ownerKey, relationshipId)) return null;
    return {
      generation: captured.generation,
      isCurrent: (generation) => {
        const current = editorRef.current;
        return current.mounted
          && current.generation === generation
          && current.ownerKey === captured.ownerKey
          && current.editorKey === captured.editorKey
          && current.target === captured.target
          && current.type === captured.type;
      },
    };
  }

  function advance(
    change: Partial<Pick<RelationshipEditorAuthority, "editorKey" | "target" | "type">>,
  ) {
    if (!editorRef.current.mounted || editorRef.current.ownerKey !== ownerKey) return;
    editorRef.current = {
      ...editorRef.current,
      ...change,
      generation: editorRef.current.generation + 1,
    };
  }

  return {
    cancel,
    changeTarget,
    changeType,
    intent,
    isEditing: (relationshipId: string) => editingKey
      === relationshipEditorKey(ownerKey, relationshipId)
      && editorRef.current.editorKey === editingKey,
    start,
    target,
    type,
  };
}

export function ContactRelationshipEditor({
  boundary,
  busyAction,
  canManage,
  contactId,
  onUnauthorized,
  rel,
  target,
  type,
  onCancel,
  onSave,
  onTargetChange,
  onTypeChange,
}: {
  boundary: ContactsWorkspaceProps["contactReadBoundary"];
  busyAction: string;
  canManage: boolean;
  contactId: string;
  onUnauthorized: () => void;
  rel: ContactRelationship;
  target: string;
  type: string;
  onCancel: () => void;
  onSave: () => void;
  onTargetChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}) {
  return (
    <>
      <div className="relationship-edit-fields">
        <ContactRelationshipLookup
          boundary={boundary}
          onUnauthorized={onUnauthorized}
          canManage={canManage}
          contactId={contactId}
          value={target}
          initialLabel={rel.related_party_name || relatedPartyFallback(rel)}
          onChange={onTargetChange}
        />
        <ContactRelationshipTypeSelect
          value={type}
          onChange={onTypeChange}
          disabled={Boolean(busyAction)}
        />
      </div>
      <div className="relationship-row-actions">
        <IconButton icon={Check} label="Save relationship" primary onClick={onSave} disabled={!canManage || !target || Boolean(busyAction)} />
        <IconButton icon={X} label="Cancel relationship edit" onClick={onCancel} disabled={Boolean(busyAction)} />
      </div>
    </>
  );
}

export function ContactRelationshipTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="field">
      <span>Relationship</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {relationshipTypeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}

type RelationshipEditorAuthority = {
  generation: number;
  mounted: boolean;
  ownerKey: string;
  editorKey: string;
  target: string;
  type: string;
};

const relationshipTypeOptions = [
  { id: "primary_contact", label: "Primary contact" },
  { id: "works_for", label: "Works for" },
  { id: "billing_contact", label: "Billing contact" },
  { id: "decision_maker", label: "Decision maker" },
  { id: "finance_contact", label: "Finance contact" },
  { id: "operations_contact", label: "Operations contact" },
  { id: "advisor", label: "Advisor" },
  { id: "customer", label: "Customer" },
  { id: "supplier", label: "Supplier" },
  { id: "supplier_contact", label: "Supplier contact" },
];

function relationshipEditorKey(ownerKey: string, relationshipId: string) {
  return `${ownerKey}\u0000${relationshipId}`;
}

function relatedPartyId(rel: ContactRelationship) {
  return rel.related_party_id || rel.to_party_id || rel.from_party_id || "";
}

function relatedPartyFallback(rel: ContactRelationship) {
  return rel.related_party_id || rel.to_party_id || rel.from_party_id || "Related contact";
}
