export type InventoryCategoryWithParent = {
  id: string;
  name: string;
  parentCategoryId?: string | null;
  parentCategory?: {
    id: string;
    name: string;
  } | null;
};

export function getInventoryCategoryLabel(
  category: InventoryCategoryWithParent | null | undefined,
) {
  if (!category) {
    return "—";
  }

  return category.parentCategory
    ? `${category.parentCategory.name} › ${category.name}`
    : category.name;
}

export function getInventoryCategoryOptionLabel(
  category: InventoryCategoryWithParent,
) {
  return category.parentCategoryId ? `↳ ${category.name}` : category.name;
}

export function sortInventoryCategoriesForSelect<
  TCategory extends InventoryCategoryWithParent,
>(categories: TCategory[]) {
  const childrenByParentId = new Map<string, TCategory[]>();
  const roots: TCategory[] = [];

  for (const category of categories) {
    if (category.parentCategoryId) {
      const children = childrenByParentId.get(category.parentCategoryId) ?? [];
      children.push(category);
      childrenByParentId.set(category.parentCategoryId, children);
    } else {
      roots.push(category);
    }
  }

  const sortedRoots = [...roots].sort(compareCategoryNames);
  const result: TCategory[] = [];

  for (const root of sortedRoots) {
    result.push(root);
    result.push(
      ...[...(childrenByParentId.get(root.id) ?? [])].sort(compareCategoryNames),
    );
  }

  const rootIds = new Set(roots.map((category) => category.id));
  const orphanChildren = categories.filter(
    (category) => category.parentCategoryId && !rootIds.has(category.parentCategoryId),
  );

  result.push(...orphanChildren.sort(compareCategoryNames));

  return result;
}

/** Expands a set of selected category ids so that choosing a parent
 * category also matches every item filed under its subcategories - items
 * are normally assigned directly to a leaf/subcategory, never the parent,
 * so filtering by the parent's id alone would otherwise match nothing. */
export function expandInventoryCategoryFilterIds<
  TCategory extends InventoryCategoryWithParent,
>(selectedIds: string[], categories: TCategory[]) {
  const expanded = new Set<string>();

  for (const id of selectedIds) {
    expanded.add(id);
    for (const category of categories) {
      if (category.parentCategoryId === id) {
        expanded.add(category.id);
      }
    }
  }

  return [...expanded];
}

function compareCategoryNames(
  left: InventoryCategoryWithParent,
  right: InventoryCategoryWithParent,
) {
  return left.name.localeCompare(right.name, "de-DE", { numeric: true });
}
