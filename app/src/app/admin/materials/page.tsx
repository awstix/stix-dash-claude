import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { createMaterial, deleteMaterial, updateMaterial } from "./actions";

export default async function MaterialsPage() {
  const [materials, options] = await Promise.all([
    prisma.materialType.findMany({
      where: {
        OR: [
          { category: null },
          { category: { not: "Anspritzmittel" } },
        ],
      },
      orderBy: [{ isActive: "desc" }, { category: "asc" }, { name: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        isActive: true,
        groupKey: {
          in: ["material_category", "material_unit"],
        },
      },
      orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  const categoryOptions = options
    .filter((option) => option.groupKey === "material_category")
    .map((option) => option.label);

  const unitOptions = options
    .filter((option) => option.groupKey === "material_unit")
    .map((option) => option.label);

  return (
    <AppShell
      title="Materialliste"
      description="Material-Stammdaten für LKW-Einteilung, Transporte und spätere Bestellungen."
    >
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Material anlegen
        </h2>

        <form
          action={createMaterial}
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6"
        >
          <Input name="materialNumber" label="Materialnummer" />
          <Input name="name" label="Materialname" required />

          <Select
            name="category"
            label="Kategorie"
            options={categoryOptions}
            required={false}
            emptyLabel="Keine Kategorie"
          />

          <Select
            name="unit"
            label="Einheit"
            options={unitOptions}
            required
            emptyLabel="Bitte wählen"
          />

          <Input name="notes" label="Bemerkung" />

          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Material speichern
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th>Materialnr.</Th>
                <Th>Materialname</Th>
                <Th>Kategorie</Th>
                <Th>Einheit</Th>
                <Th>Aktiv</Th>
                <Th>Bemerkung</Th>
                <Th>Aktionen</Th>
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {materials.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Noch keine Materialien vorhanden.
                  </td>
                </tr>
              ) : (
                materials.map((material) => {
                  const formId = `material-form-${material.id}`;

                  return (
                    <tr key={material.id} className="border-t border-gray-100">
                      <Td>
                        <SmallInput
                          formId={formId}
                          name="materialNumber"
                          defaultValue={material.materialNumber ?? ""}
                        />
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="name"
                          defaultValue={material.name}
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="category"
                          defaultValue={material.category ?? ""}
                          options={categoryOptions}
                          allowEmpty
                          emptyLabel="Keine Kategorie"
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="unit"
                          defaultValue={material.unit}
                          options={unitOptions}
                        />
                      </Td>

                      <Td>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            form={formId}
                            type="checkbox"
                            name="isActive"
                            defaultChecked={material.isActive}
                            className="h-4 w-4"
                          />
                          aktiv
                        </label>
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="notes"
                          defaultValue={material.notes ?? ""}
                        />
                      </Td>

                      <Td>
                        <div className="flex gap-2">
                          <form id={formId} action={updateMaterial}>
                            <input type="hidden" name="id" value={material.id} />

                            <button
                              type="submit"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                            >
                              Speichern
                            </button>
                          </form>

                          <form action={deleteMaterial}>
                            <input type="hidden" name="id" value={material.id} />

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