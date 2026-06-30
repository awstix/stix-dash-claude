import { EmployeesManagementPage } from "../admin/employees/page";

type EmployeeSearchParams = {
  ageMax?: string;
  ageMin?: string;
  birthFrom?: string;
  birthTo?: string;
  city?: string;
  company?: string;
  department?: string;
  emergencyPhone?: string;
  entryFrom?: string;
  entryTo?: string;
  exitFrom?: string;
  exitTo?: string;
  firstName?: string;
  gender?: string;
  lastName?: string;
  leadership?: string;
  mobilePhone?: string;
  notes?: string;
  position?: string;
  postalCode?: string;
  sort?: string;
  status?: string;
  street?: string;
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<EmployeeSearchParams>;
}) {
  return (
    <EmployeesManagementPage basePath="/employees" searchParams={searchParams} />
  );
}
