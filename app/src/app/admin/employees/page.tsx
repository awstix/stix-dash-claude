import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  CloseDetailsButton,
  DismissibleDetails,
} from "../../crew-dispatch/DismissibleDetails";
import { PositionPicker } from "./PositionPicker";
import { createEmployee, deleteEmployee, updateEmployee } from "./actions";

type FilterValues = Record<string, string>;

function formatDateInput(date: Date | null) {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function formatGermanDate(date: Date | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function calculateAge(birthDate: Date | null) {
  if (!birthDate) {
    return "-";
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return String(age);
}

function isExitedEmployeeStatus(statusValue: string, statusLabel: string | null) {
  const normalizedStatus = `${statusValue} ${statusLabel ?? ""}`.toLowerCase();

  return statusValue === "left" || normalizedStatus.includes("ausgeschieden");
}

function getStatusClass(statusValue: string) {
  if (statusValue === "active") {
    return "rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800";
  }

  if (statusValue === "left") {
    return "rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800";
  }

  return "rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800";
}

function parseDateFilter(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function subtractYears(date: Date, years: number) {
  return new Date(
    Date.UTC(date.getFullYear() - years, date.getMonth(), date.getDate())
  );
}

function parsePositiveNumber(value: string) {
  if (!value) {
    return null;
  }

  const number = Number(value);

  if (Number.isNaN(number) || number < 0) {
    return null;
  }

  return number;
}

function getSortMode(value: string) {
  if (value === "company") {
    return "company";
  }

  if (value === "status") {
    return "status";
  }

  return "lastName";
}

type EmployeeSearchParams = {
  status?: string;
  entryFrom?: string;
  entryTo?: string;
  exitFrom?: string;
  exitTo?: string;
  company?: string;
  department?: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  leadership?: string;
  birthFrom?: string;
  birthTo?: string;
  ageMin?: string;
  ageMax?: string;
  gender?: string;
  mobilePhone?: string;
  homePhone?: string;
  email?: string;
  emergencyPhone?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  notes?: string;
  sort?: string;
};

function buildSortHref(filters: FilterValues, sort: string, basePath: string) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value && key !== "sort") {
      params.set(key, value);
    }
  }

  params.set("sort", sort);

  return `${basePath}?${params.toString()}`;
}

function getSortButtonClass(active: boolean) {
  return active
    ? "rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
    : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50";
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<EmployeeSearchParams>;
}) {
  return (
    <EmployeesManagementPage
      basePath="/admin/employees"
      searchParams={searchParams}
    />
  );
}

