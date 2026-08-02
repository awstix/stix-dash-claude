"use client";

import { useState } from "react";

function computeHours(startTime: string, endTime: string) {
  const toMinutes = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null || end <= start) return 0;
  return Math.round(((end - start) / 60) * 100) / 100;
}

export function DispositionHoursFields({
  compact,
  defaultEndTime,
  defaultStartTime,
  defaultWholeDay,
}: {
  compact?: boolean;
  defaultEndTime: string;
  defaultStartTime: string;
  defaultWholeDay: boolean;
}) {
  const [wholeDay, setWholeDay] = useState(defaultWholeDay);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const hours = computeHours(startTime, endTime);

  const labelClass = compact ? "text-xs font-semibold text-gray-700" : "text-sm font-medium text-gray-800";
  const inputClass = compact
    ? "mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
    : "mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400";

  return (
    <>
      <label className={`flex items-center gap-2 ${labelClass}`}>
        <input
          checked={wholeDay}
          className="h-4 w-4 rounded border-gray-300"
          onChange={(event) => setWholeDay(event.target.checked)}
          type="checkbox"
        />
        Ganzer Tag
      </label>

      <label className={labelClass}>
        Beginn
        <input
          className={inputClass}
          defaultValue={defaultStartTime}
          disabled={wholeDay}
          name="startTime"
          onChange={(event) => setStartTime(event.target.value)}
          type="time"
        />
      </label>

      <label className={labelClass}>
        Ende
        <input
          className={inputClass}
          defaultValue={defaultEndTime}
          disabled={wholeDay}
          name="endTime"
          onChange={(event) => setEndTime(event.target.value)}
          type="time"
        />
      </label>

      <label className={labelClass}>
        Stunden
        <input
          className={`${inputClass} bg-gray-50`}
          disabled={wholeDay}
          name="hours"
          readOnly
          type="text"
          value={wholeDay ? "" : hours.toLocaleString("de-DE")}
        />
      </label>
    </>
  );
}
