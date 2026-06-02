import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  addCrewDefaultVehicle,
  addCrewMember,
  createCrew,
  deleteCrew,
  removeCrewDefaultVehicle,
  removeCrewMember,
  updateCrew,
} from "./actions";

function getEmployeeName(employee: { firstName: string; lastName: string }) {
  return `${employee.lastName}, ${employee.firstName}`;
}

function getVehicleLabel(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
}) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.category,
    vehicle.vehicleType,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getEmployeePositionLabel(employee: {
  positions: { positionLabel: string }[];
}) {
  const label = employee.positions
    .map((position) => position.positionLabel)
    .join(", ");

  return label || "ohne Berufsgruppe";
}

function getOtherCrewNamesForEmployee({
  employeeId,
  currentCrewId,
  crews,
}: {
  employeeId: string;
  currentCrewId: string;
  crews: {
    id: string;
    name: string;
    isActive: boolean;
    members: {
      employeeId: string;
      isActive: boolean;
    }[];
  }[];
}) {
  return crews
    .filter((crew) => crew.id !== currentCrewId && crew.isActive)
    .filter((crew) =>
      crew.members.some(
        (member) => member.employeeId === employeeId && member.isActive
      )
    )
    .map((crew) => crew.name);
}

export default async function CrewsAdminPage() {
  const [crews, employees, vehicles, crewTypeOptions, positionOptions] =
    await Promise.all([
      prisma.crew.findMany({
        include: {
          members: {
            include: {
              employee: {
                include: {
                  positions: {
                    orderBy: {
                      sortOrder: "asc",
                    },
                  },
                },
              },
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
          defaultVehicles: {
            include: {
              vehicle: true,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),

      prisma.employee.findMany({
        where: {
          statusValue: "active",
        },
        include: {
          positions: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),

      prisma.vehicle.findMany({
        where: {
          isActive: true,
        },
        orderBy: [
          { isSpecialVehicle: "desc" },
          { category: "asc" },
          { vehicleNumber: "asc" },
        ],
      }),

      prisma.adminOption.findMany({
        where: {
          groupKey: "crew_type",
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

  const activeCrews = crews.filter((crew) => crew.isActive);
  const inactiveCrews = crews.filter((crew) => !crew.isActive);
  const asphaltDispatchCrews = crews.filter(
    (crew) => crew.isActive && crew.isAsphaltDispatchCrew
  );

  return (
    <AppShell
      title="Kolonnen"
      description="Kolonnen aus vorhandenen Mitarbeitern erstellen. Kolonnentyp, Berufsbezeichnungen, Standardgeräte und Asphaltdisposition können gepflegt werden."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/crew-dispatch"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Kolonneneinteilung öffnen →
        </Link>

        <Link
          href="/asphalt-dispatch"
          className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-900 hover:bg-orange-100"
        >
          Asphaltdisposition öffnen →
        </Link>

        <Link
          href="/admin/employees"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Mitarbeiter öffnen
        </Link>

        <Link
          href="/admin/vehicles"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Geräte/Fahrzeuge öffnen
        </Link>

        <Link
          href="/admin/options"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Auswahllisten öffnen
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <SummaryCard label="Kolonnen" value={String(crews.length)} />
        <SummaryCard label="Aktiv" value={String(activeCrews.length)} />
        <SummaryCard label="Inaktiv" value={String(inactiveCrews.length)} />
        <SummaryCard
          label="Asphaltdispo"
          value={String(asphaltDispatchCrews.length)}
        />
        <SummaryCard
          label="Mitarbeiter aktiv"
          value={String(employees.length)}
        />
      </div>

      <details className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-xl font-semibold text-gray-900">
          Neue Kolonne anlegen
        </summary>

        <CrewForm
          action={createCrew}
          crewTypeOptions={crewTypeOptions}
          defaultIsActive
        />
      </details>

      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-950">
        Mitarbeiter, die bereits in einer anderen aktiven Kolonne vergeben sind,
        werden beim Hinzufügen mit ! markiert, ausgegraut und können nicht
        doppelt ausgewählt werden.
      </div>

      <div className="space-y-5">
        {crews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm font-medium text-gray-500">
            Noch keine Kolonnen angelegt.
          </div>
        ) : (
          crews.map((crew) => (
            <section
              key={crew.id}
              className={
                crew.isActive
                  ? "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                  : "rounded-2xl border border-gray-200 bg-gray-50 p-6 opacity-70 shadow-sm"
              }
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {crew.name}
                    </h2>

                    <span
                      className={
                        crew.isActive
                          ? "rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
                          : "rounded-full bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700"
                      }
                    >
                      {crew.isActive ? "aktiv" : "inaktiv"}
                    </span>

                    {crew.typeLabel ? (
                      <span className="rounded-full bg-gray-900 px-2 py-1 text-xs font-semibold text-white">
                        {crew.typeLabel}
                      </span>
                    ) : null}

                    {crew.isAsphaltDispatchCrew ? (
                      <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900">
                        Asphaltdisposition
                      </span>
                    ) : null}
                  </div>

                  {crew.notes ? (
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {crew.notes}
                    </p>
                  ) : null}
                </div>

                <details>
                  <summary className="cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                    Kolonne bearbeiten
                  </summary>

                  <div className="mt-4 w-[760px] max-w-[calc(100vw-4rem)] rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
                    <CrewForm
                      action={updateCrew}
                      id={crew.id}
                      crewTypeOptions={crewTypeOptions}
                      defaultName={crew.name}
                      defaultTypeValue={crew.typeValue ?? ""}
                      defaultColorClass={crew.colorClass ?? ""}
                      defaultNotes={crew.notes ?? ""}
                      defaultSortOrder={String(crew.sortOrder)}
                      defaultIsActive={crew.isActive}
                      defaultIsAsphaltDispatchCrew={
                        crew.isAsphaltDispatchCrew
                      }
                    />

                    <form action={deleteCrew} className="mt-4">
                      <input type="hidden" name="id" value={crew.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Kolonne löschen
                      </button>
                    </form>
                  </div>
                </details>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Mitarbeiter in der Kolonne
                  </h3>

                  <div className="mt-4 space-y-2">
                    {crew.members.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Noch keine Mitarbeiter zugeordnet.
                      </p>
                    ) : (
                      crew.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3"
                        >
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {getEmployeeName(member.employee)}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-1">
                              {member.employee.positions.map((position) => (
                                <span
                                  key={position.id}
                                  className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700"
                                >
                                  {position.positionLabel}
                                </span>
                              ))}
                            </div>

                            {member.roleText ? (
                              <div className="mt-1 text-xs font-semibold text-gray-600">
                                Berufsbezeichnung: {member.roleText}
                              </div>
                            ) : null}
                          </div>

                          <form action={removeCrewMember}>
                            <input type="hidden" name="id" value={member.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Entfernen
                            </button>
                          </form>
                        </div>
                      ))
                    )}
                  </div>

                  <details className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                      Mitarbeiter hinzufügen
                    </summary>

                    <form action={addCrewMember} className="mt-3 space-y-3">
                      <input type="hidden" name="crewId" value={crew.id} />

                      <label className="block text-xs font-medium text-gray-700">
                        Mitarbeiter
                        <select
                          name="employeeId"
                          required
                          defaultValue=""
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
                        >
                          <option value="" disabled>
                            Mitarbeiter wählen
                          </option>

                          {employees.map((employee) => {
                            const otherCrewNames =
                              getOtherCrewNamesForEmployee({
                                employeeId: employee.id,
                                currentCrewId: crew.id,
                                crews,
                              });

                            const isAssignedToOtherCrew =
                              otherCrewNames.length > 0;

                            const employeeLabel = `${getEmployeeName(
                              employee
                            )} · ${getEmployeePositionLabel(employee)}`;

                            const assignedLabel = isAssignedToOtherCrew
                              ? `! ${employeeLabel} · bereits in: ${otherCrewNames.join(
                                  ", "
                                )}`
                              : employeeLabel;

                            return (
                              <option
                                key={employee.id}
                                value={employee.id}
                                disabled={isAssignedToOtherCrew}
                              >
                                {assignedLabel}
                              </option>
                            );
                          })}
                        </select>
                      </label>

                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                        ! = Mitarbeiter ist bereits in einer anderen aktiven
                        Kolonne vergeben und kann hier nicht doppelt ausgewählt
                        werden.
                      </div>

                      <label className="block text-xs font-medium text-gray-700">
                        Berufsgruppe / Berufsbezeichnung
                        <select
                          name="rolePositionValue"
                          defaultValue=""
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
                        >
                          <option value="">
                            Keine Berufsbezeichnung gewählt
                          </option>

                          {positionOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-xs font-medium text-gray-700">
                        Textergänzung optional
                        <input
                          name="roleTextExtra"
                          placeholder="z.B. Polier, Vorarbeiter, Springer, nur Montag"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                        />
                      </label>

                      <label className="block text-xs font-medium text-gray-700">
                        Sortierung
                        <input
                          name="sortOrder"
                          type="number"
                          defaultValue="0"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                        />
                      </label>

                      <button
                        type="submit"
                        className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                      >
                        Mitarbeiter hinzufügen
                      </button>
                    </form>
                  </details>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Standardgeräte / Fahrzeuge
                  </h3>

                  <div className="mt-4 space-y-2">
                    {crew.defaultVehicles.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        Noch keine Standardgeräte hinterlegt.
                      </p>
                    ) : (
                      crew.defaultVehicles.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3"
                        >
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {getVehicleLabel(item.vehicle)}
                            </div>

                            {item.notes ? (
                              <div className="mt-1 text-xs text-gray-500">
                                {item.notes}
                              </div>
                            ) : null}
                          </div>

                          <form action={removeCrewDefaultVehicle}>
                            <input type="hidden" name="id" value={item.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              Entfernen
                            </button>
                          </form>
                        </div>
                      ))
                    )}
                  </div>

                  <details className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                      Gerät/Fahrzeug hinzufügen
                    </summary>

                    <form
                      action={addCrewDefaultVehicle}
                      className="mt-3 space-y-3"
                    >
                      <input type="hidden" name="crewId" value={crew.id} />

                      <label className="block text-xs font-medium text-gray-700">
                        Gerät / Fahrzeug
                        <select
                          name="vehicleId"
                          required
                          defaultValue=""
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
                        >
                          <option value="" disabled>
                            Gerät/Fahrzeug wählen
                          </option>

                          {vehicles.map((vehicle) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.isSpecialVehicle ? "⭐ " : ""}
                              {getVehicleLabel(vehicle)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block text-xs font-medium text-gray-700">
                        Bemerkung
                        <input
                          name="notes"
                          placeholder="z.B. Standardgerät der Kolonne"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                        />
                      </label>

                      <label className="block text-xs font-medium text-gray-700">
                        Sortierung
                        <input
                          name="sortOrder"
                          type="number"
                          defaultValue="0"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                        />
                      </label>

                      <button
                        type="submit"
                        className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                      >
                        Gerät hinzufügen
                      </button>
                    </form>
                  </details>
                </div>
              </div>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}

function CrewForm({
  action,
  id,
  crewTypeOptions,
  defaultName = "",
  defaultTypeValue = "",
  defaultColorClass = "",
  defaultNotes = "",
  defaultSortOrder = "0",
  defaultIsActive = true,
  defaultIsAsphaltDispatchCrew = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id?: string;
  crewTypeOptions: { value: string; label: string }[];
  defaultName?: string;
  defaultTypeValue?: string;
  defaultColorClass?: string;
  defaultNotes?: string;
  defaultSortOrder?: string;
  defaultIsActive?: boolean;
  defaultIsAsphaltDispatchCrew?: boolean;
}) {
  return (
    <form action={action} className="mt-5 space-y-4">
      {id ? <input type="hidden" name="id" value={id} /> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-gray-800">
          Kolonnenname
          <input
            name="name"
            required
            defaultValue={defaultName}
            placeholder="z.B. Kolonne Tiefbau 1"
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Kolonnentyp
          <select
            name="typeValue"
            defaultValue={defaultTypeValue}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            <option value="">Kolonnentyp wählen</option>

            {crewTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Farbe optional
          <input
            name="colorClass"
            defaultValue={defaultColorClass}
            placeholder="z.B. bg-orange-100 text-orange-900"
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="text-sm font-medium text-gray-800">
          Sortierung
          <input
            name="sortOrder"
            type="number"
            defaultValue={defaultSortOrder}
            className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-gray-800">
        Bemerkung
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaultNotes}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-semibold text-gray-800">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={defaultIsActive}
            className="h-4 w-4"
          />
          Kolonne aktiv
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm font-semibold text-orange-950">
          <input
            type="checkbox"
            name="isAsphaltDispatchCrew"
            defaultChecked={defaultIsAsphaltDispatchCrew}
            className="h-4 w-4"
          />
          In Asphaltdisposition verwenden
        </label>
      </div>

      <button
        type="submit"
        className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
      >
        Speichern
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