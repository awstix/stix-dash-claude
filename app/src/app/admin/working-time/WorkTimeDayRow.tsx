"use client";

import { useState } from "react";
import type { WorkTimeDaySettings } from "@/lib/work-time";
import { workTimeDayLabels, type WorkTimeDayKey } from "@/lib/work-time-constants";

export function WorkTimeDayRow({
  day,
  dayHours,
  dayKey,
  formId,
}: {
  day: WorkTimeDaySettings;
  dayHours: number;
  dayKey: WorkTimeDayKey;
  formId?: string;
}) {
  const [noWorkday, setNoWorkday] = useState(!day.startTime && !day.endTime);

  return (
    <tr className="border-t border-gray-200">
      <td className="px-3 py-2 font-semibold text-gray-900">{workTimeDayLabels[dayKey]}</td>
      <td className="px-3 py-2">
        <input
          checked={noWorkday}
          className="h-4 w-4"
          form={formId}
          name={`${dayKey}NoWorkday`}
          onChange={(event) => setNoWorkday(event.target.checked)}
          type="checkbox"
        />
      </td>
      <td className="px-3 py-2">
        <DayTimeInput disabled={noWorkday} formId={formId} name={`${dayKey}StartTime`} value={day.startTime} />
      </td>
      <td className="px-3 py-2">
        <DayTimeInput disabled={noWorkday} formId={formId} name={`${dayKey}EndTime`} value={day.endTime} />
      </td>
      <td className="px-3 py-2">
        <DayTimeInput
          disabled={noWorkday}
          formId={formId}
          name={`${dayKey}BreakfastStart`}
          value={day.breakfastStart}
        />
      </td>
      <td className="px-3 py-2">
        <DayTimeInput
          disabled={noWorkday}
          formId={formId}
          name={`${dayKey}BreakfastEnd`}
          value={day.breakfastEnd}
        />
      </td>
      <td className="px-3 py-2">
        <DayTimeInput disabled={noWorkday} formId={formId} name={`${dayKey}LunchStart`} value={day.lunchStart} />
      </td>
      <td className="px-3 py-2">
        <DayTimeInput disabled={noWorkday} formId={formId} name={`${dayKey}LunchEnd`} value={day.lunchEnd} />
      </td>
      <td className="px-3 py-2 font-semibold text-gray-900">
        {noWorkday
          ? "– (kein Arbeitstag)"
          : dayHours > 0
            ? `${dayHours.toLocaleString("de-DE")} Std.`
            : "– (kein Arbeitstag)"}
      </td>
    </tr>
  );
}

function DayTimeInput({
  disabled,
  formId,
  name,
  value,
}: {
  disabled: boolean;
  formId?: string;
  name: string;
  value: string;
}) {
  return (
    <input
      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
      defaultValue={value}
      disabled={disabled}
      form={formId}
      name={name}
      type="time"
    />
  );
}
