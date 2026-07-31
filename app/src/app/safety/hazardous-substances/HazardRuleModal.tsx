"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";

import { createSafetyHazardRule } from "../actions";

const inputClass =
  "w-full rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-sm font-medium text-black shadow-sm outline-none placeholder:text-gray-500 focus:border-black";

export function HazardRuleModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="rounded-xl bg-yellow-400 px-4 py-2.5 text-sm font-bold text-black hover:bg-yellow-300"
        onClick={() => setOpen(true)}
        type="button"
      >
        + Regelwerk hinzufügen
      </button>
      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] overflow-y-auto bg-gray-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          style={{ color: "#000000" }}
        >
          <div className="mx-auto my-4 max-h-[calc(100vh-2rem)] max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-300 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-black">
                  Regelwerk hinzufügen
                </h2>
                <p className="mt-1 text-sm font-medium text-black">
                  Der Eintrag wird in Webansicht und Excel-Reiter übernommen.
                </p>
              </div>
              <button
                aria-label="Regelwerk-Popup schließen"
                className="rounded-full border border-gray-400 px-3 py-1.5 text-lg font-bold text-black hover:bg-gray-100"
                onClick={() => setOpen(false)}
                type="button"
              >
                <ActionIcon name="close" className="h-4 w-4" />
              </button>
            </div>
            <form action={createSafetyHazardRule} className="space-y-4 p-6 text-black">
              <div className="grid gap-4 md:grid-cols-2">
                <Field defaultValue="Gefahrstoff" label="Thema" name="topic" required />
                <Field label="Quelle" name="source" placeholder="z. B. GefStoffV" required />
              </div>
              <Field label="Abschnitt" name="section" placeholder="z. B. § 6 Informationsermittlung" />
              <label className="block space-y-2">
                <span className="text-sm font-bold text-black">Text</span>
                <textarea className={`${inputClass} min-h-40`} name="text" required />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-bold text-black">
                  Bemerkung / Umsetzung
                </span>
                <textarea className={`${inputClass} min-h-28`} name="implementation" />
              </label>
              <div className="flex justify-end gap-3 border-t border-gray-300 pt-5">
                <button
                  className="rounded-xl border border-gray-400 px-5 py-3 text-sm font-bold text-black hover:bg-gray-100"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Abbrechen
                </button>
                <button
                  className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-300"
                  type="submit"
                >
                  Regelwerk speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field({
  label,
  name,
  ...props
}: {
  label: string;
  name: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-black">{label}</span>
      <input className={inputClass} name={name} {...props} />
    </label>
  );
}
