import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createAsphaltType,
  deleteAsphaltType,
  updateAsphaltType,
} from "./actions";

export default async function AsphaltTypesPage() {
  const [asphaltTypes, options] = await Promise.all([
    prisma.asphaltMixType.findMany({
      orderBy: [{ isActive: "desc" }, { mixNumber: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        isActive: true,
        groupKey: {
          in: ["asphalt_unit", "asphalt_category", "asphalt_plant"],
        },
      },
      orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  const unitOptions = options
    .filter((option) => option.groupKey === "asphalt_unit")
    .map((option) => option.label);

  const categoryOptions = options
    .filter((option) => option.groupKey === "asphalt_category")
    .map((option) => option.label);

  const plantOptions = options
    .filter((option) => option.groupKey === "asphalt_plant")
    .map((option) => option.label);

  return (
    <AppShell
      title="Sortenliste Asphalt"
      description="Asphaltsorten, Sortennummern, Einheiten, Kategorien und Mischanlagen verwalten."
    >
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Asphaltsorte anlegen
        </h2>

        <form
          action={createAsphaltType}
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7"
        >
          <Input name="mixNumber" label="Sortennummer" required />
          <Input name="name" label="Bezeichnung" required />
          <Input name="shortName" label="Kurzbezeichnung" />

          <Select
            name="unit"
            label="Einheit"
            options={unitOptions}
            required
            emptyLabel="Bitte wählen"
          />

          <Select
            name="category"
            label="Kategorie"
            options={categoryOptions}
            required={false}
            emptyLabel="Keine Kategorie"
          />

          <Select
            name="plant"
            label="Mischanlage / Standort"
            options={plantOptions}
            required={false}
            emptyLabel="Kein Standort"
          />

          <Input name="notes" label="Bemerkung" />

          <div className="lg:col-span-7">
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Asphaltsorte speichern
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1350px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th>Sortennr.</Th>
                <Th>Bezeichnung</Th>
                <Th>Kurzbez.</Th>
                <Th>Einheit</Th>
                <Th>Kategorie</Th>
                <Th>Mischanlage</Th>
                <Th>Aktiv</Th>
                <Th>Bemerkung</Th>
                <Th>Aktionen</Th>
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {asphaltTypes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    Noch keine Asphaltsorten vorhanden.
                  </td>
                </tr>
              ) : (
                asphaltTypes.map((asphaltType) => {
                  const formId = `asphalt-type-form-${asphaltType.id}`;

                  return (
                    <tr
                      key={asphaltType.id}
                      className="border-t border-gray-100"
                    >
                      <Td>
                        <SmallInput
                          formId={formId}
                          name="mixNumber"
                          defaultValue={asphaltType.mixNumber}
                        />
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="name"
                          defaultValue={asphaltType.name}
                        />
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="shortName"
                          defaultValue={asphaltType.shortName ?? ""}
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="unit"
                          defaultValue={asphaltType.unit}
                          options={unitOptions}
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="category"
                          defaultValue={asphaltType.category ?? ""}
                          options={categoryOptions}
                          allowEmpty
                          emptyLabel="Keine Kategorie"
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="plant"
                          defaultValue={asphaltType.plant ?? ""}
                          options={plantOptions}
                          allowEmpty
                          emptyLabel="Kein Standort"
                        />
                      </Td>

                      <Td>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            form={formId}
                            type="checkbox"
                            name="isActive"
                            defaultChecked={asphaltType.isActive}
                            className="h-4 w-4"
                          />
                          aktiv
                        </label>
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="notes"
                          defaultValue={asphaltType.notes ?? ""}
                        />
                      </Td>

                      <Td>
                        <div className="flex gap-2">
                          <form id={formId} action={updateAsphaltType}>
                            <input
                              type="hidden"
                              name="id"
                              value={asphaltType.id}
                            />

                            <button
                              type="submit"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                            >
                              Speichern
                            </button>
                          </form>

                          <form action={deleteAsphaltType}>
                            <input
                              type="hidden"
                              name="id"
                              value={asphaltType.id}
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
    </AppShell>
  );
}

function Input({
  name,
  label,
  required = false,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      <input
        name={name}
        required={required}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
  required = true,
  emptyLabel,
}: {
  name: string;
  label: string;
  options: string[];
  required?: boolean;
  emptyLabel: string;
}) {
  const hasOptions = options.length > 0;

  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      <select
        name={name}
        required={required}
        defaultValue=""
        disabled={required && !hasOptions}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
      >
        <option value="" disabled={required}>
          {hasOptions ? emptyLabel : "Keine aktiven Werte in Auswahllisten"}
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
}: {
  formId: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <input
      form={formId}
      name={name}
      defaultValue={defaultValue}
      className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
    />
  );
}

function SmallSelect({
  formId,
  name,
  defaultValue,
  options,
  allowEmpty = false,
  emptyLabel = "Bitte wählen",
}: {
  formId: string;
  name: string;
  defaultValue: string;
  options: string[];
  allowEmpty?: boolean;
  emptyLabel?: string;
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
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}

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
