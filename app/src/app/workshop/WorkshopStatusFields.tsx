"use client";

import { useState } from "react";

const statusOptions = [
  { label: "Offen", value: "OPEN" },
  { label: "In Arbeit", value: "IN_PROGRESS" },
  { label: "Wartet", value: "WAITING" },
  { label: "Erledigt", value: "DONE" },
  { label: "Abgebrochen", value: "CANCELLED" },
];

function todayInputValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function getFormControlValue(control: Element | RadioNodeList | null) {
  if (control && "value" in control) {
    return String(control.value);
  }

  return "";
}

export function WorkshopStatusFields({
  completedByLabel = "Erledigt / freigegeben von",
  defaultCompletedAt,
  defaultCompletedByName = "",
  defaultStatus,
  personnel = [],
  statusLabel = "Status",
}: {
  completedByLabel?: string;
  defaultCompletedAt: string;
  defaultCompletedByName?: string;
  defaultStatus: string;
  personnel?: { id: string; name: string }[];
  statusLabel?: string;
}) {
  const [status, setStatus] = useState(defaultStatus);
  const [completedAt, setCompletedAt] = useState(defaultCompletedAt);
  const [hint, setHint] = useState("");

  function handleStatusValue(nextStatus: string) {
    setStatus(nextStatus);

    if (nextStatus === "DONE" && !completedAt) {
      setCompletedAt(todayInputValue());
      setHint(
        "Status Erledigt gewählt, Erledigt-Datum wurde auf heute gesetzt.",
      );
      return;
    }

    if (nextStatus !== "DONE" && completedAt) {
      setCompletedAt("");
      setHint("Status ist nicht erledigt, Erledigt-Datum wurde entfernt.");
      return;
    }

    setHint("");
  }

  function handleCompletedAtValue(
    nextDate: string,
    form: HTMLFormElement | null,
  ) {
    const currentStatus = getFormControlValue(
      form?.elements.namedItem("status") ?? null,
    );

    setCompletedAt(nextDate);

    if (nextDate && currentStatus !== "DONE") {
      setStatus("DONE");
      setHint(
        "Erledigt-Datum eingetragen, Status wurde auf Erledigt gesetzt.",
      );
      return;
    }

    setHint("");
  }

  return (
    <>
      <label className="text-sm font-medium text-gray-800">
        {statusLabel}
        <select
          name="status"
          value={status}
          onChange={(event) => handleStatusValue(event.currentTarget.value)}
          onInput={(event) => handleStatusValue(event.currentTarget.value)}
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-gray-800">
        Erledigt am
        <input
          type="date"
          name="completedAt"
          value={completedAt}
          onChange={(event) =>
            handleCompletedAtValue(
              event.currentTarget.value,
              event.currentTarget.form,
            )
          }
          onInput={(event) =>
            handleCompletedAtValue(
              event.currentTarget.value,
              event.currentTarget.form,
            )
          }
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        {completedByLabel}
        <input
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={defaultCompletedByName}
          list="workshop-completed-by-options"
          name="completedByName"
          placeholder="Name eingeben oder auswählen"
        />
        <datalist id="workshop-completed-by-options">
          {personnel.map((person) => (
            <option key={person.id} value={person.name} />
          ))}
        </datalist>
      </label>

      {hint ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 md:col-span-3">
          {hint}
        </div>
      ) : null}
    </>
  );
}
