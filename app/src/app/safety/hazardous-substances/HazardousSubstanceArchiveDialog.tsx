"use client";

import { useState } from "react";

import { ActionIcon } from "@/components/ActionIcon";

import {
  archiveHazardousSubstance,
  archiveTemplateHazardousSubstance,
} from "../actions";
import type { EditableHazardousSubstance } from "./HazardousSubstanceModal";

export function HazardousSubstanceArchiveDialog({
  id,
  name,
  sequentialNumber,
  substance,
}: {
  id: string;
  name: string;
  sequentialNumber: string | null;
  substance?: EditableHazardousSubstance;
}) {
  const [open, setOpen] = useState(false);
  const isTemplateRow = id.startsWith("template-");

  return (
    <>
      <button
        aria-label={`${name} archivieren`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
        title="Archivieren"
        type="button"
      >
        <ActionIcon className="h-4 w-4" name="delete" />
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal-nested)] flex items-center justify-center bg-gray-950/60 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-black">Gefahrstoff archivieren?</h2>
            <p className="mt-2 text-sm font-semibold text-black">
              {sequentialNumber ? `${sequentialNumber} · ` : ""}
              {name}
            </p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-black">
              Der Eintrag verschwindet aus dem aktiven Kataster und wird in das
              Gefahrstoffarchiv verschoben. Die laufende Nummer bleibt vergeben.
              Sie wird erst frei, wenn ein Administrator den Eintrag im Archiv
              endgültig löscht.
            </div>
            <form
              action={
                isTemplateRow
                  ? archiveTemplateHazardousSubstance
                  : archiveHazardousSubstance
              }
              className="mt-6"
            >
              <input name="id" type="hidden" value={id} />
              {isTemplateRow && substance ? (
                <>
                  <input name="templateRowId" type="hidden" value={id} />
                  <input name="name" type="hidden" value={substance.name} />
                  <input name="sequentialNumber" type="hidden" value={substance.sequentialNumber ?? ""} />
                  <input name="category" type="hidden" value={substance.category ?? ""} />
                  <input name="manufacturer" type="hidden" value={substance.manufacturer ?? ""} />
                  <input name="hazardSymbols" type="hidden" value={substance.hazardSymbols.join(", ")} />
                  <input name="registerSection" type="hidden" value={substance.registerSection} />
                  <input name="substanceType" type="hidden" value={substance.substanceType ?? ""} />
                  <input name="packageUnit" type="hidden" value={substance.packageUnit ?? ""} />
                  <input name="quantity" type="hidden" value={substance.quantity ?? ""} />
                  <input name="usageArea" type="hidden" value={substance.usageArea ?? ""} />
                  <input name="repeatYears" type="hidden" value={substance.repeatYears ?? ""} />
                  <input name="repeatMonths" type="hidden" value={substance.repeatMonths ?? ""} />
                  <input name="repeatDays" type="hidden" value={substance.repeatDays ?? ""} />
                  <input name="safetyDataSheetDate" type="hidden" value={substance.safetyDataSheetDate ?? ""} />
                  {substance.safetyDataSheetPresent ? <input name="safetyDataSheetPresent" type="hidden" value="on" /> : null}
                  {substance.operatingInstructionPresent ? <input name="operatingInstructionPresent" type="hidden" value="on" /> : null}
                </>
              ) : null}
              <div className="flex justify-end gap-3">
                <button
                  className="rounded-xl border border-gray-400 px-4 py-2.5 text-sm font-bold text-black"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Abbrechen
                </button>
                <button
                  className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800"
                  type="submit"
                >
                  Ja, archivieren
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
