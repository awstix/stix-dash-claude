import type { ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { createDriver, deleteDriver, updateDriver } from "./actions";

const LKW_DRIVER_POSITION_VALUE = "lkw_fahrer_in";

async function syncDriversFromEmployees() {
  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        {
          driverId: {
            not: null,
          },
        },
        {
          positions: {
            some: {
              positionValue: LKW_DRIVER_POSITION_VALUE,
            },
          },
        },
      ],
    },
    include: {
      driver: true,
      positions: true,
    },
  });

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const employee of employees) {
      const hasLkwDriverPosition = employee.positions.some(
        (position) => position.positionValue === LKW_DRIVER_POSITION_VALUE
      );
      const shouldBeActiveDriver =
        hasLkwDriverPosition && employee.statusValue === "active";

      if (!hasLkwDriverPosition) {
        if (employee.driver?.isActive) {
          await tx.driver.update({
            where: {
              id: employee.driver.id,
            },
            data: {
              isActive: false,
              notes:
                "Automatisch deaktiviert, weil Mitarbeiter nicht mehr als LKW Fahrer*in geführt wird.",
            },
          });
        }

        continue;
      }

      if (!employee.driver) {
        if (!shouldBeActiveDriver) {
          continue;
        }

        const driver = await tx.driver.create({
          data: {
            firstName: employee.firstName,
            lastName: employee.lastName,
            phone: employee.mobilePhone,
            isActive: true,
            notes: "Automatisch aus Mitarbeiterstamm erstellt.",
          },
        });

        await tx.employee.update({
          where: {
            id: employee.id,
          },
          data: {
            driverId: driver.id,
          },
        });

        continue;
      }

      const syncedNotes = shouldBeActiveDriver
        ? "Automatisch aus Mitarbeiterstamm synchronisiert."
        : "Automatisch deaktiviert, weil Mitarbeiter nicht aktiv ist.";

      if (
        employee.driver.firstName !== employee.firstName ||
        employee.driver.lastName !== employee.lastName ||
        employee.driver.phone !== employee.mobilePhone ||
        employee.driver.isActive !== shouldBeActiveDriver ||
        employee.driver.notes !== syncedNotes
      ) {
        await tx.driver.update({
          where: {
            id: employee.driver.id,
          },
          data: {
            firstName: employee.firstName,
            lastName: employee.lastName,
            phone: employee.mobilePhone,
            isActive: shouldBeActiveDriver,
            notes: syncedNotes,
          },
        });
      }
    }
  });
}

export default async function DriversPage() {
  await syncDriversFromEmployees();

  const drivers = await prisma.driver.findMany({
    where: {
      isActive: true,
    },
    include: {
      employee: {
        include: {
          positions: true,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <AppShell
      title="Fahrer"
      description="Fahrerdaten für Kurzstrecke, LKW-Einteilung und spätere Personaleinteilung."
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
                <Th>Aktionen</Th>
                <Th>Vorname</Th>
                <Th>Nachname</Th>
                <Th>Kürzel</Th>
                <Th>Telefon</Th>
                <Th>Quelle</Th>
                <Th>Bemerkung</Th>
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Keine aktiven Fahrer vorhanden.
                  </td>
                </tr>
              ) : (
                drivers.map((driver) => {
                  const formId = `driver-form-${driver.id}`;
                  const isSyncedFromEmployee = Boolean(driver.employee);

                  return (
                    <tr key={driver.id} className="border-t border-gray-100">
                      <Td>
                        <details className="relative">
                          <summary
                            className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition marker:content-none hover:bg-gray-50 [&::-webkit-details-marker]:hidden"
                            title="Fahrer bearbeiten"
                          >
                            <ActionIcon name="edit" className="h-4 w-4" />
                            <span className="sr-only">Bearbeiten</span>
                          </summary>

                          <div className="absolute left-0 top-10 z-50 w-[min(560px,calc(100vw-2rem))] max-h-[75vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                            <form
                              id={formId}
                              action={updateDriver}
                              className="grid grid-cols-1 gap-3 md:grid-cols-2"
                            >
                              <input type="hidden" name="id" value={driver.id} />
                              <SmallInput
                                name="firstName"
                                label="Vorname"
                                defaultValue={driver.firstName}
                              />
                              <SmallInput
                                name="lastName"
                                label="Nachname"
                                defaultValue={driver.lastName}
                              />
                              <SmallInput
                                name="shortcut"
                                label="Kürzel"
                                defaultValue={driver.shortcut ?? ""}
                              />
                              <SmallInput
                                name="phone"
                                label="Telefon"
                                defaultValue={driver.phone ?? ""}
                              />
                              <label className="text-xs font-semibold text-gray-700 md:col-span-2">
                                Bemerkung
                                <input
                                  name="notes"
                                  defaultValue={driver.notes ?? ""}
                                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
                                />
                              </label>
                            </form>

                            <div className="mt-3 flex gap-2">
                              <button
                                type="submit"
                                form={formId}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                                title="Fahrer speichern"
                              >
                                <ActionIcon name="save" className="h-4 w-4" />
                                <span className="sr-only">Speichern</span>
                              </button>

                              <form action={deleteDriver}>
                                <input
                                  type="hidden"
                                  name="id"
                                  value={driver.id}
                                />

                                <button
                                  type="submit"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                                  title="Fahrer löschen"
                                >
                                  <ActionIcon name="delete" className="h-4 w-4" />
                                  <span className="sr-only">Löschen</span>
                                </button>
                              </form>
                            </div>
                          </div>
                        </details>
                      </Td>

                      <Td>
                        <span className="font-semibold text-gray-900">
                          {driver.firstName}
                        </span>
                      </Td>

                      <Td>
                        <span className="font-semibold text-gray-900">
                          {driver.lastName}
                        </span>
                      </Td>

                      <Td>
                        {driver.shortcut ? (
                          <span>{driver.shortcut}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </Td>

                      <Td>
                        {driver.phone ? (
                          <span>{driver.phone}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </Td>

                      <Td>
                        {isSyncedFromEmployee ? (
                          <div className="space-y-1">
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
                              Mitarbeiterliste
                            </span>
                            <div className="text-xs text-gray-500">
                              {driver.employee?.statusLabel ?? "Aktiv"}
                            </div>
                          </div>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                            Manuell
                          </span>
                        )}
                      </Td>

                      <Td>
                        {driver.notes ? (
                          <span>{driver.notes}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="text-xs font-semibold text-gray-700">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-900"
      />
    </label>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap p-4 font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="p-4 align-top">{children}</td>;
}
