type AssignableInventoryCategory = {
  useInEmployeeFile?: boolean | null;
  useInTeamManagement?: boolean | null;
  parentCategory?: {
    useInEmployeeFile?: boolean | null;
    useInTeamManagement?: boolean | null;
  } | null;
} | null | undefined;

export function inventoryCategoryAllowsAssignment(
  category: AssignableInventoryCategory,
) {
  return Boolean(
    category?.useInTeamManagement ||
      category?.parentCategory?.useInTeamManagement ||
      category?.useInEmployeeFile ||
      category?.parentCategory?.useInEmployeeFile,
  );
}
