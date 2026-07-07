import { Search } from "lucide-react";

export function SearchField({
  value,
  onChange,
  label,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="search-field">
      <Search size={16} aria-hidden="true" />
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}
