import { PackageSearch } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";
import { ProductMasterWorkspace } from "./ProductMasterWorkspace";
import { PRODUCT_MASTER_MODULE_ID, PRODUCT_MASTER_SECTION_ID } from "./productModule";
import "./styles/index.css";

export const productMasterModuleSurface: ModuleSurface = {
  id: PRODUCT_MASTER_SECTION_ID,
  label: "Product Master",
  icon: PackageSearch,
  moduleName: PRODUCT_MASTER_MODULE_ID,
  order: 35,
  render: (host) => <ProductMasterWorkspace host={host} />,
};

export default productMasterModuleSurface;
