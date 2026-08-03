import { lazy } from "react";
import { FileCheck2 } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";
import { COMPLIANCE_MODULE_ID, COMPLIANCE_SECTION_ID } from "./complianceModule";
import "./styles/index.css";

const ComplianceDocumentTypeWorkspace = lazy(() => import("./ComplianceDocumentTypeWorkspace").then((module) => ({ default: module.ComplianceDocumentTypeWorkspace })));

export const complianceDocumentTypeModuleSurface: ModuleSurface = {
  id: COMPLIANCE_SECTION_ID,
  label: "Compliance Document Types",
  icon: FileCheck2,
  moduleName: COMPLIANCE_MODULE_ID,
  order: 36,
  render: (host) => (
    <ComplianceDocumentTypeWorkspace host={host} />
  ),
};

export default complianceDocumentTypeModuleSurface;
