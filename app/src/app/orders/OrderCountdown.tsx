"use client";

import { useEffect, useMemo, useState } from "react";

function getDeadlineToday(deadlineHour: number) {
  const deadline = new Date();
  deadline.setHours(deadlineHour, 0, 0, 0);
  return deadline;
}

function formatTimeLeft(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");
}

export function OrderCountdown({ deadlineHour }: { deadlineHour: number }) {
  const deadline = useMemo(() => getDeadlineToday(deadlineHour), [deadlineHour]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const remainingMs = deadline.getTime() - now.getTime();
  const isLocked = remainingMs <= 0;

  return (
    <div
      className={
        isLocked
          ? "rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm"
          : "rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm"
      }
    >
      <p
        className={
          isLocked
            ? "text-sm font-medium text-red-700"
            : "text-sm font-medium text-green-700"
        }
      >
        {isLocked ? "Bearbeitung gesperrt" : "Countdown bis Sperre"}
      </p>

      <p
        className={
          isLocked
            ? "mt-2 text-3xl font-bold text-red-900"
            : "mt-2 text-3xl font-bold text-green-900"
        }
      >
        {isLocked ? "00:00:00" : formatTimeLeft(remainingMs)}
      </p>

      <p
        className={
          isLocked ? "mt-2 text-xs text-red-700" : "mt-2 text-xs text-green-700"
        }
      >
        {isLocked
          ? "Die Bestellung ist nach 16:00 Uhr nur noch zur Kontrolle vorgesehen."
          : "Bis 16:00 Uhr kann die Bestellung vorbereitet werden."}
      </p>
    </div>
  );
}