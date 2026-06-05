"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionIcon } from "@/components/ActionIcon";

type SelectOption = {
  label: string;
  value: string;
};

type ExportFilters = {
  from: string;
  to: string;
  q: string;
  status: string;
  type: string;
  project: string;
  onlyWithEntries: boolean;
  sort: "name" | "project" | "type";
};

export function EmployeeExportDialog({
  currentFilters,
  statusOptions,
  typeOptions,
  projectOptions,
}: {
  currentFilters: ExportFilters;
  statusOptions: SelectOption[];
  typeOptions: SelectOption[];
  projectOptions: SelectOption[];
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"complete" | "filtered">("filtered");
  const dialogRef = useRef<HTMLDivElement>(null);
  const filtersDisabled = scope === "complete";

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const dialog = open ? (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-gray-950/30 p-4"
      onMouseDown={(event) => {
        if (
          event.target instanceof Node &&
          dialogRef.current &&
          !dialogRef.current.contains(event.target)
        ) {
          setOpen(false);
        }
      }}
    >
      <div
        ref={dialogRef}
        className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Excel-Export
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Zeitraum, Umfang und Filter für die Mitarbeiterdisposition.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-xl leading-none text-gray-700 hover:bg-gray-50"
            aria-label="Fenster schließen"
          >
            x
          </button>
        </div>

        <form
          action="/employee-dispatch/export"
          method="get"
          onSubmit={() => {
            window.setTimeout(() => setOpen(false), 0);
          }}
          className="mt-5 space-y-5"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-gray-800">
              Von
              <input
                type="date"
                name="from"
                required
                defaultValue={currentFilters.from}
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Bis
              <input
                type="date"
                name="to"
                required
                defaultValue={currentFilters.to}
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-gray-800">
              Umfang
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 p-4 text-sm text-gray-800">
                <input
                  type="radio"
                  name="scope"
                  value="filtered"
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                  className="mt-1 h-4 w-4 border-gray-300"
                />
                <span>
                  <span className="block font-semibold">Mit Filtern</span>
                  <span className="mt-1 block text-gray-600">
                    Die unten gewählten Filter werden in den Export übernommen.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 p-4 text-sm text-gray-800">
                <input
                  type="radio"
                  name="scope"
                  value="complete"
                  checked={scope === "complete"}
                  onChange={() => setScope("complete")}
                  className="mt-1 h-4 w-4 border-gray-300"
                />
                <span>
                  <span className="block font-semibold">
                    Komplette Liste
                  </span>
                  <span className="mt-1 block text-gray-600">
                    Alle aktiven Mitarbeiter im Zeitraum, ohne Such-, Status-,
                    Art- oder Projektfilter.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <div
            className={
              filtersDisabled
                ? "grid grid-cols-1 gap-4 opacity-50 md:grid-cols-2"
                : "grid grid-cols-1 gap-4 md:grid-cols-2"
            }
          >
            <label className="text-sm font-medium text-gray-800 md:col-span-2">
              Suche
              <input
                name="q"
                defaultValue={currentFilters.q}
                disabled={filtersDisabled}
                placeholder="Name, Berufsgruppe oder Baustelle"
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 disabled:bg-gray-100"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Status
              <select
                name="status"
                defaultValue={currentFilters.status}
                disabled={filtersDisabled}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 disabled:bg-gray-100"
              >
                <option value="">Alle Status</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-800">
              Art
              <select
                name="type"
                defaultValue={currentFilters.type}
                disabled={filtersDisabled}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 disabled:bg-gray-100"
              >
                <option value="">Alle Arten</option>
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-800 md:col-span-2">
              Projekt / Baustelle
              <select
                name="project"
                defaultValue={currentFilters.project}
                disabled={filtersDisabled}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 disabled:bg-gray-100"
              >
                <option value="">Alle Projekte</option>
                {projectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 text-sm font-semibold text-gray-800">
              <input
                type="checkbox"
                name="onlyWithEntries"
                value="1"
                defaultChecked={currentFilters.onlyWithEntries}
                disabled={filtersDisabled}
                className="h-4 w-4 rounded border-gray-300 disabled:bg-gray-100"
              />
              Nur Mitarbeiter mit Einträgen
            </label>
          </div>

          <label className="block text-sm font-medium text-gray-800">
            <span className="block">Sortierung</span>
            <select
              name="sort"
              defaultValue={currentFilters.sort}
              className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 md:w-72"
            >
              <option value="name">Nach Nachname</option>
              <option value="project">Nach Projekt</option>
              <option value="type">Nach Art</option>
            </select>
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-600"
            >
              <ActionIcon name="download" className="h-4 w-4" />
              Export erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100"
      >
        <ActionIcon name="download" className="h-4 w-4" />
        Excel-Export
      </button>

      {typeof document !== "undefined" && dialog
        ? createPortal(dialog, document.body)
        : null}
    </>
  );
}
