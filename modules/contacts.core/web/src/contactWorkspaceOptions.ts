import {
  Grid2X2,
  Info,
  Link2,
  List as ListIcon,
  Table2,
  WandSparkles,
  FileCheck2,
} from "lucide-react";

import type { Option } from "@uok/shared/options";
import type { ContactDetailPane, ContactsView } from "./contracts";

export const contactsViewOptions: Array<Option<ContactsView>> = [
  { id: "split", label: "List + Detail", icon: ListIcon },
  { id: "table", label: "Table", icon: Table2 },
  { id: "cards", label: "Cards", icon: Grid2X2 },
  { id: "quality", label: "Quality", icon: WandSparkles },
];

export const contactDetailPaneOptions: Array<Option<ContactDetailPane>> = [
  { id: "overview", label: "Details", icon: Info },
  { id: "intelligence", label: "Intelligence", icon: WandSparkles },
  { id: "activity", label: "Activity", icon: FileCheck2 },
  { id: "relationships", label: "Relationships", icon: Link2 },
];
