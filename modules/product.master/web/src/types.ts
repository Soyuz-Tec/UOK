export type ProductStatus = "active" | "archived";

export type ProductDefinition = {
  id: string;
  code: string;
  canonical_name: string;
  category: string | null;
  grade: string | null;
  specification: string | null;
  base_unit_code: string | null;
  status: ProductStatus;
  version: number;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ProductNameHistory = {
  id: string;
  product_definition_id: string;
  previous_name: string;
  new_name: string;
  reason: string;
  changed_by_user_id: string;
  changed_at: string;
};

export type ProductDraft = {
  code: string;
  canonicalName: string;
  category: string;
  grade: string;
  specification: string;
  baseUnitCode: string;
  reason: string;
};

export type ProductSort = "code" | "name";
export type ProductSortDirection = "asc" | "desc";

export const emptyProductDraft: ProductDraft = {
  code: "",
  canonicalName: "",
  category: "",
  grade: "",
  specification: "",
  baseUnitCode: "",
  reason: "",
};

export function draftFromProduct(product: ProductDefinition): ProductDraft {
  return {
    code: product.code,
    canonicalName: product.canonical_name,
    category: product.category || "",
    grade: product.grade || "",
    specification: product.specification || "",
    baseUnitCode: product.base_unit_code || "",
    reason: "",
  };
}
