import Link from "next/link";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { getCrewTimeActivities } from "@/lib/crew-time-activities";
import {
  createCrewTimeActivity,
  deleteCrewTimeActivity,
  updateCrewTimeActivity,
} from "./actions";

export default async function CrewTimeActivitiesPage() {
  const activities = await getCrewTimeActivities();

  return (
    <AppShell
      title="Tätigkeiten"
      description="Tätigkeiten, die Poliere/Mitarbeiter bei einer Kolonnen-Buchung auswählen (z. B. Arbeiten)."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/working-time"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Arbeitszeit-Übersicht
        </Link>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="p-3">Bezeichnung</th>
                <th className="p-3">Aktiv</th>
                <th className="p-3">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500">
                    Noch keine Tätigkeiten angelegt.
                  </td>
                </tr>
              ) : (
                activities.map((activity) => {
                  const formId = `activity-${activity.id}`;
                  return (
                    <tr key={activity.id} className="border-b border-gray-100 align-top">
                      <td className="p-3">
                        <input
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                          defaultValue={activity.label}
                          form={formId}
                          name="label"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          defaultChecked={activity.isActive}
                          form={formId}
                          name="isActive"
                          type="checkbox"
                        />
                      </td>
                      <td className="p-3">
                        <form action={updateCrewTimeActivity} className="inline" id={formId}>
                          <input name="id" type="hidden" value={activity.id} />
                        </form>
                        <div className="flex gap-2">
                          <button
                            aria-label="Tätigkeit speichern"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                            form={formId}
                            title="Speichern"
                            type="submit"
                          >
                            <ActionIcon name="save" className="h-4 w-4" />
                          </button>
                          <form action={deleteCrewTimeActivity}>
                            <input name="id" type="hidden" value={activity.id} />
                            <button
                              aria-label="Tätigkeit löschen"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                              title="Löschen"
                              type="submit"
                            >
                              <ActionIcon name="delete" className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <details className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-lg font-semibold text-gray-900">
          Tätigkeit hinzufügen
        </summary>

        <form action={createCrewTimeActivity} className="mt-5 flex flex-wrap items-end gap-4">
          <label className="text-xs font-semibold text-gray-700">
            Bezeichnung
            <input
              className="mt-1 w-64 rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
              name="label"
              required
            />
          </label>
          <button
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            type="submit"
          >
            Hinzufügen
          </button>
        </form>
      </details>
    </AppShell>
  );
}
