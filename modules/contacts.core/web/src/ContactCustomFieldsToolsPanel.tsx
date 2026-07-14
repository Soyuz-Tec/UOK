import { useEffect, useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";

import { EmptyState } from "@uok/shared/data-display";
import { useUokLocalization } from "@uok/shared/localization";
import { CommandButton } from "@uok/shared/primitives";
import type { ContactCustomFieldDefinition, ContactCustomFieldValue } from "./contactDataToolsApi";
import type { ContactDataToolsPanelProps } from "./contactDataToolsUi";

export function ContactCustomFieldsToolsPanel(props: ContactDataToolsPanelProps) {
  const { t } = useUokLocalization();
  const [definitions, setDefinitions] = useState<ContactCustomFieldDefinition[]>([]);
  const [values, setValues] = useState<ContactCustomFieldValue[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>({});
  const [fieldKey, setFieldKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [appliesTo, setAppliesTo] = useState("all");
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState("");
  const partyId = props.selectedContact?.id || "";
  const normalizedFieldKey = normalizeFieldKey(fieldKey);
  const fieldKeyValid = /^[a-z][a-z0-9_]{1,79}$/.test(normalizedFieldKey);
  const applicableDefinitions = useMemo(() => definitions.filter((definition) => !props.selectedContact || definition.applies_to === "all" || definition.applies_to === props.selectedContact.party_type), [definitions, props.selectedContact]);

  const load = async () => {
    const nextDefinitions = await props.api.customFields();
    const nextValues = partyId ? await props.api.customValues(partyId) : [];
    setDefinitions(nextDefinitions);
    setValues(nextValues);
    setDraftValues(Object.fromEntries(nextValues.map((value) => [value.field_definition_id, value.value])));
  };

  useEffect(() => {
    let active = true;
    Promise.all([props.api.customFields(), partyId ? props.api.customValues(partyId) : Promise.resolve([])])
      .then(([nextDefinitions, nextValues]) => {
        if (!active) return;
        setDefinitions(nextDefinitions);
        setValues(nextValues);
        setDraftValues(Object.fromEntries(nextValues.map((value) => [value.field_definition_id, value.value])));
      })
      .catch(() => { if (active) { setDefinitions([]); setValues([]); } });
    return () => { active = false; };
  }, [partyId, props.api]);

  const defineField = async () => {
    if (!fieldKeyValid || !label.trim()) return;
    const result = await props.run("custom-define", () => props.api.defineCustomField({
      field_key: normalizedFieldKey,
      label: label.trim(),
      field_type: fieldType,
      applies_to: appliesTo,
      required,
      options: fieldType === "choice" ? options.split(",").map((value) => value.trim()).filter(Boolean) : [],
    }), t("contacts.dataTools.fieldDefined", "Custom field defined."));
    if (!result) return;
    setFieldKey(""); setLabel(""); setFieldType("text"); setAppliesTo("all"); setRequired(false); setOptions("");
    await load();
  };

  const saveValue = async (definition: ContactCustomFieldDefinition) => {
    if (!partyId) return;
    const value = normalizedCustomValue(definition, draftValues[definition.id]);
    const result = await props.run(`custom-value-${definition.id}`, () => props.api.setCustomValue(partyId, definition.id, value), t("contacts.dataTools.customValueSaved", "Custom field value saved."));
    if (!result) return;
    await load();
    await props.onChanged();
  };

  return (
    <section className="contact-data-tool-panel" aria-label={t("contacts.dataTools.custom", "Custom fields") }>
      <header><div><p className="eyebrow">{t("contacts.dataTools.extension", "Governed extension")}</p><h3>{t("contacts.dataTools.custom", "Custom fields")}</h3></div>{props.selectedContact ? <strong>{props.selectedContact.display_name}</strong> : null}</header>
      <div className="contact-data-tools-columns">
        <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.fieldDefinitions", "Field definitions") }>
          <h4>{t("contacts.dataTools.fieldDefinitions", "Field definitions")}</h4>
          {definitions.length ? <div className="contact-data-tools-record-list">{definitions.map((definition) => <article className="contact-data-tools-record" key={definition.id}><div><strong>{definition.label}</strong><span>{definition.field_key} · {definition.field_type} · {definition.applies_to}</span><small>{definition.required ? t("contacts.dataTools.required", "Required") : t("contacts.dataTools.optional", "Optional")}</small></div></article>)}</div> : <EmptyState text={t("contacts.dataTools.noCustomFields", "No custom field definitions exist.")} />}
          {props.canGovern ? <fieldset className="contact-data-tools-form" disabled={Boolean(props.busyAction)}><legend>{t("contacts.dataTools.defineField", "Define custom field")}</legend><div><label htmlFor="contact-custom-field-key"><span>{t("contacts.dataTools.fieldKey", "Field key")}</span><input id="contact-custom-field-key" value={fieldKey} onChange={(event) => setFieldKey(event.target.value)} placeholder="account_tier" maxLength={80} aria-invalid={fieldKey.trim() && !fieldKeyValid ? true : undefined} aria-describedby="contact-custom-field-key-help" /></label><small id="contact-custom-field-key-help">{fieldKey.trim() && !fieldKeyValid ? t("contacts.dataTools.invalidFieldKey", "Use 2-80 characters: start with a letter, then lowercase letters, numbers, or underscores.") : t("contacts.dataTools.fieldKeyHint", "Starts with a letter; lowercase letters, numbers, and underscores only.")}</small></div><label><span>{t("contacts.dataTools.fieldLabel", "Label")}</span><input value={label} onChange={(event) => setLabel(event.target.value)} /></label><label><span>{t("contacts.dataTools.fieldType", "Field type")}</span><select value={fieldType} onChange={(event) => setFieldType(event.target.value)}>{["text", "number", "date", "boolean", "choice", "url"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>{t("contacts.dataTools.appliesTo", "Applies to")}</span><select value={appliesTo} onChange={(event) => setAppliesTo(event.target.value)}><option value="all">All contacts</option><option value="person">People</option><option value="organization">Organizations</option></select></label>{fieldType === "choice" ? <label className="wide"><span>{t("contacts.dataTools.choiceOptions", "Choice options")}</span><input value={options} onChange={(event) => setOptions(event.target.value)} placeholder="standard, preferred, strategic" /></label> : null}<label className="check"><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} /><span>{t("contacts.dataTools.required", "Required")}</span></label><div className="contact-data-tools-form-actions wide"><CommandButton icon={Plus} primary onClick={() => void defineField()} disabled={!fieldKeyValid || !label.trim()} loading={props.busyAction === "custom-define"}>{t("contacts.dataTools.defineField", "Define custom field")}</CommandButton></div></fieldset> : null}
        </section>
        <section className="contact-data-tools-subsection" aria-label={t("contacts.dataTools.contactValues", "Contact values") }>
          <h4>{t("contacts.dataTools.contactValues", "Contact values")}</h4>
          {!props.selectedContact ? <EmptyState text={t("contacts.dataTools.selectContact", "Select a contact before managing record-level data.")} /> : applicableDefinitions.length ? <div className="contact-data-tools-custom-values">{applicableDefinitions.map((definition) => <div className="contact-data-tools-custom-value" key={definition.id}><CustomValueInput definition={definition} value={draftValues[definition.id]} disabled={!props.canGovern || Boolean(props.busyAction)} onChange={(value) => setDraftValues({ ...draftValues, [definition.id]: value })} /><CommandButton icon={Save} onClick={() => void saveValue(definition)} disabled={!props.canGovern} loading={props.busyAction === `custom-value-${definition.id}`}>{t("command.save", "Save")}</CommandButton></div>)}</div> : <EmptyState text={t("contacts.dataTools.noApplicableFields", "No custom fields apply to this contact.")} />}
          {values.length ? <small>{values.length} {t("contacts.dataTools.valuesStored", "values currently stored")}</small> : null}
        </section>
      </div>
    </section>
  );
}

function CustomValueInput({ definition, value, disabled, onChange }: { definition: ContactCustomFieldDefinition; value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  const options = definition.options ?? [];
  if (definition.field_type === "boolean") return <label className="check"><input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} disabled={disabled} /><span>{definition.label}</span></label>;
  if (definition.field_type === "choice") return <label><span>{definition.label}</span><select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} disabled={disabled}><option value="">Select value</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
  return <label><span>{definition.label}</span><input type={definition.field_type === "date" ? "date" : definition.field_type === "number" ? "number" : definition.field_type === "url" ? "url" : "text"} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} disabled={disabled} required={definition.required} /></label>;
}

function normalizedCustomValue(definition: ContactCustomFieldDefinition, value: unknown) {
  if (definition.field_type === "boolean") return Boolean(value);
  if (definition.field_type === "number" && value !== "" && value != null) return Number(value);
  return value ?? "";
}

function normalizeFieldKey(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^[^a-z]+/, "");
}
