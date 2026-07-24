import type {
  ProductDefinition,
  ProductSort,
  ProductSortDirection,
  ProductStatus,
} from "./types";

export function filterAndSortProducts(
  products: ProductDefinition[],
  options: {
    query: string;
    status: "all" | ProductStatus;
    sortBy: ProductSort;
    sortDirection: ProductSortDirection;
  },
) {
  const query = options.query.trim().toLocaleLowerCase();
  const direction = options.sortDirection === "asc" ? 1 : -1;
  return products
    .filter((product) => {
      if (options.status !== "all" && product.status !== options.status) return false;
      if (!query) return true;
      return [
        product.code,
        product.canonical_name,
        product.category,
        product.grade,
        product.specification,
        product.base_unit_code,
      ].filter(Boolean).join(" ").toLocaleLowerCase().includes(query);
    })
    .sort((left, right) => {
      const comparison = options.sortBy === "name"
        ? left.canonical_name.localeCompare(right.canonical_name)
        : left.code.localeCompare(right.code);
      return direction * (comparison || left.id.localeCompare(right.id));
    });
}
