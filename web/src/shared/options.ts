import type { ElementType } from "react";
import {
  Archive,
  Database,
  FileCheck2,
  Grid2X2,
  Info,
  Link2,
  List as ListIcon,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Table2,
  WandSparkles
} from "lucide-react";

import type { Appearance, ContactDetailPane, ContactsView, Section } from "./types";

export type Option<T extends string> = { id: T; label: string; icon: ElementType };

export const coreSections: Array<Option<Extract<Section, "overview" | "evidence" | "architecture">>> = [
  { id: "overview", label: "Overview", icon: Database },
  { id: "evidence", label: "Evidence", icon: Archive },
  { id: "architecture", label: "Architecture", icon: ShieldCheck }
];

export const appearanceOptions: Array<Option<Appearance>> = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon }
];

export const contactsViewOptions: Array<Option<ContactsView>> = [
  { id: "split", label: "List + Detail", icon: ListIcon },
  { id: "table", label: "Table", icon: Table2 },
  { id: "cards", label: "Cards", icon: Grid2X2 },
  { id: "quality", label: "Quality", icon: WandSparkles }
];

export const contactDetailPaneOptions: Array<Option<ContactDetailPane>> = [
  { id: "overview", label: "Details", icon: Info },
  { id: "intelligence", label: "Intelligence", icon: WandSparkles },
  { id: "activity", label: "Activity", icon: FileCheck2 },
  { id: "relationships", label: "Relationships", icon: Link2 }
];
