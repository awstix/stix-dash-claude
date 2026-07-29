import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createFirstAdmin } from "./actions";

export default async function SetupPage() {
  if ((await prisma.user.count()) > 0) redirect("/login");

  const employees = await prisma.employee.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      email: true,
      firstName: true,
      id: true,
      lastName: true,
    },
    where: { statusValue: "active" },
  });
  const inputClass =
    "mt-2 w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-gray-950";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <section className="w-full max-w-2xl rounded-2xl border border-gray-300 bg-white p-7 text-gray-950 shadow-xl">
        <h1 className="text-2xl font-black">STIX Portal einrichten</h1>
        <p className="mt-2 text-sm font-medium text-gray-700">
          Hier wird einmalig das erste Administratorkonto angelegt. Danach ist
          diese Seite automatisch gesperrt.
        </p>
        <form action={createFirstAdmin} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-bold">
            Vor- und Nachname (nur ohne Mitarbeiterverknüpfung)
            <input className={inputClass} name="name" />
            <span className="mt-1 block text-xs font-semibold text-gray-700">
              Wenn unten eine Mitarbeiterakte gewählt wird, übernimmt das
              System den Namen automatisch.
            </span>
          </label>
          <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-950">
            <p className="font-bold">Benutzername wird automatisch vergeben</p>
            <p className="mt-1 font-semibold">
              Nachname + erste drei Buchstaben des Vornamens, zum Beispiel
              <span className="ml-1 font-black">wittlif-art</span>.
            </p>
          </div>
          <label className="text-sm font-bold md:col-span-2">
            E-Mail-Adresse (optional)
            <input className={inputClass} name="email" type="email" />
            <span className="mt-1 block text-xs font-semibold text-gray-700">
              Ohne E-Mail ist die Anmeldung weiterhin über den Benutzernamen
              möglich.
            </span>
          </label>
          <label className="text-sm font-bold md:col-span-2">
            Mitarbeiterakte verknüpfen (optional)
            <select className={inputClass} name="employeeId">
              <option value="">Keine Mitarbeiterakte verknüpfen</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.lastName}, {employee.firstName}
                  {employee.email ? ` · ${employee.email}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Passwort
            <input
              autoComplete="new-password"
              className={inputClass}
              minLength={10}
              name="password"
              required
              type="password"
            />
            <span className="mt-1 block text-xs font-semibold text-gray-700">
              Mindestens 10 Zeichen
            </span>
          </label>
          <label className="text-sm font-bold">
            Passwort wiederholen
            <input
              autoComplete="new-password"
              className={inputClass}
              minLength={10}
              name="passwordRepeat"
              required
              type="password"
            />
          </label>
          <button className="rounded-xl bg-gray-950 px-4 py-3 font-bold text-white hover:bg-gray-800 md:col-span-2">
            Erstes Administratorkonto anlegen
          </button>
        </form>
      </section>
    </main>
  );
}
