"use client";

import { useState } from "react";

import { HAZARD_SYMBOLS } from "@/lib/hazard-register-constants";

import {
  createHazardousSubstance,
  updateHazardousSubstance,
} from "../actions";

const inputClass =
  "w-full rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-sm font-medium text-black shadow-sm outline-none placeholder:text-black focus:border-black";

export type EditableHazardousSubstance = {
  category: string | null;
  dataSheets: Array<{
    displayName: string;
    documentType: string;
    id: string;
    publicUrl: string;
    uploadedAt: string;
    versionDate: string | null;
  }>;
  hazardSymbols: string[];
  id: string;
  manufacturer: string | null;
  name: string;
  nextReviewDate: string | null;
  operatingInstructionPresent: boolean;
  operatingInstructionTemplateIds: string[];
  packageUnit: string | null;
  quantity: number | null;
  registerSection: string;
  repeatDays: number | null;
  repeatMonths: number | null;
  repeatYears: number | null;
  safetyDataSheetDate: string | null;
  safetyDataSheetPresent: boolean;
  sequentialNumber: string | null;
  substanceType: string | null;
  usageArea: string | null;
};

export function HazardousSubstanceModal({
  availableWorkAreas = [],
  operatingInstructionTemplates = [],
  suggestedSequentialNumber,
  substance,
}: {
  suggestedSequentialNumber?: string;
  availableWorkAreas?: string[];
  operatingInstructionTemplates?: Array<{ id: string; title: string }>;
  substance?: EditableHazardousSubstance;
}) {
  const [open, setOpen] = useState(false);
  const [customWorkAreas, setCustomWorkAreas] = useState<string[]>([""]);
  const isEditing = Boolean(substance);
  const isTemplateRow = substance?.id.startsWith("template-") ?? false;

  return (
    <>
      <button
        aria-label={
          isEditing ? `${substance?.name} bearbeiten` : undefined
        }
        className={
          isEditing
            ? "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
            : "rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black shadow-sm hover:bg-yellow-300"
        }
        onClick={() => setOpen(true)}
        title={isEditing ? "Bearbeiten" : undefined}
        type="button"
      >
        {isEditing ? (
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        ) : (
          "+ Gefahrstoff hinzufügen"
        )}
      </button>

      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[1200] overflow-y-auto bg-gray-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          style={{ color: "#000000" }}
        >
          <div className="mx-auto my-4 max-h-[calc(100vh-2rem)] max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-3xl border-b border-gray-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-black">
                  {isEditing ? "Gefahrstoff bearbeiten" : "Gefahrstoff hinzufügen"}
                </h2>
                <p className="mt-1 text-sm font-medium text-black">
                  Felder entsprechend dem originalen Gefahrstoffkataster.
                </p>
              </div>
              <button
                aria-label="Popup schließen"
                className="rounded-full border border-gray-400 px-3 py-1.5 text-lg font-bold text-black hover:bg-gray-100"
                onClick={() => setOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <form
              action={
                isEditing && !isTemplateRow
                  ? updateHazardousSubstance
                  : createHazardousSubstance
              }
              className="space-y-6 p-6 text-black"
            >
              {substance && !isTemplateRow ? (
                <input name="id" type="hidden" value={substance.id} />
              ) : null}
              {isTemplateRow ? (
                <input name="templateRowId" type="hidden" value={substance?.id} />
              ) : null}
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-black">
                Die nächste freie laufende Nummer wird vorgeschlagen. Bleibt das
                Feld leer, vergibt das System diese Nummer automatisch.
                Archivierte Gefahrstoffe behalten ihre Nummer. Erst wenn ein
                Administrator den Eintrag im Archiv endgültig löscht, wird die
                Nummer wieder frei.
              </div>
              <fieldset>
                <legend className="text-sm font-bold text-black">
                  Kataster-Reiter
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-300 p-4">
                    <input
                      className="mt-1"
                      defaultChecked={substance?.registerSection !== "WITHOUT_BA"}
                      name="registerSection"
                      type="radio"
                      value="HAZARDOUS"
                    />
                    <span>
                      <strong className="block text-sm text-black">
                        Gefährliche Gefahrstoffe
                      </strong>
                      <span className="text-xs text-black">
                        Mit Betriebsanweisung und Arbeitsbereich
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-300 p-4">
                    <input
                      className="mt-1"
                      name="registerSection"
                      type="radio"
                      value="WITHOUT_BA"
                      defaultChecked={substance?.registerSection === "WITHOUT_BA"}
                    />
                    <span>
                      <strong className="block text-sm text-black">
                        Gefahrstoffe ohne BA
                      </strong>
                      <span className="text-xs text-black">
                        Eintrag in den zweiten Kataster-Reiter
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-bold text-black">
                  GHS-Gefahrensymbole
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {HAZARD_SYMBOLS.map(([code, label, imagePath]) => (
                    <label
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-sm text-black hover:bg-yellow-100"
                      key={code}
                    >
                      <input
                        defaultChecked={substance?.hazardSymbols.includes(code)}
                        name="hazardSymbol"
                        type="checkbox"
                        value={code}
                      />
                      <img
                        alt=""
                        className="h-12 w-12 shrink-0 object-contain"
                        height={48}
                        src={imagePath}
                        width={48}
                      />
                      <span className="text-black">
                        <strong className="block text-black">{code}</strong>
                        <span className="text-black">{label}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field
                  defaultValue={
                    substance?.sequentialNumber ?? suggestedSequentialNumber ?? ""
                  }
                  label="Lfd. Nummer"
                  min="1"
                  name="sequentialNumber"
                  placeholder={suggestedSequentialNumber}
                  type="number"
                />
                <Field defaultValue={substance?.manufacturer ?? ""} label="Hersteller" name="manufacturer" />
                <Field defaultValue={substance?.name ?? ""} label="Produktname / Typ" name="name" required />
                <Field defaultValue={substance?.substanceType ?? ""} label="Art" name="substanceType" />
                <Field defaultValue={substance?.packageUnit ?? ""} label="Einheit / Gebinde" name="packageUnit" />
                <Field defaultValue={substance?.quantity ?? ""} label="Menge" name="quantity" step="any" type="number" />
                <Field defaultValue={substance?.safetyDataSheetDate ?? ""} label="SDB-Datum" name="safetyDataSheetDate" type="date" />
                <Field
                  defaultValue={substance?.nextReviewDate ?? ""}
                  label="Datum nächste Prüfung"
                  name="nextReviewDate"
                  type="date"
                />
              </div>

              <fieldset>
                <legend className="text-sm font-bold text-black">
                  Arbeitsbereiche (Mehrfachauswahl)
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {availableWorkAreas.map((area) => (
                    <label
                      className="flex items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-semibold text-black"
                      key={area}
                    >
                      <input
                        defaultChecked={String(substance?.usageArea ?? "")
                          .split(/\s*\+\s*/)
                          .includes(area)}
                        name="usageArea"
                        type="checkbox"
                        value={area}
                      />
                      {area}
                    </label>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {customWorkAreas.map((_, index) => (
                    <input
                      className={inputClass}
                      key={index}
                      name="customUsageArea"
                      placeholder="Weiteren Arbeitsbereich eingeben"
                    />
                  ))}
                  <button
                    className="rounded-xl border border-gray-400 bg-white px-3 py-2 text-sm font-bold text-black"
                    onClick={() =>
                      setCustomWorkAreas((areas) => [...areas, ""])
                    }
                    type="button"
                  >
                    + weiteren freien Bereich ergänzen
                  </button>
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-bold text-black">
                  Wiederholungsfrist
                </legend>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <Field defaultValue={substance?.repeatYears ?? ""} label="Jahre" min="0" name="repeatYears" type="number" />
                  <Field defaultValue={substance?.repeatMonths ?? ""} label="Monate" min="0" name="repeatMonths" type="number" />
                  <Field defaultValue={substance?.repeatDays ?? ""} label="Tage" min="0" name="repeatDays" type="number" />
                </div>
              </fieldset>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-green-300 bg-green-50 p-4 text-sm font-semibold text-black">
                  <input defaultChecked={substance?.safetyDataSheetPresent} name="safetyDataSheetPresent" type="checkbox" />
                  Sicherheitsdatenblatt (SDB) vorhanden
                </label>
                <div className="rounded-2xl border border-green-300 bg-green-50 p-4 text-sm font-semibold text-black">
                  Betriebsanweisung wird als vorhanden markiert, sobald eine
                  Datei hochgeladen oder eine bestehende BA zugewiesen ist.
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-black">
                  Sicherheitsdatenblatt hochladen
                </span>
                <input
                  accept="application/pdf,image/*"
                  className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm"
                  multiple
                  name="safetyDataSheets"
                  type="file"
                />
              </label>

              <fieldset>
                <legend className="text-sm font-bold text-black">
                  Bestehende Betriebsanweisung zuweisen
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {operatingInstructionTemplates.map((template) => (
                    <label
                      className="flex items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-semibold text-black"
                      key={template.id}
                    >
                      <input
                        defaultChecked={substance?.operatingInstructionTemplateIds.includes(
                          template.id,
                        )}
                        name="operatingInstructionTemplateId"
                        type="checkbox"
                        value={template.id}
                      />
                      {template.title}
                    </label>
                  ))}
                  {!operatingInstructionTemplates.length ? (
                    <p className="text-sm text-gray-600">
                      Noch keine bestehende Betriebsanweisung vorhanden.
                    </p>
                  ) : null}
                </div>
              </fieldset>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-black">
                  Betriebsanweisung hochladen
                </span>
                <input
                  accept="application/pdf,image/*"
                  className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4 text-sm"
                  multiple
                  name="operatingInstructionFiles"
                  type="file"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-black">Notizen</span>
                <textarea className={`${inputClass} min-h-20`} name="notes" />
              </label>

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-5">
                <button
                  className="rounded-xl border border-gray-400 px-5 py-3 text-sm font-bold text-black hover:bg-gray-50"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Abbrechen
                </button>
                <button
                  className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black hover:bg-yellow-300"
                  type="submit"
                >
                  {isEditing ? "Änderungen speichern" : "Gefahrstoff speichern"}
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
    <label className="space-y-2">
      <span className="text-sm font-semibold text-black">{label}</span>
      <input className={inputClass} name={name} {...props} />
    </label>
  );
}
