import type { ReactNode } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createTackCoatType,
  deleteTackCoatType,
  updateTackCoatType,
} from "./actions";

const TACK_COAT_CATEGORY = "Anspritzmittel";
const unitFallback = ["l", "Liter", "kg", "t", "m²", "m2"];

export default async function TackCoatTypesPage() {
  const [tackCoatTypes, unitOptionsFromAdmin] = await Promise.all([
    prisma.materialType.findMany({
      where: {
        category: TACK_COAT_CATEGORY,
      },
      orderBy: [{ isActive: "desc" }, { materialNumber: "asc" }, { name: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        isActive: true,
        groupKey: {
          in: ["material_unit", "asphalt_unit", "quantity_unit"],
        },
      },
      orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  const unitOptions = Array.from(
    new Set([...unitOptionsFromAdmin.map((option) => option.label), ...unitFallback]),
  );

  return (
    <AppShell
      title="Anspritzmittel"
      description="Eigene Liste für Haftkleber und Anspritzmittel. Diese Liste wird in Asphaltdisposition und Sonderfahrzeug-Disposition verwendet."
    >
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Anspritzmittel anlegen
        </h2>

        <form
          action={createTackCoatType}
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5"
        >
          <Input name="materialNumber" label="Nummer optional" placeholder="z.B. C60B" />
          <Input name="name" label="Bezeichnung" required placeholder="z.B. C60B4-S" />
          <Select name="unit" label="Einheit" options={unitOptions} required emptyLabel="Bitte wählen" />
          <Input name="notes" label="Bemerkung" />

          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Anspritzmittel speichern
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Anspritzmittel-Übersicht
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Hier stehen nur Anspritzmittel. Normale Baustoffe bleiben in der Materialliste.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <th className="sticky left-0 z-20 w-[92px] whitespace-nowrap border-r border-gray-200 bg-gray-50 p-3 text-center font-semibold shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                  Aktion
                </th>
                <Th>Nummer</Th>
                <Th>Bezeichnung</Th>
                <Th>Einheit</Th>
                <Th>Aktiv</Th>
                <Th>Bemerkung</Th>
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {tackCoatTypes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Noch keine Anspritzmittel vorhanden.
                  </td>
                </tr>
              ) : (
                tackCoatTypes.map((tackCoatType) => {
                  const formId = `tack-coat-type-form-${tackCoatType.id}`;

                  return (
                    <tr key={tackCoatType.id} className="border-t border-gray-100">
                      <td className="sticky left-0 z-10 w-[92px] border-r border-gray-200 bg-white p-3 align-top shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                        <div className="flex items-center justify-center gap-2">
                          <form id={formId} action={updateTackCoatType}>
                            <input type="hidden" name="id" value={tackCoatType.id} />
                            <button
                              type="submit"
                              title="Anspritzmittel speichern"
                              aria-label="Anspritzmittel speichern"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                            >
                              <ActionIcon name="save" className="h-4 w-4" />
                            </button>
                          </form>

                          <form action={deleteTackCoatType}>
                            <input type="hidden" name="id" value={tackCoatType.id} />
                            <button
                              type="submit"
                              title="Anspritzmittel löschen"
                              aria-label="Anspritzmittel löschen"
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
                          name="materialNumber"
                          defaultValue={tackCoatType.materialNumber ?? ""}
                        />
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="name"
                          defaultValue={tackCoatType.name}
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="unit"
                          defaultValue={tackCoatType.unit}
                          options={unitOptions}
                        />
                      </Td>

                      <Td>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            form={formId}
                            type="checkbox"
                            name="isActive"
                            defaultChecked={tackCoatType.isActive}
                            className="h-4 w-4"
                          />
                          aktiv
                        </label>
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="notes"
                          defaultValue={tackCoatType.notes ?? ""}
                        />
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
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      <input
        name={name}
        required={required}
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
  required = false,
  emptyLabel,
}: {
  name: string;
  label: string;
  options: string[];
  required?: boolean;
  emptyLabel?: string;
}) {
  const hasOptions = options.length > 0;

  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      <select
        name={name}
        required={required}
        defaultValue={hasOptions ? options[0] : "kg"}
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      >
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {hasOptions ? (
          options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))
        ) : (
          <option value="kg">kg</option>
        )}
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
      className="w-full min-w-[120px] rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
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
  return (
    <select
      form={formId}
      name={name}
      defaultValue={defaultValue}
      className="w-full min-w-[90px] rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
    >
      {options.length === 0 ? (
        <option value={defaultValue}>{defaultValue || "kg"}</option>
      ) : (
        options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))
      )}
    </select>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap p-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="p-3 align-top">{children}</td>;
}
