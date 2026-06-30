import { EmployeeQualificationsManagementPage } from "../../admin/employee-qualifications/page";

export default async function EmployeeDriverLicensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
}) {
  return (
    <EmployeeQualificationsManagementPage
      basePath="/employees/driver-licenses"
      searchParams={searchParams}
    />
  );
}
