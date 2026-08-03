"use client";

import { useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { setWorkTimeCalendarDays } from "../actions";

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
  barClass: string;
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
  calendarId,
  dayTypes,
  holidayOverlay,
  initialDays,
  year,
}: {
  calendarId: string;
  dayTypes: WorkTimeCalendarGridDayType[];
  holidayOverlay: Record<string, WorkTimeCalendarGridHolidayOverlay>;
  initialDays: Record<string, string>;
  year: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [days, setDays] = useState<Record<string, string | undefined>>(initialDays);
  const [activeTypeId, setActiveTypeId] = useState<string | null>(dayTypes[0]?.id ?? null);
  const isPaintingRef = useRef(false);
  const pendingDatesRef = useRef<Set<string>>(new Set());
  const maxDays = 31;

  const dayTypeById = new Map(dayTypes.map((type) => [type.id, type]));

  function paintDate(key: string) {
    setDays((current) => ({ ...current, [key]: activeTypeId ?? undefined }));
    pendingDatesRef.current.add(key);
  }

  function commitPaint() {
    if (!isPaintingRef.current) return;
    isPaintingRef.current = false;
    const dates = Array.from(pendingDatesRef.current);
    pendingDatesRef.current = new Set();
    if (dates.length === 0) return;
    startTransition(async () => {
      await setWorkTimeCalendarDays({ calendarId, dates, dayTypeId: activeTypeId });
      router.refresh();
    });
  }

  function handlePointerDown(key: string) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      isPaintingRef.current = true;
      paintDate(key);
    };
  }

  function handlePointerEnter(key: string) {
    return () => {
      if (!isPaintingRef.current) return;
      paintDate(key);
    };
  }

  return (
    <div onPointerLeave={commitPaint} onPointerUp={commitPaint}>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <span className="text-xs font-semibold text-gray-700">Pinsel:</span>
        {dayTypes.map((type) => (
          <button
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold ${
              activeTypeId === type.id ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-300"
            } ${type.barClass}`}
            key={type.id}
            onClick={() => setActiveTypeId(type.id)}
            type="button"
          >
            {type.number}. ({type.hours.toLocaleString("de-DE")} Std.)
          </button>
        ))}
        <button
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold text-gray-700 ${
            activeTypeId === null ? "border-gray-900 bg-gray-100 ring-2 ring-gray-900" : "border-gray-300 bg-white"
          }`}
          onClick={() => setActiveTypeId(null)}
          type="button"
        >
          Löschen (leer)
        </button>
        <span className="ml-auto text-xs text-gray-500">
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
                              type ? type.barClass : "bg-white text-gray-500 hover:bg-gray-100"
                            } ${overlay ? overlay.ringClass : ""}`}
                            onPointerDown={handlePointerDown(key)}
                            onPointerEnter={handlePointerEnter(key)}
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
