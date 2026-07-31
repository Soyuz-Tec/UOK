import { FileCheck2 } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";
import { ComplianceDocumentTypeWorkspace } from "./ComplianceDocumentTypeWorkspace";
import { COMPLIANCE_MODULE_ID, COMPLIANCE_SECTION_ID } from "./complianceModule";
import "./styles/index.css";

export const complianceDocumentTypeModuleSurface: ModuleSurface = {
  id: COMPLIANCE_SECTION_ID,
  label: "Compliance Document Types",
  icon: FileCheck2,
  moduleName: COMPLIANCE_MODULE_ID,
  order: 36,
  render: (host) => (
    <ComplianceDocumentTypeWorkspace
      key={`${host.session.token}:${host.currentUserRole}`}
      host={host}
    />
  ),
};

export default complianceDocumentTypeModuleSurface;
