import { ContactRound } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";
import { CONTACTS_MODULE_ID, CONTACTS_SECTION_ID } from "./contactModule";
import { ContactsModuleRoot } from "./ContactsModuleRoot";
import "./styles/index.css";

export const contactsModuleSurface: ModuleSurface = {
  id: CONTACTS_SECTION_ID,
  label: "Contacts",
  icon: ContactRound,
  moduleName: CONTACTS_MODULE_ID,
  order: 30,
  render: (host) => <ContactsModuleRoot host={host} />,
};

export default contactsModuleSurface;