export async function EmployeesManagementPage({
  basePath,
  showImportButton = false,
  searchParams,
}: {
  basePath: string;
  showImportButton?: boolean;
  searchParams: Promise<EmployeeSearchParams>;
}) {
  const params = await searchParams;

  const sortFilter = String(params.sort ?? "").trim();
  const sortMode = getSortMode(sortFilter);

  const filters: FilterValues = {
    status: String(params.status ?? "").trim(),
    entryFrom: String(params.entryFrom ?? "").trim(),
    entryTo: String(params.entryTo ?? "").trim(),
    exitFrom: String(params.exitFrom ?? "").trim(),
    exitTo: String(params.exitTo ?? "").trim(),
    company: String(params.company ?? "").trim(),
    department: String(params.department ?? "").trim(),
    firstName: String(params.firstName ?? "").trim(),
    lastName: String(params.lastName ?? "").trim(),
    position: String(params.position ?? "").trim(),
    leadership: String(params.leadership ?? "").trim(),
    birthFrom: String(params.birthFrom ?? "").trim(),
    birthTo: String(params.birthTo ?? "").trim(),
    ageMin: String(params.ageMin ?? "").trim(),
    ageMax: String(params.ageMax ?? "").trim(),
    gender: String(params.gender ?? "").trim(),
    mobilePhone: String(params.mobilePhone ?? "").trim(),
    homePhone: String(params.homePhone ?? "").trim(),
    email: String(params.email ?? "").trim(),
    emergencyPhone: String(params.emergencyPhone ?? "").trim(),
    street: String(params.street ?? "").trim(),
    postalCode: String(params.postalCode ?? "").trim(),
    city: String(params.city ?? "").trim(),
    notes: String(params.notes ?? "").trim(),
    sort: sortFilter,
  };

  const filterConditions: Prisma.EmployeeWhereInput[] = [];

  if (filters.status) {
    filterConditions.push({
      statusValue: filters.status,
    });
  }

  const entryFrom = parseDateFilter(filters.entryFrom);
  const entryTo = parseDateFilter(filters.entryTo);

  if (entryFrom) {
    filterConditions.push({
      entryDate: {
        gte: entryFrom,
      },
    });
  }

  if (entryTo) {
    filterConditions.push({
      entryDate: {
        lt: addDays(entryTo, 1),
      },
    });
  }

  const exitFrom = parseDateFilter(filters.exitFrom);
  const exitTo = parseDateFilter(filters.exitTo);

  if (exitFrom) {
    filterConditions.push({
      exitDate: {
        gte: exitFrom,
      },
    });
  }

  if (exitTo) {
    filterConditions.push({
      exitDate: {
        lt: addDays(exitTo, 1),
      },
    });
  }

  if (filters.company) {
    filterConditions.push({
      companyValue: filters.company,
    });
  }

  if (filters.department) {
    filterConditions.push({
      departmentValue: filters.department,
    });
  }

  if (filters.firstName) {
    filterConditions.push({
      firstName: {
        contains: filters.firstName,
      },
    });
  }

  if (filters.lastName) {
    filterConditions.push({
      lastName: {
        contains: filters.lastName,
      },
    });
  }

  if (filters.position) {
    filterConditions.push({
      positions: {
        some: {
          positionValue: filters.position,
        },
      },
    });
  }

  if (filters.leadership === "yes") {
    filterConditions.push({
      isLeadership: true,
    });
  }

  if (filters.leadership === "no") {
    filterConditions.push({
      isLeadership: false,
    });
  }

  const birthFrom = parseDateFilter(filters.birthFrom);
  const birthTo = parseDateFilter(filters.birthTo);

  if (birthFrom) {
    filterConditions.push({
      birthDate: {
        gte: birthFrom,
      },
    });
  }

  if (birthTo) {
    filterConditions.push({
      birthDate: {
        lt: addDays(birthTo, 1),
      },
    });
  }

  const ageMin = parsePositiveNumber(filters.ageMin);
  const ageMax = parsePositiveNumber(filters.ageMax);
  const today = new Date();

  if (ageMin !== null) {
    filterConditions.push({
      birthDate: {
        lte: subtractYears(today, ageMin),
      },
    });
  }

  if (ageMax !== null) {
    filterConditions.push({
      birthDate: {
        gte: addDays(subtractYears(today, ageMax + 1), 1),
      },
    });
  }

  if (filters.gender) {
    filterConditions.push({
      genderValue: filters.gender,
    });
  }

  if (filters.mobilePhone) {
    filterConditions.push({
      mobilePhone: {
        contains: filters.mobilePhone,
      },
    });
  }

  if (filters.homePhone) {
    filterConditions.push({
      homePhone: {
        contains: filters.homePhone,
      },
    });
  }

  if (filters.email) {
    filterConditions.push({
      email: {
        contains: filters.email,
      },
    });
  }

  if (filters.emergencyPhone) {
    filterConditions.push({
      OR: [
        { emergencyFirstName: { contains: filters.emergencyPhone } },
        { emergencyLastName: { contains: filters.emergencyPhone } },
        { emergencyPhone: { contains: filters.emergencyPhone } },
      ],
    });
  }

  if (filters.street) {
    filterConditions.push({
      street: {
        contains: filters.street,
      },
    });
  }

  if (filters.postalCode) {
    filterConditions.push({
      postalCode: {
        contains: filters.postalCode,
      },
    });
  }

  if (filters.city) {
    filterConditions.push({
      city: {
        contains: filters.city,
      },
    });
  }

  if (filters.notes) {
    filterConditions.push({
      notes: {
        contains: filters.notes,
      },
    });
  }

  const employeeWhere: Prisma.EmployeeWhereInput =
    filterConditions.length > 0
      ? {
          AND: filterConditions,
        }
      : {};

  const [
    employees,
    statusOptions,
    companyOptions,
    departmentOptions,
    genderOptions,
    positionOptions,
  ] = await Promise.all([
    prisma.employee.findMany({
      where: employeeWhere,
      include: {
        positions: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy:
        sortMode === "company"
          ? [
              { companyLabel: "asc" },
              { departmentLabel: "asc" },
              { lastName: "asc" },
              { firstName: "asc" },
            ]
          : sortMode === "status"
            ? [
                { statusValue: "asc" },
                { lastName: "asc" },
                { firstName: "asc" },
              ]
            : [{ lastName: "asc" }, { firstName: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        groupKey: "employee_status",
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        groupKey: "employee_company",
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        groupKey: "employee_department",
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        groupKey: "employee_gender",
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        groupKey: "employee_position",
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  const activeEmployees = employees.filter(
    (employee) => employee.statusValue === "active"
  );
  const exitedEmployees = employees.filter((employee) =>
    isExitedEmployeeStatus(employee.statusValue, employee.statusLabel)
  );

  const lkwDrivers = employees.filter((employee) =>
    employee.positions.some(
      (position) => position.positionValue === "lkw_fahrer_in"
    )
  );

  const leadershipEmployees = employees.filter(
    (employee) => employee.isLeadership
  );

  const hasActiveFilters = Object.entries(filters).some(
    ([key, value]) => key !== "sort" && Boolean(value)
  );

  return (
    <AppShell
      title="Mitarbeiter"
      description="Zentrale Mitarbeiterverwaltung mit Berufsgruppen, Firmenzuordnung und automatischer LKW-Fahrer-Synchronisierung."
    >
      {showImportButton ? (
        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Mitarbeiterverwaltung
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Mitarbeiter einzeln pflegen oder Mitarbeiterdaten per Excel
                importieren.
              </p>
            </div>
            <Link
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100"
              href="/employees/imports"
            >
              Mitarbeiter importieren →
            </Link>
          </div>
        </section>
      ) : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <SummaryCard label="Treffer" value={String(employees.length)} />
        <SummaryCard label="Aktiv" value={String(activeEmployees.length)} />
        <SummaryCard label="LKW Fahrer*in" value={String(lkwDrivers.length)} />
        <SummaryCard
          label="Leitung"
          value={String(leadershipEmployees.length)}
        />
        <SummaryCard
          label="Ausgetreten"
          value={String(exitedEmployees.length)}
        />
      </div>

      <details className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-xl font-semibold text-gray-900">
          Mitarbeiter anlegen
        </summary>

        <EmployeeForm
          action={createEmployee}
          statusOptions={statusOptions}
          companyOptions={companyOptions}
          departmentOptions={departmentOptions}
          genderOptions={genderOptions}
          positionOptions={positionOptions}
        />
      </details>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 bg-gray-50 px-6 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Mitarbeiterliste
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Filter direkt in den Tabellenüberschriften wie bei Excel.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={buildSortHref(filters, "lastName", basePath)}
              className={getSortButtonClass(sortMode === "lastName")}
            >
              Nachname A-Z
            </Link>

            <Link
              href={buildSortHref(filters, "company", basePath)}
              className={getSortButtonClass(sortMode === "company")}
            >
              Nach Firma
            </Link>

            <Link
              href={buildSortHref(filters, "status", basePath)}
              className={getSortButtonClass(sortMode === "status")}
            >
              Nach Status
            </Link>

            {hasActiveFilters ? (
              <Link
                href={
                  sortFilter
                    ? `${basePath}?sort=${sortMode}`
                    : basePath
                }
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Alle Filter zurücksetzen
              </Link>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[2260px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th>Aktionen</Th>
                <Th>Foto</Th>

                <FilterTh title="Status" active={Boolean(filters.status)}>
                  <SelectFilter
                    actionPath={basePath}
                    name="status"
                    value={filters.status}
                    filters={filters}
                    exclude={["status"]}
                    options={statusOptions}
                    placeholder="Alle Status"
                  />
                </FilterTh>

                <FilterTh
                  title="Eintritt"
                  active={Boolean(filters.entryFrom || filters.entryTo)}
                >
                  <DateRangeFilter
                    actionPath={basePath}
                    fromName="entryFrom"
                    toName="entryTo"
                    fromValue={filters.entryFrom}
                    toValue={filters.entryTo}
                    filters={filters}
                    exclude={["entryFrom", "entryTo"]}
                  />
                </FilterTh>

                <FilterTh
                  title="Austritt"
                  active={Boolean(filters.exitFrom || filters.exitTo)}
                >
                  <DateRangeFilter
                    actionPath={basePath}
                    fromName="exitFrom"
                    toName="exitTo"
                    fromValue={filters.exitFrom}
                    toValue={filters.exitTo}
                    filters={filters}
                    exclude={["exitFrom", "exitTo"]}
                  />
                </FilterTh>

                <FilterTh title="Firma" active={Boolean(filters.company)}>
                  <SelectFilter
                    actionPath={basePath}
                    name="company"
                    value={filters.company}
                    filters={filters}
                    exclude={["company"]}
                    options={companyOptions}
                    placeholder="Alle Firmen"
                  />
                </FilterTh>

                <FilterTh
                  title="Abteilung"
                  active={Boolean(filters.department)}
                >
                  <SelectFilter
                    actionPath={basePath}
                    name="department"
                    value={filters.department}
                    filters={filters}
                    exclude={["department"]}
                    options={departmentOptions}
                    placeholder="Alle Abteilungen"
                  />
                </FilterTh>

                <FilterTh title="Vorname" active={Boolean(filters.firstName)}>
                  <TextFilter
                    actionPath={basePath}
                    name="firstName"
                    value={filters.firstName}
                    filters={filters}
                    exclude={["firstName"]}
                    placeholder="Vorname enthält..."
                  />
                </FilterTh>

                <FilterTh title="Nachname" active={Boolean(filters.lastName)}>
                  <TextFilter
                    actionPath={basePath}
                    name="lastName"
                    value={filters.lastName}
                    filters={filters}
                    exclude={["lastName"]}
                    placeholder="Nachname enthält..."
                  />
                </FilterTh>

                <FilterTh
                  title="Berufsgruppen"
                  active={Boolean(filters.position)}
                >
                  <SelectFilter
                    actionPath={basePath}
                    name="position"
                    value={filters.position}
                    filters={filters}
                    exclude={["position"]}
                    options={positionOptions}
                    placeholder="Alle Berufsgruppen"
                  />
                </FilterTh>

                <FilterTh title="Leitung" active={Boolean(filters.leadership)}>
                  <SelectFilter
                    actionPath={basePath}
                    name="leadership"
                    value={filters.leadership}
                    filters={filters}
                    exclude={["leadership"]}
                    options={[
                      { value: "yes", label: "Nur Leitung" },
                      { value: "no", label: "Ohne Leitung" },
                    ]}
                    placeholder="Alle"
                  />
                </FilterTh>

                <FilterTh
                  title="Geburtsdatum"
                  active={Boolean(filters.birthFrom || filters.birthTo)}
                >
                  <DateRangeFilter
                    actionPath={basePath}
                    fromName="birthFrom"
                    toName="birthTo"
                    fromValue={filters.birthFrom}
                    toValue={filters.birthTo}
                    filters={filters}
                    exclude={["birthFrom", "birthTo"]}
                  />
                </FilterTh>

                <FilterTh
                  title="Alter"
                  active={Boolean(filters.ageMin || filters.ageMax)}
                >
                  <NumberRangeFilter
                    actionPath={basePath}
                    minName="ageMin"
                    maxName="ageMax"
                    minValue={filters.ageMin}
                    maxValue={filters.ageMax}
                    filters={filters}
                    exclude={["ageMin", "ageMax"]}
                  />
                </FilterTh>

                <FilterTh title="Geschlecht" active={Boolean(filters.gender)}>
                  <SelectFilter
                    actionPath={basePath}
                    name="gender"
                    value={filters.gender}
                    filters={filters}
                    exclude={["gender"]}
                    options={genderOptions}
                    placeholder="Alle Geschlechter"
                  />
                </FilterTh>

                <FilterTh
                  title="Handynummer"
                  active={Boolean(filters.mobilePhone)}
                >
                  <TextFilter
                    actionPath={basePath}
                    name="mobilePhone"
                    value={filters.mobilePhone}
                    filters={filters}
                    exclude={["mobilePhone"]}
                    placeholder="Handynummer enthält..."
                  />
                </FilterTh>

                <FilterTh
                  title="Notfallkontakt"
                  active={Boolean(filters.emergencyPhone)}
                >
                  <TextFilter
                    actionPath={basePath}
                    name="emergencyPhone"
                    value={filters.emergencyPhone}
                    filters={filters}
                    exclude={["emergencyPhone"]}
                    placeholder="Name oder Telefonnummer..."
                  />
                </FilterTh>

                <FilterTh
                  title="Telefon (Haus)"
                  active={Boolean(filters.homePhone)}
                >
                  <TextFilter
                    actionPath={basePath}
                    name="homePhone"
                    value={filters.homePhone}
                    filters={filters}
                    exclude={["homePhone"]}
                    placeholder="Telefonnummer enthält..."
                  />
                </FilterTh>

                <FilterTh title="E-Mail" active={Boolean(filters.email)}>
                  <TextFilter
                    actionPath={basePath}
                    name="email"
                    value={filters.email}
                    filters={filters}
                    exclude={["email"]}
                    placeholder="E-Mail enthält..."
                  />
                </FilterTh>

                <FilterTh title="Straße" active={Boolean(filters.street)}>
                  <TextFilter
                    actionPath={basePath}
                    name="street"
                    value={filters.street}
                    filters={filters}
                    exclude={["street"]}
                    placeholder="Straße enthält..."
                  />
                </FilterTh>

                <FilterTh title="PLZ" active={Boolean(filters.postalCode)}>
                  <TextFilter
                    actionPath={basePath}
                    name="postalCode"
                    value={filters.postalCode}
                    filters={filters}
                    exclude={["postalCode"]}
                    placeholder="PLZ enthält..."
                  />
                </FilterTh>

                <FilterTh title="Ort" active={Boolean(filters.city)}>
                  <TextFilter
                    actionPath={basePath}
                    name="city"
                    value={filters.city}
                    filters={filters}
                    exclude={["city"]}
                    placeholder="Ort enthält..."
                  />
                </FilterTh>

                <FilterTh title="Bemerkung" active={Boolean(filters.notes)}>
                  <TextFilter
                    actionPath={basePath}
                    name="notes"
                    value={filters.notes}
                    filters={filters}
                    exclude={["notes"]}
                    placeholder="Bemerkung enthält..."
                  />
                </FilterTh>
              </tr>
            </thead>

            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={22} className="p-8 text-center text-gray-500">
                    Keine Mitarbeiter für die aktuelle Filterauswahl gefunden.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id} className="border-t border-gray-100">
                    <Td>
                      <DismissibleDetails className="relative">
                        <summary
                          className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition marker:content-none hover:bg-gray-50 [&::-webkit-details-marker]:hidden"
                          title="Mitarbeiter bearbeiten"
                        >
                          <ActionIcon name="edit" className="h-4 w-4" />
                          <span className="sr-only">Bearbeiten</span>
                        </summary>

                        <CloseDetailsButton
                          aria-label="Bearbeiten schließen"
                          className="fixed inset-0 z-40 cursor-default bg-black/20"
                        />

                        <div className="fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-[min(980px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
                          <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                                Mitarbeiter bearbeiten
                              </p>
                              <p className="text-lg font-bold text-gray-950">
                                {employee.firstName} {employee.lastName}
                              </p>
                            </div>

                            <CloseDetailsButton
                              aria-label="Popup schließen"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-xl leading-none text-gray-700 shadow-sm transition hover:bg-gray-50"
                            >
                              ×
                            </CloseDetailsButton>
                          </div>

                          <EmployeeForm
                            action={updateEmployee}
                            id={employee.id}
                            statusOptions={statusOptions}
                            companyOptions={companyOptions}
                            departmentOptions={departmentOptions}
                            genderOptions={genderOptions}
                            positionOptions={positionOptions}
                            defaultStatusValue={employee.statusValue}
                            defaultEntryDate={formatDateInput(
                              employee.entryDate
                            )}
                            defaultExitDate={formatDateInput(employee.exitDate)}
                            defaultCompanyValue={employee.companyValue ?? ""}
                            defaultDepartmentValue={
                              employee.departmentValue ?? ""
                            }
                            defaultFirstName={employee.firstName}
                            defaultLastName={employee.lastName}
                            defaultIsLeadership={employee.isLeadership}
                            defaultCanManagePersonalInventory={
                              employee.canManagePersonalInventory
                            }
                            defaultBirthDate={formatDateInput(
                              employee.birthDate
                            )}
                            defaultGenderValue={employee.genderValue ?? ""}
                            defaultMobilePhone={employee.mobilePhone ?? ""}
                            defaultHomePhone={employee.homePhone ?? ""}
                            defaultEmail={employee.email ?? ""}
                            defaultEmergencyFirstName={
                              employee.emergencyFirstName ?? ""
                            }
                            defaultEmergencyLastName={
                              employee.emergencyLastName ?? ""
                            }
                            defaultEmergencyPhone={
                              employee.emergencyPhone ?? ""
                            }
                            defaultStreet={employee.street ?? ""}
                            defaultPostalCode={employee.postalCode ?? ""}
                            defaultCity={employee.city ?? ""}
                            defaultNotes={employee.notes ?? ""}
                            defaultPhotoUrl={employee.photoUrl ?? ""}
                            defaultPositionValues={employee.positions.map(
                              (position) => position.positionValue
                            )}
                          />

                          <form action={deleteEmployee} className="mt-3">
                            <input
                              type="hidden"
                              name="id"
                              value={employee.id}
                            />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Mitarbeiter löschen
                            </button>
                          </form>
                        </div>
                      </DismissibleDetails>
                    </Td>

                    <Td>
                      <EmployeePhotoAvatar
                        photoUrl={employee.photoUrl}
                        employeeName={`${employee.firstName} ${employee.lastName}`}
                      />
                    </Td>

                    <Td>
                      <span className={getStatusClass(employee.statusValue)}>
                        {employee.statusLabel}
                      </span>
                    </Td>

                    <Td>{formatGermanDate(employee.entryDate)}</Td>
                    <Td>{formatGermanDate(employee.exitDate)}</Td>
                    <Td>{employee.companyLabel ?? "-"}</Td>
                    <Td>{employee.departmentLabel ?? "-"}</Td>

                    <Td>
                      <span className="font-semibold text-gray-900">
                        {employee.firstName}
                      </span>
                    </Td>

                    <Td>
                      <span className="font-semibold text-gray-900">
                        {employee.lastName}
                      </span>
                    </Td>

                    <Td>
                      {employee.positions.length === 0 ? (
                        <span className="text-gray-400">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {employee.positions.map((position, index) => (
                            <span
                              key={position.id}
                              className={
                                index === 0
                                  ? "rounded-full bg-gray-900 px-2 py-1 text-xs font-semibold text-white"
                                  : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                              }
                            >
                              {position.positionLabel}
                            </span>
                          ))}
                        </div>
                      )}
                    </Td>

                    <Td>
                      {employee.isLeadership ? (
                        <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-800">
                          Leitung
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </Td>

                    <Td>{formatGermanDate(employee.birthDate)}</Td>
                    <Td>{calculateAge(employee.birthDate)}</Td>
                    <Td>{employee.genderLabel ?? "-"}</Td>
                    <Td>{employee.mobilePhone ?? "-"}</Td>
                    <Td>
                      {[
                        [employee.emergencyFirstName, employee.emergencyLastName]
                          .filter(Boolean)
                          .join(" "),
                        employee.emergencyPhone,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "-"}
                    </Td>
                    <Td>{employee.homePhone ?? "-"}</Td>
                    <Td>{employee.email ?? "-"}</Td>
                    <Td>{employee.street ?? "-"}</Td>
                    <Td>{employee.postalCode ?? "-"}</Td>
                    <Td>{employee.city ?? "-"}</Td>

                    <Td>
                      <div className="max-w-[260px] whitespace-normal">
                        {employee.notes ?? "-"}
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function EmployeeForm({
  action,
  id,
  statusOptions,
  companyOptions,
  departmentOptions,
  genderOptions,
  positionOptions,
  defaultStatusValue = "active",
  defaultEntryDate = "",
  defaultExitDate = "",
  defaultCompanyValue = "",
  defaultDepartmentValue = "",
  defaultFirstName = "",
  defaultLastName = "",
  defaultIsLeadership = false,
  defaultCanManagePersonalInventory = false,
  defaultBirthDate = "",
  defaultGenderValue = "",
  defaultMobilePhone = "",
  defaultHomePhone = "",
  defaultEmail = "",
  defaultEmergencyFirstName = "",
  defaultEmergencyLastName = "",
  defaultEmergencyPhone = "",
  defaultStreet = "",
  defaultPostalCode = "",
  defaultCity = "",
  defaultNotes = "",
  defaultPhotoUrl = "",
  defaultPositionValues = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  id?: string;
  statusOptions: { value: string; label: string }[];
  companyOptions: { value: string; label: string }[];
  departmentOptions: { value: string; label: string }[];
  genderOptions: { value: string; label: string }[];
  positionOptions: { value: string; label: string }[];
  defaultStatusValue?: string;
  defaultEntryDate?: string;
  defaultExitDate?: string;
  defaultCompanyValue?: string;
  defaultDepartmentValue?: string;
  defaultFirstName?: string;
  defaultLastName?: string;
  defaultIsLeadership?: boolean;
  defaultCanManagePersonalInventory?: boolean;
  defaultBirthDate?: string;
  defaultGenderValue?: string;
  defaultMobilePhone?: string;
  defaultHomePhone?: string;
  defaultEmail?: string;
  defaultEmergencyFirstName?: string;
  defaultEmergencyLastName?: string;
  defaultEmergencyPhone?: string;
  defaultStreet?: string;
  defaultPostalCode?: string;
  defaultCity?: string;
  defaultNotes?: string;
  defaultPhotoUrl?: string;
  defaultPositionValues?: string[];
}) {
  return (
    <form action={action} encType="multipart/form-data" className="mt-6 space-y-5">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-gray-800">
          Status
          <select
            name="statusValue"
            defaultValue={defaultStatusValue}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Eintritt
          <input
            name="entryDate"
            type="date"
            defaultValue={defaultEntryDate}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Austritt
          <input
            name="exitDate"
            type="date"
            defaultValue={defaultExitDate}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Firma
          <select
            name="companyValue"
            defaultValue={defaultCompanyValue}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Firma wählen</option>
            {companyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Abteilung
          <select
            name="departmentValue"
            defaultValue={defaultDepartmentValue}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Abteilung wählen</option>
            {departmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Vorname
          <input
            name="firstName"
            required
            defaultValue={defaultFirstName}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Nachname
          <input
            name="lastName"
            required
            defaultValue={defaultLastName}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Geburtsdatum
          <input
            name="birthDate"
            type="date"
            defaultValue={defaultBirthDate}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Geschlecht
          <select
            name="genderValue"
            defaultValue={defaultGenderValue}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Geschlecht wählen</option>
            {genderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Handynummer
          <input
            name="mobilePhone"
            defaultValue={defaultMobilePhone}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Telefonnummer (Haus)
          <input
            name="homePhone"
            type="tel"
            defaultValue={defaultHomePhone}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          E-Mail-Adresse
          <input
            name="email"
            type="email"
            defaultValue={defaultEmail}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Notfallkontakt Vorname
          <input
            name="emergencyFirstName"
            defaultValue={defaultEmergencyFirstName}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Notfallkontakt Nachname
          <input
            name="emergencyLastName"
            defaultValue={defaultEmergencyLastName}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Notfallkontakt Telefonnummer
          <input
            name="emergencyPhone"
            type="tel"
            defaultValue={defaultEmergencyPhone}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Straße
          <input
            name="street"
            defaultValue={defaultStreet}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          PLZ
          <input
            name="postalCode"
            defaultValue={defaultPostalCode}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Ort
          <input
            name="city"
            defaultValue={defaultCity}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <div className="text-sm font-medium text-gray-800">
          <div>Mitarbeiterfoto</div>
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">
              Foto auswählen
            </span>
          <input
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-gray-600">
              Kamera öffnen
            </span>
            <input
              name="photoCamera"
              type="file"
              accept="image/*"
              capture="user"
              className="w-full rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-gray-900"
            />
          </label>
          {defaultPhotoUrl ? (
            <span className="mt-2 flex items-center gap-2 text-xs font-medium text-gray-500">
              <Image
                src={defaultPhotoUrl}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover ring-1 ring-gray-200"
              />
              Aktuelles Foto bleibt erhalten, wenn kein neues ausgewählt wird.
            </span>
          ) : (
            <span className="mt-2 block text-xs font-medium text-gray-500">
              JPG, PNG oder WebP. Auf Handy und Tablet öffnet „Kamera“ direkt
              die Frontkamera.
            </span>
          )}
        </div>
      </div>

      <PositionPicker
        options={positionOptions}
        defaultValues={defaultPositionValues}
        defaultIsLeadership={defaultIsLeadership}
        defaultCanManagePersonalInventory={
          defaultCanManagePersonalInventory
        }
      />

      <label className="block text-sm font-medium text-gray-800">
        Bemerkung
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <button
        type="submit"
        className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
      >
        Speichern
      </button>
    </form>
  );
}

function EmployeePhotoAvatar({
  photoUrl,
  employeeName,
}: {
  photoUrl: string | null;
  employeeName: string;
}) {
  if (!photoUrl) {
    return (
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs font-bold uppercase text-gray-400 ring-1 ring-gray-200"
        title="Kein Foto hinterlegt"
      >
        —
      </div>
    );
  }

  return (
    <DismissibleDetails className="relative">
      <summary
        className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full marker:content-none [&::-webkit-details-marker]:hidden"
        title={`${employeeName} Foto vergrößern`}
      >
        <Image
          src={photoUrl}
          alt={`Foto von ${employeeName}`}
          width={40}
          height={40}
          className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm outline outline-1 outline-gray-200 transition hover:scale-105"
        />
      </summary>

      <CloseDetailsButton
        aria-label="Fotoansicht schließen"
        className="fixed inset-0 z-[120] cursor-default bg-black/70"
      />

      <div className="pointer-events-none fixed inset-0 z-[121] flex items-center justify-center p-6">
        <div className="pointer-events-auto relative max-h-[90vh] max-w-[90vw] rounded-2xl bg-white p-3 shadow-2xl">
          <Image
            src={photoUrl}
            alt={`Foto von ${employeeName}`}
            width={960}
            height={720}
            className="max-h-[78vh] max-w-[82vw] rounded-xl object-contain"
          />
          <div className="mt-3 text-center text-sm font-semibold text-gray-900">
            {employeeName}
          </div>
          <div className="mt-1 text-center text-xs font-medium text-gray-500">
            Klick außerhalb oder Esc schließt die Ansicht.
          </div>
        </div>
      </div>
    </DismissibleDetails>
  );
}

function HiddenFilterInputs({
  filters,
  exclude,
}: {
  filters: FilterValues;
  exclude: string[];
}) {
  return (
    <>
      {Object.entries(filters).map(([key, value]) => {
        if (!value || exclude.includes(key)) {
          return null;
        }

        return <input key={key} type="hidden" name={key} value={value} />;
      })}
    </>
  );
}

function FilterTh({
  title,
  active,
  children,
}: {
  title: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <th className="relative whitespace-nowrap p-4 font-semibold">
      <div className="flex items-center gap-2">
        <span>{title}</span>

        <details className="relative">
          <summary
            className={
              active
                ? "flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-md bg-gray-900 text-xs text-white"
                : "flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-md border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
            }
            title="Filter"
          >
            ▾
          </summary>

          <div className="absolute left-0 top-8 z-30 w-72 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-xl">
            {children}
          </div>
        </details>
      </div>
    </th>
  );
}

function TextFilter({
  actionPath,
  name,
  value,
  filters,
  exclude,
  placeholder,
}: {
  actionPath: string;
  name: string;
  value: string;
  filters: FilterValues;
  exclude: string[];
  placeholder: string;
}) {
  return (
    <form action={actionPath} className="space-y-3">
      <HiddenFilterInputs filters={filters} exclude={exclude} />

      <label className="block text-xs font-semibold text-gray-700">
        Text enthält
        <input
          name={name}
          defaultValue={value}
          placeholder={placeholder}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
      >
        Anwenden
      </button>
    </form>
  );
}

function SelectFilter({
  actionPath,
  name,
  value,
  filters,
  exclude,
  options,
  placeholder,
}: {
  actionPath: string;
  name: string;
  value: string;
  filters: FilterValues;
  exclude: string[];
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <form action={actionPath} className="space-y-3">
      <HiddenFilterInputs filters={filters} exclude={exclude} />

      <label className="block text-xs font-semibold text-gray-700">
        Auswahl
        <select
          name={name}
          defaultValue={value}
          className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900"
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        className="w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
      >
        Anwenden
      </button>
    </form>
  );
}

function DateRangeFilter({
  actionPath,
  fromName,
  toName,
  fromValue,
  toValue,
  filters,
  exclude,
}: {
  actionPath: string;
  fromName: string;
  toName: string;
  fromValue: string;
  toValue: string;
  filters: FilterValues;
  exclude: string[];
}) {
  return (
    <form action={actionPath} className="space-y-3">
      <HiddenFilterInputs filters={filters} exclude={exclude} />

      <label className="block text-xs font-semibold text-gray-700">
        Von
        <input
          type="date"
          name={fromName}
          defaultValue={fromValue}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
        />
      </label>

      <label className="block text-xs font-semibold text-gray-700">
        Bis
        <input
          type="date"
          name={toName}
          defaultValue={toValue}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
      >
        Anwenden
      </button>
    </form>
  );
}

function NumberRangeFilter({
  actionPath,
  minName,
  maxName,
  minValue,
  maxValue,
  filters,
  exclude,
}: {
  actionPath: string;
  minName: string;
  maxName: string;
  minValue: string;
  maxValue: string;
  filters: FilterValues;
  exclude: string[];
}) {
  return (
    <form action={actionPath} className="space-y-3">
      <HiddenFilterInputs filters={filters} exclude={exclude} />

      <label className="block text-xs font-semibold text-gray-700">
        Mindestens
        <input
          type="number"
          name={minName}
          defaultValue={minValue}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
        />
      </label>

      <label className="block text-xs font-semibold text-gray-700">
        Maximal
        <input
          type="number"
          name={maxName}
          defaultValue={maxValue}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
      >
        Anwenden
      </button>
    </form>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap p-4 font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="p-4 align-top text-gray-700">{children}</td>;
}
