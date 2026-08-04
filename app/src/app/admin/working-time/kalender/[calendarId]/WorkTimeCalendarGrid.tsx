"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

const monthNames = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
const weekdayShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function weekdayForDate(year: number, month: number, day: number) {
  return weekdayShort[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export type WorkTimeCalendarGridDayType = {
  colorStyle: { backgroundColor: string; color: string };
  hours: number;
  id: string;
  number: number;
};

export type WorkTimeCalendarGridHolidayOverlay = {
  kind: string;
  label: string;
  ringClass: string;
};

export function WorkTimeCalendarGrid({
  activeTypeId,
  dayTypes,
  days,
  dirtyDates,
  holidayOverlay,
  onActiveTypeChange,
  onPaint,
  year,
}: {
  activeTypeId: string | null;
  dayTypes: WorkTimeCalendarGridDayType[];
  days: Record<string, string | undefined>;
  dirtyDates: Set<string>;
  holidayOverlay: Record<string, WorkTimeCalendarGridHolidayOverlay>;
  onActiveTypeChange: (typeId: string | null) => void;
  onPaint: (dateKey: string) => void;
  year: number;
}) {
  const isPaintingRef = useRef(false);
  const maxDays = 31;

  const dayTypeById = new Map(dayTypes.map((type) => [type.id, type]));

  function stopPainting() {
    isPaintingRef.current = false;
  }

  function handlePointerDown(key: string) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      isPaintingRef.current = true;
      onPaint(key);
    };
  }

  function handlePointerEnter(key: string) {
    return () => {
      if (!isPaintingRef.current) return;
      onPaint(key);
    };
  }

  return (
    <div onPointerLeave={stopPainting} onPointerUp={stopPainting}>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <span className="text-xs font-semibold text-gray-700">Pinsel:</span>
        {dayTypes.map((type) => (
          <button
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold ${
              activeTypeId === type.id ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-300"
            }`}
            key={type.id}
            onClick={() => onActiveTypeChange(type.id)}
            style={type.colorStyle}
            type="button"
          >
            {type.number}. ({type.hours.toLocaleString("de-DE")} Std.)
          </button>
        ))}
        <button
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold text-gray-700 ${
            activeTypeId === null ? "border-gray-900 bg-gray-100 ring-2 ring-gray-900" : "border-gray-300 bg-white"
          }`}
          onClick={() => onActiveTypeChange(null)}
          type="button"
        >
          Löschen (leer)
        </button>
        <span className="text-xs text-gray-500">
          Klicken oder klicken &amp; ziehen, um Tage mit dem gewählten Pinsel zu füllen.
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full table-fixed select-none text-left text-xs">
          <colgroup>
            <col style={{ width: "64px" }} />
            {Array.from({ length: maxDays }, (_, index) => (
              <col key={index} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="sticky left-0 z-10 bg-gray-900 p-1">Monat</th>
              {Array.from({ length: maxDays }, (_, index) => (
                <th className="p-0.5 text-center font-medium" key={index}>
                  {index + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthNames.map((monthName, monthIndex) => {
              const month = monthIndex + 1;
              const monthDayCount = daysInMonth(year, month);
              return (
                <tr className="border-b border-gray-100" key={month}>
                  <td className="sticky left-0 z-10 bg-white p-1 font-semibold text-gray-900">
                    {monthName.slice(0, 3)}
                  </td>
                  {Array.from({ length: maxDays }, (_, index) => {
                    const day = index + 1;
                    if (day > monthDayCount) return <td className="px-0.5 py-2" key={index} />;
                    const key = dateKey(year, month, day);
                    const type = dayTypeById.get(days[key] ?? "");
                    const overlay = holidayOverlay[key];
                    const dirty = dirtyDates.has(key);
                    const title = [type ? `${key}: Planzeit ${type.number}` : key, overlay?.label]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <td className="px-0.5 py-2 text-center align-top" key={index}>
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="text-[8px] leading-none font-medium text-gray-400">
                            {weekdayForDate(year, month, day)}
                          </div>
                          <div
                            className={`mx-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[10px] ${
                              type ? "" : "bg-white text-gray-500 hover:bg-gray-100"
                            } ${overlay ? overlay.ringClass : ""} ${
                              dirty ? "outline outline-2 outline-offset-1 outline-blue-500" : ""
                            }`}
                            onPointerDown={handlePointerDown(key)}
                            onPointerEnter={handlePointerEnter(key)}
                            style={type ? type.colorStyle : undefined}
                            title={title}
                          >
                            {day}
                          </div>
                          <div className="text-[8px] leading-none font-semibold text-gray-600">
                            {type ? type.hours.toLocaleString("de-DE") : ""}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
