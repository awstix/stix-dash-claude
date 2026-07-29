import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { updatePersonalInventoryManagers } from "./actions";

export const dynamic = "force-dynamic";

export default async function PersonalInventoryManagersPage() {
  const employees = await prisma.employee.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      canManagePersonalInventory: true,
      departmentLabel: true,
      firstName: true,
      id: true,
      isLeadership: true,
      lastName: true,
      statusLabel: true,
      statusValue: true,
    },
  });
  const activeEmployees = employees.filter(
    (employee) => employee.statusValue === "active",
  );
  const selectedCount = activeEmployees.filter(
    (employee) => employee.canManagePersonalInventory,
  ).length;

  return (
    <AppShell
      title="Inventarverantwortliche (persönlich)"
      description="Festlegen, wer persönliches Inventar ausgeben und zurücknehmen darf."
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-900"
          href="/admin"
        >
          ← Zurück zum Admin-Menü
        </Link>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-950">
          {selectedCount} berechtigt
        </span>
      </div>

      <form action={updatePersonalInventoryManagers}>
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950">
            Berechtigte Personen auswählen
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            Nur ausgewählte Personen erscheinen bei „Ausgegeben durch“ und
            „Zurückgenommen durch“. Leitungspersonen sind nicht automatisch
            freigeschaltet und können hier bei Bedarf ausgewählt werden.
          </p>
          <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {activeEmployees.map((employee) => (
              <label
                className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white p-4 text-sm font-semibold text-gray-900 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50"
                key={employee.id}
              >
                <input
                  className="h-5 w-5 accent-amber-700"
                  defaultChecked={employee.canManagePersonalInventory}
                  name="employeeIds"
                  type="checkbox"
                  value={employee.id}
                />
                <span>
                  <span className="block">
                    {employee.lastName}, {employee.firstName}
                  </span>
                  <span className="mt-1 block text-xs font-medium text-gray-500">
                    {[employee.departmentLabel, employee.isLeadership ? "Leitung" : null]
                      .filter(Boolean)
                      .join(" · ") || "ohne Abteilung"}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="sticky bottom-3 mt-6 flex justify-end rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
            <button
              className="rounded-xl bg-gray-950 px-5 py-3 text-sm font-bold text-white"
              type="submit"
            >
              Auswahl speichern
            </button>
          </div>
        </section>
      </form>
    </AppShell>
  );
}
