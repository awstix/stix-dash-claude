import type { ReactNode } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createConcreteType,
  deleteConcreteType,
  updateConcreteType,
} from "./actions";

export default async function ConcreteTypesPage() {
  const [concreteTypes, options] = await Promise.all([
    prisma.concreteType.findMany({
      orderBy: [{ isActive: "desc" }, { typeNumber: "asc" }],
    }),

    prisma.adminOption.findMany({
      where: {
        isActive: true,
        groupKey: {
          in: [
            "concrete_unit",
            "concrete_strength_class",
            "concrete_exposure_class",
            "concrete_consistency",
            "concrete_aggregate",
          ],
        },
      },
      orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
  ]);

  const unitOptions = options
    .filter((option) => option.groupKey === "concrete_unit")
    .map((option) => option.label);

  const strengthClassOptions = options
    .filter((option) => option.groupKey === "concrete_strength_class")
    .map((option) => option.label);

  const exposureClassOptions = options
    .filter((option) => option.groupKey === "concrete_exposure_class")
    .map((option) => option.label);

  const consistencyOptions = options
    .filter((option) => option.groupKey === "concrete_consistency")
    .map((option) => option.label);

  const aggregateOptions = options
    .filter((option) => option.groupKey === "concrete_aggregate")
    .map((option) => option.label);

  return (
    <AppShell
      title="Sortenliste Beton"
      description="Betonsorten, Festigkeitsklassen, Expositionsklassen, Konsistenzen und Einheiten verwalten."
    >
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Betonsorte anlegen
        </h2>

        <form
          action={createConcreteType}
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-8"
        >
          <Input name="typeNumber" label="Sortennummer" required />
          <Input name="name" label="Bezeichnung" required />

          <Select
            name="strengthClass"
            label="Festigkeitsklasse"
            options={strengthClassOptions}
            required={false}
            emptyLabel="Keine Festigkeitsklasse"
          />

          <Select
            name="exposureClass"
            label="Expositionsklasse"
            options={exposureClassOptions}
            required={false}
            emptyLabel="Keine Expositionsklasse"
          />

          <Select
            name="aggregate"
            label="Körnung"
            options={aggregateOptions}
            required={false}
            emptyLabel="Keine Körnung"
          />

          <Select
            name="consistency"
            label="Konsistenz"
            options={consistencyOptions}
            required={false}
            emptyLabel="Keine Konsistenz"
          />

          <Select
            name="unit"
            label="Einheit"
            options={unitOptions}
            required
            emptyLabel="Bitte wählen"
          />

          <Input name="notes" label="Bemerkung" />

          <div className="lg:col-span-8">
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Betonsorte speichern
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <th className="sticky left-0 z-20 w-[92px] whitespace-nowrap border-r border-gray-200 bg-gray-50 p-4 text-center font-semibold shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                  Aktion
                </th>
                <Th>Sortennr.</Th>
                <Th>Bezeichnung</Th>
                <Th>Festigkeit</Th>
                <Th>Exposition</Th>
                <Th>Körnung</Th>
                <Th>Konsistenz</Th>
                <Th>Einheit</Th>
                <Th>Aktiv</Th>
                <Th>Bemerkung</Th>
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {concreteTypes.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    Noch keine Betonsorten vorhanden.
                  </td>
                </tr>
              ) : (
                concreteTypes.map((concreteType) => {
                  const formId = `concrete-type-form-${concreteType.id}`;

                  return (
                    <tr
                      key={concreteType.id}
                      className="border-t border-gray-100"
                    >
                      <td className="sticky left-0 z-10 w-[92px] border-r border-gray-200 bg-white p-4 align-top shadow-[8px_0_12px_-12px_rgba(0,0,0,0.35)]">
                        <div className="flex items-center justify-center gap-2">
                          <form id={formId} action={updateConcreteType}>
                            <input
                              type="hidden"
                              name="id"
                              value={concreteType.id}
                            />

                            <button
                              type="submit"
                              title="Betonsorte speichern"
                              aria-label="Betonsorte speichern"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                            >
                              <ActionIcon name="save" className="h-4 w-4" />
                            </button>
                          </form>

                          <form action={deleteConcreteType}>
                            <input
                              type="hidden"
                              name="id"
                              value={concreteType.id}
                            />

                            <button
                              type="submit"
                              title="Betonsorte löschen"
                              aria-label="Betonsorte löschen"
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
                          name="typeNumber"
                          defaultValue={concreteType.typeNumber}
                        />
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="name"
                          defaultValue={concreteType.name}
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="strengthClass"
                          defaultValue={concreteType.strengthClass ?? ""}
                          options={strengthClassOptions}
                          allowEmpty
                          emptyLabel="Keine Festigkeitsklasse"
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="exposureClass"
                          defaultValue={concreteType.exposureClass ?? ""}
                          options={exposureClassOptions}
                          allowEmpty
                          emptyLabel="Keine Expositionsklasse"
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="aggregate"
                          defaultValue={concreteType.aggregate ?? ""}
                          options={aggregateOptions}
                          allowEmpty
                          emptyLabel="Keine Körnung"
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="consistency"
                          defaultValue={concreteType.consistency ?? ""}
                          options={consistencyOptions}
                          allowEmpty
                          emptyLabel="Keine Konsistenz"
                        />
                      </Td>

                      <Td>
                        <SmallSelect
                          formId={formId}
                          name="unit"
                          defaultValue={concreteType.unit}
                          options={unitOptions}
                        />
                      </Td>

                      <Td>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            form={formId}
                            type="checkbox"
                            name="isActive"
                            defaultChecked={concreteType.isActive}
                            className="h-4 w-4"
                          />
                          aktiv
                        </label>
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="notes"
                          defaultValue={concreteType.notes ?? ""}
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
