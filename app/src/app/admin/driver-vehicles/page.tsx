import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createDriverVehicleAssignment,
  deleteDriverVehicleAssignment,
  updateDriverVehicleAssignment,
} from "./actions";

type FilterStatus = "all" | "active" | "inactive";
type FilterPrimary = "all" | "primary" | "secondary";

type PersonOption = {
  value: string;
  driverId: string | null;
  label: string;
  subLabel: string;
  searchText: string;
};

function normalizeSearch(value: string | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeFilterText(value: string | undefined) {
  return String(value ?? "").trim();
}

function getFilterStatus(value: string | undefined): FilterStatus {
  if (value === "active" || value === "inactive") return value;
  return "all";
}

function getFilterPrimary(value: string | undefined): FilterPrimary {
  if (value === "primary" || value === "secondary") return value;
  return "all";
}

function getVehicleLabel(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  isActive?: boolean;
}) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.category,
    vehicle.vehicleType,
    vehicle.isActive === false ? "inaktiv" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getPositionLabel(employee: {
  positions: { positionLabel: string }[];
}) {
  return (
    employee.positions.map((position) => position.positionLabel).join(", ") ||
    "ohne Berufsgruppe"
  );
}

function includesFilter(source: unknown, filter: string) {
  if (!filter) return true;

  return String(source ?? "")
    .toLowerCase()
    .includes(filter);
}

