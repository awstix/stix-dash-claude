"use client";

import { workTimeDayKeys, workTimeDayLabels } from "@/lib/work-time-constants";

export function TimeReminderFields({
  extraRecipients,
  intervalWeeks,
  mode,
  onExtraRecipientsChange,
  onIntervalWeeksChange,
  onModeChange,
  onWeekdaysChange,
  weekdays,
}: {
  extraRecipients: string;
  intervalWeeks: number;
  mode: "inherit" | "custom" | "off";
  onExtraRecipientsChange: (value: string) => void;
  onIntervalWeeksChange: (weeks: number) => void;
  onModeChange: (mode: "inherit" | "custom" | "off") => void;
  onWeekdaysChange: (weekdays: string[]) => void;
  weekdays: string[];
}) {
  function toggleDay(day: string) {
    onWeekdaysChange(
      weekdays.includes(day) ? weekdays.filter((current) => current !== day) : [...weekdays, day],
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <label className="text-sm font-medium text-gray-700">
        Erinnerungsmail bei offenen Stundenfreigaben
      </label>
      <select
        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        onChange={(event) => onModeChange(event.target.value as "inherit" | "custom" | "off")}
        value={mode}
      >
        <option value="inherit">
          Zentrale Einstellung übernehmen (Standard, siehe Admin &gt; Zeiterfassung)
        </option>
        <option value="custom">Eigenen Zeitplan für diese Baustelle festlegen</option>
        <option value="off">Für diese Baustelle nie Erinnerungen senden</option>
      </select>

      {mode === "custom" ? (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {workTimeDayKeys.map((day) => (
              <label
                key={day}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800"
              >
                <input
                  checked={weekdays.includes(day)}
                  className="h-4 w-4"
                  onChange={() => toggleDay(day)}
                  type="checkbox"
                />
                {workTimeDayLabels[day]}
              </label>
            ))}
          </div>
          <select
            className="w-full max-w-xs rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            onChange={(event) => onIntervalWeeksChange(Number(event.target.value))}
            value={String(intervalWeeks)}
          >
            <option value="1">Jede Woche</option>
            <option value="2">Alle 2 Wochen</option>
            <option value="3">Alle 3 Wochen</option>
            <option value="4">Alle 4 Wochen</option>
          </select>
        </div>
      ) : null}

      {mode !== "off" ? (
        <label className="mt-3 block text-xs font-semibold text-gray-700">
          Zusätzliche externe Empfänger (optional, z.B. Auftraggeber-Vertreter – nicht der Bauleiter,
          dessen E-Mail kommt automatisch aus der Personalakte)
          <textarea
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            onChange={(event) => onExtraRecipientsChange(event.target.value)}
            placeholder="z.B. vertreter@auftraggeber.de"
            rows={2}
            value={extraRecipients}
          />
        </label>
      ) : null}
    </div>
  );
}
