import Link from "next/link";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { ActionIcon } from "@/components/ActionIcon";
import { prisma } from "@/lib/prisma";
import { createVehicle, deleteVehicle, updateVehicle } from "./actions";

function formatTons(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLiters(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeFilterValue(value: string | undefined) {
  return String(value ?? "").trim();
}

function normalizeSearchValue(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function includesSearchValue(value: string | null | undefined, filter: string) {
  if (!filter) return true;
  return normalizeSearchValue(value).includes(normalizeSearchValue(filter));
}

function getUniqueOptions(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "de-DE", { numeric: true }));
}

function getVehicleSearchText(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  asphaltPayloadTons: number;
  tackCoatTankLiters: number;
  isSpecialVehicle: boolean;
  isActive: boolean;
  notes: string | null;
}) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.vehicleType,
    vehicle.category,
    formatTons(vehicle.asphaltPayloadTons),
    formatLiters(vehicle.tackCoatTankLiters),
    vehicle.isSpecialVehicle ? "Sonderfahrzeug" : "kein Sonderfahrzeug",
    vehicle.isSpecialVehicle ? "ja" : "nein",
    vehicle.isActive ? "aktiv" : "inaktiv",
    vehicle.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    vehicleNumber?: string;
    licensePlate?: string;
    vehicleType?: string;
    category?: string;
    special?: string;
    active?: string;
    notes?: string;
  }>;
}) {
  const params = await searchParams;

  const quickSearch = normalizeFilterValue(params.q);
  const vehicleNumberFilter = normalizeFilterValue(params.vehicleNumber);
  const licensePlateFilter = normalizeFilterValue(params.licensePlate);
  const vehicleTypeFilter = normalizeFilterValue(params.vehicleType);
  const categoryFilter = normalizeFilterValue(params.category);
  const specialFilter = normalizeFilterValue(params.special);
  const activeFilter = normalizeFilterValue(params.active);
  const notesFilter = normalizeFilterValue(params.notes);

  const [vehicles, options] = await Promise.all([
    prisma.vehicle.findMany({
      orderBy: [
        { isActive: "desc" },
        { category: "asc" },
        { vehicleNumber: "asc" },
      ],
    }),

    prisma.adminOption.findMany({
      where: {
        isActive: true,
        groupKey: {
          in: ["vehicle_type", "vehicle_category"],
        },
      },
      orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  const vehicleTypeOptions = options
    .filter((option) => option.groupKey === "vehicle_type")
    .map((option) => option.label);

  const categoryOptions = options
    .filter((option) => option.groupKey === "vehicle_category")
    .map((option) => option.label);

  const vehicleNumberOptions = getUniqueOptions(
    vehicles.map((vehicle) => vehicle.vehicleNumber),
  );
  const licensePlateOptions = getUniqueOptions(
    vehicles.map((vehicle) => vehicle.licensePlate),
  );
  const vehicleTypeFilterOptions = getUniqueOptions([
    ...vehicleTypeOptions,
    ...vehicles.map((vehicle) => vehicle.vehicleType),
  ]);
  const categoryFilterOptions = getUniqueOptions([
    ...categoryOptions,
    ...vehicles.map((vehicle) => vehicle.category),
  ]);

  const filteredVehicles = vehicles.filter((vehicle) => {
    const quickMatches = quickSearch
      ? getVehicleSearchText(vehicle).includes(
          normalizeSearchValue(quickSearch),
        )
      : true;

    const specialMatches =
      specialFilter === ""
        ? true
        : specialFilter === "yes"
          ? vehicle.isSpecialVehicle
          : !vehicle.isSpecialVehicle;

    const activeMatches =
      activeFilter === ""
        ? true
        : activeFilter === "yes"
          ? vehicle.isActive
          : !vehicle.isActive;

    return (
      quickMatches &&
      includesSearchValue(vehicle.vehicleNumber, vehicleNumberFilter) &&
      includesSearchValue(vehicle.licensePlate, licensePlateFilter) &&
      includesSearchValue(vehicle.vehicleType, vehicleTypeFilter) &&
      includesSearchValue(vehicle.category, categoryFilter) &&
      includesSearchValue(vehicle.notes, notesFilter) &&
      specialMatches &&
      activeMatches
    );
  });

  const hasActiveFilters = Boolean(
    quickSearch ||
      vehicleNumberFilter ||
      licensePlateFilter ||
      vehicleTypeFilter ||
      categoryFilter ||
      specialFilter ||
      activeFilter ||
      notesFilter,
  );

  return (
    <AppShell
      title="Fahrzeuge"
      description="Fahrzeug-Stammdaten für LKW-Einteilung, Kurzstrecke, Langstrecke und Sonderfahrzeuge."
    >
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Fahrzeug anlegen
        </h2>

        <form
          action={createVehicle}
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-8"
        >
          <Input name="vehicleNumber" label="Fahrzeugnummer" required />
          <Input name="notes" label="Bemerkung" />
          <Input name="licensePlate" label="Kennzeichen" />

          <Select
            name="vehicleType"
            label="Fahrzeugtyp"
            options={vehicleTypeOptions}
          />

          <Select name="category" label="Kategorie" options={categoryOptions} />

          <Input
            name="asphaltPayloadTons"
            label="Nutzlast t"
            type="number"
            step="0.01"
            min="0"
            placeholder="z.B. 18"
          />

          <Input
            name="tackCoatTankLiters"
            label="Arbeitsmitteltank l"
            type="number"
            step="0.01"
            min="0"
            placeholder="z.B. 600"
          />

          <label className="flex items-end gap-2 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              name="isSpecialVehicle"
              className="mb-3 h-4 w-4"
            />
            <span className="mb-2">Sonderfahrzeug</span>
          </label>

          <div className="lg:col-span-8">
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Fahrzeug speichern
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Fahrzeugübersicht
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Änderungen direkt in der Zeile vornehmen und links mit dem Speichern-Symbol
                sichern. Die Aktionsspalte bleibt beim seitlichen Scrollen
                sichtbar.
              </p>
            </div>

            <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
              {filteredVehicles.length} von {vehicles.length} Fahrzeugen
            </div>
          </div>

          <form
            action="/admin/vehicles"
            className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FilterInput
                name="q"
                label="Schnellsuche"
                placeholder="Nr., Kennzeichen, Typ, Kategorie, Bemerkung..."
                defaultValue={quickSearch}
              />

              <FilterInput
                name="vehicleNumber"
                label="Fahrzeugnummer"
                list="vehicle-number-filter-options"
                placeholder="z.B. 101"
                defaultValue={vehicleNumberFilter}
              />

              <FilterInput
                name="notes"
                label="Bemerkung"
                placeholder="Bemerkung suchen"
                defaultValue={notesFilter}
              />

              <FilterInput
                name="licensePlate"
                label="Kennzeichen"
                list="license-plate-filter-options"
                placeholder="z.B. AB-ST"
                defaultValue={licensePlateFilter}
              />

              <FilterInput
                name="vehicleType"
                label="Typ"
                list="vehicle-type-filter-options"
                placeholder="z.B. Bagger"
                defaultValue={vehicleTypeFilter}
              />

              <FilterInput
                name="category"
                label="Kategorie"
                list="vehicle-category-filter-options"
                placeholder="z.B. 4-Achser"
                defaultValue={categoryFilter}
              />

              <FilterSelect
                name="special"
                label="Sonderfahrzeug"
                defaultValue={specialFilter}
                options={[
                  { value: "yes", label: "nur Sonderfahrzeuge" },
                  { value: "no", label: "ohne Sonderfahrzeuge" },
                ]}
              />

              <FilterSelect
                name="active"
                label="Aktiv"
                defaultValue={activeFilter}
                options={[
                  { value: "yes", label: "nur aktive" },
                  { value: "no", label: "nur inaktive" },
                ]}
              />
            </div>

            <datalist id="vehicle-number-filter-options">
              {vehicleNumberOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <datalist id="license-plate-filter-options">
              {licensePlateOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <datalist id="vehicle-type-filter-options">
              {vehicleTypeFilterOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <datalist id="vehicle-category-filter-options">
              {categoryFilterOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Suchen
              </button>

              {hasActiveFilters ? (
                <Link
                  href="/admin/vehicles"
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Filter zurücksetzen
                </Link>
              ) : null}
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1290px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <th className="sticky left-0 z-20 w-[92px] whitespace-nowrap border-r border-gray-200 bg-gray-50 p-3 text-center font-semibold shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                  Aktion
                </th>
                <Th>Fahrzeugnr.</Th>
                <Th>Bemerkung</Th>
                <Th>Kennzeichen</Th>
                <Th>Fahrzeugtyp</Th>
                <Th>Kategorie</Th>
                <th className="w-[105px] whitespace-nowrap p-3 font-semibold">
                  Nutzlast
                </th>
                <th className="w-[145px] whitespace-nowrap p-3 font-semibold">
                  Arbeitsmitteltank
                </th>
                <Th>Sonderfahrzeug</Th>
                <Th>Aktiv</Th>
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    Noch keine Fahrzeuge vorhanden.
                  </td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    Keine Fahrzeuge passend zu den aktuellen Filtern gefunden.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((vehicle) => {
                  const formId = `vehicle-form-${vehicle.id}`;

                  return (
                    <tr key={vehicle.id} className="border-t border-gray-100">
                      <td className="sticky left-0 z-10 w-[92px] border-r border-gray-200 bg-white p-3 align-top shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                        <div className="flex items-center justify-center gap-2">
                          <form id={formId} action={updateVehicle}>
                            <input type="hidden" name="id" value={vehicle.id} />

                            <button
                              type="submit"
                              title="Änderungen speichern"
                              aria-label="Änderungen speichern"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                            >
                              <ActionIcon name="save" className="h-4 w-4" />
                            </button>
                          </form>

                          <form action={deleteVehicle}>
                            <input type="hidden" name="id" value={vehicle.id} />

                            <button
                              type="submit"
                              title="Fahrzeug löschen"
                              aria-label="Fahrzeug löschen"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                            >
                              <ActionIcon name="delete" className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="vehicleNumber"
                          defaultValue={vehicle.vehicleNumber}
                        />
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="notes"
                          defaultValue={vehicle.notes ?? ""}
                        />
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="licensePlate"
                          defaultValue={vehicle.licensePlate ?? ""}
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="vehicleType"
                          defaultValue={vehicle.vehicleType}
                          options={vehicleTypeOptions}
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="category"
                          defaultValue={vehicle.category}
                          options={categoryOptions}
                        />
                      </Td>

                      <td className="w-[145px] p-3 align-top">
                        <div className="space-y-1">
                          <SmallPayloadInput
                            formId={formId}
                            name="asphaltPayloadTons"
                            defaultValue={String(
                              vehicle.asphaltPayloadTons ?? 0,
                            )}
                          />
                          <div className="whitespace-nowrap text-[11px] font-medium text-gray-500">
                            {formatTons(vehicle.asphaltPayloadTons ?? 0)} t
                          </div>
                        </div>
                      </td>

                      <td className="w-[105px] p-3 align-top">
                        <div className="space-y-1">
                          <SmallPayloadInput
                            formId={formId}
                            name="tackCoatTankLiters"
                            defaultValue={String(
                              vehicle.tackCoatTankLiters ?? 0,
                            )}
                          />
                          <div className="whitespace-nowrap text-[11px] font-medium text-gray-500">
                            {formatLiters(vehicle.tackCoatTankLiters ?? 0)} l
                          </div>
                        </div>
                      </td>

                      <Td>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            form={formId}
                            type="checkbox"
                            name="isSpecialVehicle"
                            defaultChecked={vehicle.isSpecialVehicle}
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
                            defaultChecked={vehicle.isActive}
                            className="h-4 w-4"
                          />
                          aktiv
                        </label>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function FilterInput({
  name,
  label,
  defaultValue,
  placeholder,
  list,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  list?: string;
}) {
  return (
    <label className="text-xs font-semibold text-gray-700">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        list={list}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
      />
    </label>
  );
}

function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-xs font-semibold text-gray-700">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
      >
        <option value="">Alle</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Input({
  name,
  label,
  required = false,
  type = "text",
  step,
  min,
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  step?: string;
  min?: string;
  placeholder?: string;
}) {
  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      <input
        name={name}
        required={required}
        type={type}
        step={step}
        min={min}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: string[];
}) {
  const hasOptions = options.length > 0;

  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      <select
        name={name}
        required
        defaultValue=""
        disabled={!hasOptions}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
      >
        <option value="" disabled>
          {hasOptions ? "Bitte wählen" : "Keine aktiven Werte in Auswahllisten"}
        </option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SmallInput({
  formId,
  name,
  defaultValue,
  type = "text",
  step,
  min,
}: {
  formId: string;
  name: string;
  defaultValue: string;
  type?: string;
  step?: string;
  min?: string;
}) {
  return (
    <input
      form={formId}
      name={name}
      type={type}
      step={step}
      min={min}
      defaultValue={defaultValue}
      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
    />
  );
}

function SmallPayloadInput({
  formId,
  name,
  defaultValue,
}: {
  formId: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <input
      form={formId}
      name={name}
      type="number"
      step="0.01"
      min="0"
      defaultValue={defaultValue}
      className="w-[82px] rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
    />
  );
}

function SmallSelect({
  formId,
  name,
  defaultValue,
  options,
}: {
  formId: string;
  name: string;
  defaultValue: string;
  options: string[];
}) {
  const mergedOptions = options.includes(defaultValue)
    ? options
    : [defaultValue, ...options].filter(Boolean);

  return (
    <select
      form={formId}
      name={name}
      defaultValue={defaultValue}
      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
    >
      {mergedOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap p-4 font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="p-4 align-top">{children}</td>;
}
