import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ensureDefaultWorkTimePresets } from "@/lib/work-time";
import {
  createWorkTimePreset,
  deleteWorkTimePreset,
  seedWorkTimePresets,
  setDefaultWorkTimePreset,
  updateWorkTimePreset,
} from "./actions";

export default async function WorkingTimePage() {
  await ensureDefaultWorkTimePresets();

  const presets = await prisma.workTimePreset.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const defaultPreset = presets.find((preset) => preset.isDefault);

  return (
    <AppShell
      title="Arbeitszeit"
      description="Arbeitszeit-Vorlagen für Zeitstrahlen in LKW-Einteilung und Kurzstrecke verwalten."
    >
      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Aktuelle Standard-Arbeitszeit
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Diese Einstellung steuert die Standardansicht der Zeitstrahlen. Die
              tatsächlichen Tourzeiten bleiben trotzdem frei planbar.
            </p>

            <div className="mt-4 inline-flex rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {defaultPreset?.name ?? "Standard"}
                </div>
                <div className="mt-1 text-2xl font-bold text-gray-900">
                  {defaultPreset?.startTime ?? "06:30"} –{" "}
                  {defaultPreset?.endTime ?? "17:00"}
                </div>
              </div>
            </div>
          </div>

          <form action={seedWorkTimePresets}>
            <button
              type="submit"
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Standardwerte einspielen
            </button>
          </form>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Arbeitszeit-Vorlagen
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {presets.map((preset) => {
            const formId = `work-time-${preset.id}`;

            return (
              <div key={preset.id} className="p-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_130px_130px_100px_100px] lg:items-end">
                  <div className="flex flex-wrap items-center gap-2">
                    <form id={formId} action={updateWorkTimePreset}>
                      <input type="hidden" name="id" value={preset.id} />
                      <button
                        type="submit"
                        title="Arbeitszeit speichern"
                        aria-label="Arbeitszeit speichern"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                      >
                        <ActionIcon name="save" className="h-4 w-4" />
                      </button>
                    </form>

                    <form action={setDefaultWorkTimePreset}>
                      <input type="hidden" name="id" value={preset.id} />
                      <button
                        type="submit"
                        className={
                          preset.isDefault
                            ? "rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
                            : "rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                        }
                      >
                        {preset.isDefault ? "Standard" : "Als Standard"}
                      </button>
                    </form>

                    <form action={deleteWorkTimePreset}>
                      <input type="hidden" name="id" value={preset.id} />
                      <button
                        type="submit"
                        title="Arbeitszeit löschen"
                        aria-label="Arbeitszeit löschen"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                      >
                        <ActionIcon name="delete" className="h-4 w-4" />
                      </button>
                    </form>
                  </div>

                  <label className="text-sm font-medium text-gray-800">
                    Name
                    <input
                      form={formId}
                      name="name"
                      defaultValue={preset.name}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-800">
                    Beginn
                    <input
                      form={formId}
                      name="startTime"
                      type="time"
                      defaultValue={preset.startTime}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-800">
                    Ende
                    <input
                      form={formId}
                      name="endTime"
                      type="time"
                      defaultValue={preset.endTime}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="text-sm font-medium text-gray-800">
                    Position
                    <input
                      form={formId}
                      name="sortOrder"
                      type="number"
                      defaultValue={preset.sortOrder}
                      className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
                    <input
                      form={formId}
                      name="isActive"
                      type="checkbox"
                      defaultChecked={preset.isActive}
                      className="h-4 w-4"
                    />
                    aktiv
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <details className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer text-lg font-semibold text-gray-900">
          Arbeitszeit hinzufügen
        </summary>

        <form
          action={createWorkTimePreset}
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[1fr_140px_140px_120px_auto]"
        >
          <label className="text-sm font-medium text-gray-800">
            Name
            <input
              name="name"
              placeholder="z. B. Sommer kurz"
              required
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </label>

          <label className="text-sm font-medium text-gray-800">
            Beginn
            <input
              name="startTime"
              type="time"
              defaultValue="06:30"
              required
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </label>

          <label className="text-sm font-medium text-gray-800">
            Ende
            <input
              name="endTime"
              type="time"
              defaultValue="17:00"
              required
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </label>

          <label className="text-sm font-medium text-gray-800">
            Position
            <input
              name="sortOrder"
              type="number"
              defaultValue="999"
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Hinzufügen
            </button>
          </div>
        </form>
      </details>
    </AppShell>
  );
}
