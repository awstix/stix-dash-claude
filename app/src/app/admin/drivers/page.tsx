import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { createDriver, deleteDriver, updateDriver } from "./actions";

export default async function DriversPage() {
  const drivers = await prisma.driver.findMany({
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <AppShell
      title="Fahrer"
      description="Fahrer-Stammdaten für Kurzstrecke, LKW-Einteilung und spätere Personaleinteilung."
    >
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Fahrer anlegen</h2>

        <form
          action={createDriver}
          className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5"
        >
          <Input name="firstName" label="Vorname" required />
          <Input name="lastName" label="Nachname" required />
          <Input name="shortcut" label="Kürzel" />
          <Input name="phone" label="Telefon" />
          <Input name="notes" label="Bemerkung" />

          <div className="lg:col-span-5">
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Fahrer speichern
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-800">
              <tr>
                <Th>Vorname</Th>
                <Th>Nachname</Th>
                <Th>Kürzel</Th>
                <Th>Telefon</Th>
                <Th>Aktiv</Th>
                <Th>Bemerkung</Th>
                <Th>Aktionen</Th>
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Noch keine Fahrer vorhanden.
                  </td>
                </tr>
              ) : (
                drivers.map((driver) => {
                  const formId = `driver-form-${driver.id}`;

                  return (
                    <tr key={driver.id} className="border-t border-gray-100">
                      <Td>
                        <SmallInput
                          formId={formId}
                          name="firstName"
                          defaultValue={driver.firstName}
                        />
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="lastName"
                          defaultValue={driver.lastName}
                        />
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="shortcut"
                          defaultValue={driver.shortcut ?? ""}
                        />
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="phone"
                          defaultValue={driver.phone ?? ""}
                        />
                      </Td>

                      <Td>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            form={formId}
                            type="checkbox"
                            name="isActive"
                            defaultChecked={driver.isActive}
                            className="h-4 w-4"
                          />
                          aktiv
                        </label>
                      </Td>

                      <Td>
                        <SmallInput
                          formId={formId}
                          name="notes"
                          defaultValue={driver.notes ?? ""}
                        />
                      </Td>

                      <Td>
                        <div className="flex gap-2">
                          <form id={formId} action={updateDriver}>
                            <input type="hidden" name="id" value={driver.id} />

                            <button
                              type="submit"
                              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                            >
                              Speichern
                            </button>
                          </form>

                          <form action={deleteDriver}>
                            <input type="hidden" name="id" value={driver.id} />

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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap p-4 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="p-4 align-top">{children}</td>;
}