function buildPersonFilterText({
  assignment,
  personOption,
}: {
  assignment: {
    driver: {
      firstName: string;
      lastName: string;
      shortcut: string | null;
      phone: string | null;
      employee: {
        mobilePhone: string | null;
      } | null;
    };
  };
  personOption: PersonOption | undefined;
}) {
  return [
    assignment.driver.lastName,
    assignment.driver.firstName,
    assignment.driver.shortcut,
    assignment.driver.phone,
    assignment.driver.employee?.mobilePhone,
    personOption?.subLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildVehicleFilterText(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  isActive?: boolean;
}) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.vehicleType,
    vehicle.category,
    getVehicleLabel(vehicle),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default async function DriverVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    person?: string;
    vehicle?: string;
    vehicleNumber?: string;
    licensePlate?: string;
    vehicleType?: string;
    status?: string;
    primary?: string;
    category?: string;
    notes?: string;
  }>;
}) {
  const params = await searchParams;
  const searchText = normalizeSearch(params.q);
  const filterPersonText = normalizeSearch(params.person);
  const filterVehicleText = normalizeSearch(params.vehicle);
  const filterVehicleNumber = normalizeSearch(params.vehicleNumber);
  const filterLicensePlate = normalizeSearch(params.licensePlate);
  const filterVehicleType = normalizeSearch(params.vehicleType);
  const filterStatus = getFilterStatus(params.status);
  const filterPrimary = getFilterPrimary(params.primary);
  const filterCategory = normalizeFilterText(params.category);
  const filterNotes = normalizeSearch(params.notes);

  const [employees, drivers, vehicles, assignments] = await Promise.all([
    prisma.employee.findMany({
      where: {
        statusValue: "active",
      },
      include: {
        driver: true,
        positions: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),

    prisma.driver.findMany({
      where: {
        isActive: true,
      },
      include: {
        employee: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),

    prisma.vehicle.findMany({
      orderBy: [
        { isActive: "desc" },
        { category: "asc" },
        { vehicleNumber: "asc" },
      ],
    }),

    prisma.driverVehicleAssignment.findMany({
      include: {
        driver: {
          include: {
            employee: true,
          },
        },
        vehicle: true,
      },
      orderBy: [
        { isActive: "desc" },
        { isPrimary: "desc" },
        { driver: { lastName: "asc" } },
        { vehicle: { vehicleNumber: "asc" } },
      ],
    }),
  ]);

  const activeVehicles = vehicles.filter((vehicle) => vehicle.isActive);

  const employeePersonOptions: PersonOption[] = employees.map((employee) => {
    const positionLabel = getPositionLabel(employee);

    return {
      value: `employee:${employee.id}`,
      driverId: employee.driverId,
      label: `${employee.lastName}, ${employee.firstName}`,
      subLabel: `Mitarbeiter · ${positionLabel}${
        employee.driverId ? "" : " · Fahrer wird beim Speichern angelegt"
      }`,
      searchText: [
        employee.lastName,
        employee.firstName,
        employee.mobilePhone,
        positionLabel,
        employee.driver?.shortcut,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  const employeeDriverIds = new Set(
    employees.map((employee) => employee.driverId).filter(Boolean),
  );

  const driverOnlyPersonOptions: PersonOption[] = drivers
    .filter((driver) => !employeeDriverIds.has(driver.id) && !driver.employee)
    .map((driver) => ({
      value: `driver:${driver.id}`,
      driverId: driver.id,
      label: `${driver.lastName}, ${driver.firstName}`,
      subLabel: driver.shortcut
        ? `Fahrer-Stamm · Kürzel: ${driver.shortcut}`
        : "Fahrer-Stamm ohne Mitarbeiter-Verknüpfung",
      searchText: [
        driver.lastName,
        driver.firstName,
        driver.shortcut,
        driver.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    }));

  const personOptions = [...employeePersonOptions, ...driverOnlyPersonOptions];

  const personOptionByDriverId = new Map(
    personOptions
      .filter((person) => person.driverId)
      .map((person) => [person.driverId as string, person]),
  );

  const vehicleCategories = Array.from(
    new Set(vehicles.map((vehicle) => vehicle.category).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "de-DE"));

  const vehicleNumbers = Array.from(
    new Set(vehicles.map((vehicle) => vehicle.vehicleNumber).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "de-DE", { numeric: true }));

  const vehicleTypes = Array.from(
    new Set(vehicles.map((vehicle) => vehicle.vehicleType).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "de-DE"));

  const activeAssignedVehicleIds = new Set(
    assignments
      .filter((assignment) => assignment.isActive)
      .map((assignment) => assignment.vehicleId),
  );

  const activeAssignedDriverIds = new Set(
    assignments
      .filter((assignment) => assignment.isActive)
      .map((assignment) => assignment.driverId),
  );

  const freeVehicles = activeVehicles.filter(
    (vehicle) => !activeAssignedVehicleIds.has(vehicle.id),
  );

  const peopleWithoutVehicle = personOptions.filter(
    (person) =>
      !person.driverId || !activeAssignedDriverIds.has(person.driverId),
  );

  const filteredAssignments = assignments.filter((assignment) => {
    if (filterStatus === "active" && !assignment.isActive) return false;
    if (filterStatus === "inactive" && assignment.isActive) return false;
    if (filterPrimary === "primary" && !assignment.isPrimary) return false;
    if (filterPrimary === "secondary" && assignment.isPrimary) return false;
    if (filterCategory && assignment.vehicle.category !== filterCategory) {
      return false;
    }

    const personOption = personOptionByDriverId.get(assignment.driverId);
    const personFilterText = buildPersonFilterText({
      assignment,
      personOption,
    });
    const vehicleFilterText = buildVehicleFilterText(assignment.vehicle);

    if (filterPersonText && !personFilterText.includes(filterPersonText)) {
      return false;
    }

    if (filterVehicleText && !vehicleFilterText.includes(filterVehicleText)) {
      return false;
    }

    if (
      filterVehicleNumber &&
      !includesFilter(assignment.vehicle.vehicleNumber, filterVehicleNumber)
    ) {
      return false;
    }

    if (
      filterLicensePlate &&
      !includesFilter(assignment.vehicle.licensePlate, filterLicensePlate)
    ) {
      return false;
    }

    if (
      filterVehicleType &&
      !includesFilter(assignment.vehicle.vehicleType, filterVehicleType)
    ) {
      return false;
    }

    if (filterNotes && !includesFilter(assignment.notes, filterNotes)) {
      return false;
    }

    if (!searchText) return true;

    const haystack = [
      assignment.driver.lastName,
      assignment.driver.firstName,
      assignment.driver.shortcut,
      assignment.driver.phone,
      assignment.driver.employee?.mobilePhone,
      personOption?.label,
      personOption?.subLabel,
      personOption?.searchText,
      getVehicleLabel(assignment.vehicle),
      assignment.vehicle.vehicleNumber,
      assignment.vehicle.licensePlate,
      assignment.vehicle.vehicleType,
      assignment.vehicle.category,
      assignment.isPrimary
        ? "hauptfahrzeug ja primär primary"
        : "kein hauptfahrzeug nein zweitfahrzeug secondary",
      assignment.isActive ? "aktiv ja active" : "inaktiv nein inactive",
      assignment.notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchText);
  });

  const hasActiveFilters = Boolean(
    searchText ||
      filterPersonText ||
      filterVehicleText ||
      filterVehicleNumber ||
      filterLicensePlate ||
      filterVehicleType ||
      filterStatus !== "all" ||
      filterPrimary !== "all" ||
      filterCategory ||
      filterNotes,
  );

  return (
    <AppShell
      title="Fahrer-Fahrzeug-Zuordnung"
      description="Feste Fahrzeuge, Stammfahrzeuge und freie Fahrzeuge für Langstrecke und Kurzstrecke verwalten. Mitarbeiter ohne Fahrer-Stammsatz werden beim Speichern automatisch angelegt."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard
          label="Aktive Zuordnungen"
          value={String(
            assignments.filter((assignment) => assignment.isActive).length,
          )}
          hint="Mitarbeiter/Fahrer mit festem Fahrzeug"
        />

        <SummaryCard
          label="Freie Fahrzeuge"
          value={String(freeVehicles.length)}
          hint="Aktive Fahrzeuge ohne feste Zuordnung"
        />

        <SummaryCard
          label="Ohne Fahrzeug"
          value={String(peopleWithoutVehicle.length)}
          hint="Aktive Mitarbeiter/Fahrer ohne Zuordnung"
        />

        <SummaryCard
          label="Gefiltert"
          value={String(filteredAssignments.length)}
          hint="sichtbare Tabellenzeilen"
        />
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Neue Zuordnung anlegen
        </h2>

        <form
          action={createDriverVehicleAssignment}
          className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5"
        >
          <PersonSelect
            name="driverPersonId"
            label="Mitarbeiter / Fahrer"
            options={personOptions}
            defaultValue=""
            required
          />

          <VehicleSelect
            name="vehicleId"
            label="Fahrzeug / Kombination"
            options={activeVehicles}
            assignedVehicleIds={activeAssignedVehicleIds}
            defaultValue=""
            required
            className="lg:col-span-2"
          />

          <label className="text-sm font-medium text-gray-800">
            Bemerkung
            <input
              name="notes"
              placeholder="z.B. Stammfahrzeug"
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          <div className="flex flex-col justify-end gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                name="isPrimary"
                defaultChecked
                className="h-4 w-4"
              />
              Hauptfahrzeug
            </label>

            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Zuordnung speichern
            </button>
          </div>
        </form>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Schnellsuche
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Ein Feld für alles: Mitarbeiter/Fahrer, Fahrzeugnummer,
              Kennzeichen, Typ, Kategorie, Hauptfahrzeug, Aktiv-Status oder
              Bemerkung.
            </p>
          </div>

          {hasActiveFilters ? (
            <Link
              href="/admin/driver-vehicles"
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Suche zurücksetzen
            </Link>
          ) : null}
        </div>

        <form action="/admin/driver-vehicles" className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(320px,1fr)_auto] lg:items-end">
            <label className="text-sm font-medium text-gray-800">
              Schnellsuche
              <input
                name="q"
                defaultValue={params.q ?? ""}
                autoFocus
                placeholder="Alles durchsuchen: Müller, AB-ST, 101, Bagger, aktiv, Hauptfahrzeug ..."
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Suchen
              </button>

              {hasActiveFilters ? (
                <Link
                  href="/admin/driver-vehicles"
                  className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Spaltenfilter optional
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-medium text-gray-800">
                Mitarbeiter / Fahrer
                <input
                  name="person"
                  defaultValue={params.person ?? ""}
                  placeholder="Name, Kürzel, Telefon ..."
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                />
              </label>

              <label className="text-sm font-medium text-gray-800">
                Fahrzeug / Kombination
                <input
                  name="vehicle"
                  defaultValue={params.vehicle ?? ""}
                  placeholder="Nr., Kennzeichen, Typ, Kategorie ..."
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                />
              </label>

              <label className="text-sm font-medium text-gray-800">
                Fahrzeugnummer
                <select
                  name="vehicleNumber"
                  defaultValue={params.vehicleNumber ?? ""}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                >
                  <option value="">Alle Fahrzeugnummern</option>
                  {vehicleNumbers.map((vehicleNumber) => (
                    <option key={vehicleNumber} value={vehicleNumber}>
                      {vehicleNumber}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-gray-800">
                Kennzeichen
                <input
                  name="licensePlate"
                  defaultValue={params.licensePlate ?? ""}
                  placeholder="z.B. AB-ST ..."
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                />
              </label>

              <label className="text-sm font-medium text-gray-800">
                Typ
                <select
                  name="vehicleType"
                  defaultValue={params.vehicleType ?? ""}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                >
                  <option value="">Alle Typen</option>
                  {vehicleTypes.map((vehicleType) => (
                    <option key={vehicleType} value={vehicleType}>
                      {vehicleType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-gray-800">
                Kategorie
                <select
                  name="category"
                  defaultValue={filterCategory}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                >
                  <option value="">Alle Kategorien</option>
                  {vehicleCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-gray-800">
                Hauptfahrzeug
                <select
                  name="primary"
                  defaultValue={filterPrimary}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                >
                  <option value="all">Alle</option>
                  <option value="primary">Nur Hauptfahrzeug</option>
                  <option value="secondary">Nur weitere Fahrzeuge</option>
                </select>
              </label>

              <label className="text-sm font-medium text-gray-800">
                Aktiv
                <select
                  name="status"
                  defaultValue={filterStatus}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                >
                  <option value="all">Alle</option>
                  <option value="active">Nur aktiv</option>
                  <option value="inactive">Nur inaktiv</option>
                </select>
              </label>
            </div>
          </div>
        </form>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Bestehende Zuordnungen
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Fahrer/Mitarbeiter, Fahrzeug, Hauptfahrzeug, Aktiv-Status und
              Bemerkung können direkt in der Zeile geändert werden.
            </p>
          </div>

          <div className="text-sm font-semibold text-gray-600">
            {filteredAssignments.length} von {assignments.length} sichtbar
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th>Mitarbeiter / Fahrer</Th>
                <Th>Fahrzeug / Kombination</Th>
                <Th>Fahrzeugnummer</Th>
                <Th>Kennzeichen</Th>
                <Th>Typ</Th>
                <Th>Kategorie</Th>
                <Th>Hauptfahrzeug</Th>
                <Th>Aktiv</Th>
                <Th>Bemerkung</Th>
                <Th>Aktionen</Th>
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    Keine Zuordnung passt zu den aktuellen Filtern.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((assignment) => {
                  const formId = `driver-vehicle-form-${assignment.id}`;
                  const currentPersonValue = assignment.driver.employee?.id
                    ? `employee:${assignment.driver.employee.id}`
                    : `driver:${assignment.driverId}`;

                  return (
                    <tr
                      key={assignment.id}
                      className="border-t border-gray-100"
                    >
                      <Td>
                        <form
                          id={formId}
                          action={updateDriverVehicleAssignment}
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={assignment.id}
                          />
                        </form>

                        <PersonSelect
                          formId={formId}
                          name="driverPersonId"
                          label=""
                          options={personOptions}
                          defaultValue={currentPersonValue}
                          required
                          compact
                        />

                        {assignment.driver.employee ? (
                          <div className="mt-1 text-xs text-gray-500">
                            aus Mitarbeiterstamm
                          </div>
                        ) : assignment.driver.shortcut ? (
                          <div className="mt-1 text-xs text-gray-500">
                            Kürzel: {assignment.driver.shortcut}
                          </div>
                        ) : null}
                      </Td>

                      <Td>
                        <VehicleSelect
                          formId={formId}
                          name="vehicleId"
                          label=""
                          options={vehicles}
                          assignedVehicleIds={activeAssignedVehicleIds}
                          currentVehicleId={assignment.vehicleId}
                          defaultValue={assignment.vehicleId}
                          required
                          compact
                        />
                      </Td>

                      <Td>{assignment.vehicle.vehicleNumber}</Td>
                      <Td>{assignment.vehicle.licensePlate ?? "-"}</Td>
                      <Td>{assignment.vehicle.vehicleType}</Td>
                      <Td>{assignment.vehicle.category}</Td>

                      <Td>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            form={formId}
                            type="checkbox"
                            name="isPrimary"
                            defaultChecked={assignment.isPrimary}
                            className="h-4 w-4"
                          />
                          ja
                        </label>
                      </Td>

                      <Td>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            form={formId}
                            type="checkbox"
                            name="isActive"
                            defaultChecked={assignment.isActive}
                            className="h-4 w-4"
                          />
                          aktiv
                        </label>
                      </Td>

                      <Td>
                        <input
                          form={formId}
                          name="notes"
                          defaultValue={assignment.notes ?? ""}
                          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                        />
                      </Td>

                      <Td>
                        <div className="flex gap-2">
                          <button
                            form={formId}
                            type="submit"
                            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                          >
                            Speichern
                          </button>

                          <form action={deleteDriverVehicleAssignment}>
                            <input
                              type="hidden"
                              name="id"
                              value={assignment.id}
                            />

                            <button
                              type="submit"
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Löschen
                            </button>
                          </form>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InfoList
          title="Freie Fahrzeuge"
          emptyText="Keine freien Fahrzeuge vorhanden."
          items={freeVehicles.map((vehicle) => ({
            id: vehicle.id,
            title: `${vehicle.vehicleNumber} · ${vehicle.licensePlate ?? "-"}`,
            description: `${vehicle.category} · ${vehicle.vehicleType}`,
          }))}
        />

        <InfoList
          title="Mitarbeiter/Fahrer ohne feste Zuordnung"
          emptyText="Alle aktiven Mitarbeiter/Fahrer haben eine Fahrzeugzuordnung."
          items={peopleWithoutVehicle.map((person) => ({
            id: person.value,
            title: person.label,
            description: person.subLabel,
          }))}
        />
      </div>
    </AppShell>
  );
}

function PersonSelect({
  formId,
  name,
  label,
  options,
  defaultValue,
  required = false,
  compact = false,
}: {
  formId?: string;
  name: string;
  label: string;
  options: PersonOption[];
  defaultValue: string;
  required?: boolean;
  compact?: boolean;
}) {
  const select = (
    <select
      form={formId}
      name={name}
      required={required}
      defaultValue={defaultValue}
      className={
        compact
          ? "w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          : "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      }
    >
      <option value="" disabled>
        Mitarbeiter/Fahrer wählen
      </option>

      {options.map((person) => (
        <option key={person.value} value={person.value}>
          {person.label} · {person.subLabel}
        </option>
      ))}
    </select>
  );

  if (!label) return select;

  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      {select}
    </label>
  );
}

function VehicleSelect({
  formId,
  name,
  label,
  options,
  assignedVehicleIds,
  currentVehicleId,
  defaultValue,
  required = false,
  compact = false,
  className = "",
}: {
  formId?: string;
  name: string;
  label: string;
  options: {
    id: string;
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
    isActive: boolean;
  }[];
  assignedVehicleIds: Set<string>;
  currentVehicleId?: string;
  defaultValue: string;
  required?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const select = (
    <select
      form={formId}
      name={name}
      required={required}
      defaultValue={defaultValue}
      className={
        compact
          ? "w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          : "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      }
    >
      <option value="" disabled>
        Fahrzeug wählen
      </option>

      {options.map((vehicle) => {
        const assigned =
          assignedVehicleIds.has(vehicle.id) && vehicle.id !== currentVehicleId;

        return (
          <option key={vehicle.id} value={vehicle.id}>
            {assigned ? "bereits zugeordnet · " : ""}
            {getVehicleLabel(vehicle)}
          </option>
        );
      })}
    </select>
  );

  if (!label) return select;

  return (
    <label className={`text-sm font-medium text-gray-800 ${className}`}>
      {label}
      {select}
    </label>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function InfoList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: {
    id: string;
    title: string;
    description: string;
  }[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-gray-50 p-3"
            >
              <div className="text-sm font-semibold text-gray-900">
                {item.title}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {item.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap p-4 font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="p-4 align-top">{children}</td>;
}
