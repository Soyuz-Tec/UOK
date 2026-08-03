import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { formatLabel } from "@uok/shared/format";
import { useUokLocalization } from "@uok/shared/localization";
import {
  contactReadsEnabled,
  type ContactReadBoundary,
} from "./app/contactReadAuthority";
import type { ContactRelationshipOption } from "./contactRelationshipOptionsApi";
import { useContactRelationshipOptions } from "./useContactRelationshipOptions";

export function ContactRelationshipLookup({
  boundary,
  onUnauthorized,
  canManage,
  contactId,
  value,
  initialLabel,
  onChange
}: {
  boundary: ContactReadBoundary;
  onUnauthorized: () => void;
  canManage: boolean;
  contactId: string;
  value: string;
  initialLabel?: string;
  onChange: (value: string) => void;
}) {
  const { t } = useUokLocalization();
  const listboxId = useId();
  const [query, setQuery] = useState(initialLabel || "");
  const [searchActive, setSearchActive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const userSearching = useRef(false);
  const previousValue = useRef(value);
  const lookup = useContactRelationshipOptions({
    boundary,
    onUnauthorized,
    canManage,
    query: searchActive ? query : "",
    excludePartyId: contactId,
  });
  const showResults = canManage
    && contactReadsEnabled(boundary)
    && searchActive
    && query.trim().length >= 2;

  useEffect(() => {
    setQuery(initialLabel || "");
    setSearchActive(false);
    setActiveIndex(0);
    userSearching.current = false;
  }, [boundary.generation, boundary.token, contactId, initialLabel]);

  useEffect(() => {
    if (canManage && boundary.operational && boundary.surfaceActive) return;
    setSearchActive(false);
    setActiveIndex(0);
  }, [boundary.operational, boundary.surfaceActive, canManage]);

  useEffect(() => {
    if (previousValue.current && !value && !userSearching.current) {
      setQuery("");
      setSearchActive(false);
    }
    previousValue.current = value;
  }, [value]);

  useEffect(() => setActiveIndex(0), [lookup.options]);

  const selectOption = (option: ContactRelationshipOption) => {
    userSearching.current = false;
    setQuery(option.display_name);
    setSearchActive(false);
    onChange(option.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || !lookup.options.length) {
      if (event.key === "Escape") setSearchActive(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + delta + lookup.options.length) % lookup.options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectOption(lookup.options[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setSearchActive(false);
    }
  };

  return (
    <div className="contact-relationship-lookup">
      <label className="field">
        <span>{t("contacts.relationships.relatedContact", "Related contact")}</span>
        <input
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showResults}
          aria-activedescendant={showResults && lookup.options[activeIndex] ? `${listboxId}-${lookup.options[activeIndex].id}` : undefined}
          disabled={!canManage || !contactReadsEnabled(boundary)}
          value={query}
          placeholder={t("contacts.relationships.searchPlaceholder", "Type at least two characters")}
          onChange={(event) => {
            userSearching.current = true;
            setQuery(event.target.value);
            setSearchActive(true);
            setActiveIndex(0);
            if (value) onChange("");
          }}
          onFocus={() => {
            if (!value && query.trim().length >= 2) setSearchActive(true);
          }}
          onKeyDown={handleKeyDown}
        />
      </label>
      {showResults ? (
        <div className="contact-relationship-results" id={listboxId} role="listbox" aria-label={t("contacts.relationships.results", "Related contact results")}>
          {lookup.loading ? <p role="status">{t("contacts.relationships.searching", "Searching contacts...")}</p> : null}
          {lookup.error ? <p role="alert">{lookup.error}</p> : null}
          {!lookup.loading && !lookup.error && !lookup.options.length ? <p>{t("contacts.relationships.noResults", "No matching contacts.")}</p> : null}
          {lookup.options.map((option, index) => (
            <button
              type="button"
              role="option"
              id={`${listboxId}-${option.id}`}
              key={option.id}
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
            >
              <strong>{option.display_name}</strong>
              <span>{formatLabel(option.party_type)}{option.email ? ` · ${option.email}` : option.phone ? ` · ${option.phone}` : ""}</span>
            </button>
          ))}
        </div>
      ) : null}
      {value && !searchActive ? <small>{t("contacts.relationships.selected", "Selected")}: {query}</small> : null}
    </div>
  );
}
