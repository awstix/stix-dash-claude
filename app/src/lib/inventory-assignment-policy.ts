type AssignableInventoryCategory = {
  useInTeamManagement?: boolean | null;
  parentCategory?: {
    useInTeamManagement?: boolean | null;
  } | null;
} | null | undefined;

export function inventoryCategoryAllowsAssignment(
  category: AssignableInventoryCategory,
) {
  return Boolean(
    category?.useInTeamManagement ||
      category?.parentCategory?.useInTeamManagement,
  );
}
