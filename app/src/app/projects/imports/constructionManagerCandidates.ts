import { getConstructionManagerOptions } from "@/lib/construction-manager-options";

/** Same "active employee with a Bauleiter position" filter used by the
 * construction-manager picker on the project create/edit forms
 * (src/app/projects/page.tsx, src/app/projects/[projectId]/page.tsx) - so
 * the import/export dropdown offers exactly the same people, not every
 * employee in the company. */
export async function getConstructionManagerCandidateNames() {
  const options = await getConstructionManagerOptions();
  return options.map((option) => option.value);
}
