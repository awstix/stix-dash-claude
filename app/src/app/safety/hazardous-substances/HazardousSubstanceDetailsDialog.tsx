"use client";

import { useState } from "react";

import { ActionIcon } from "@/components/ActionIcon";
import { HAZARD_SYMBOLS } from "@/lib/hazard-register-constants";

import { deleteSafetyDataSheet } from "../actions";
import type { EditableHazardousSubstance } from "./HazardousSubstanceModal";

export function HazardousSubstanceDetailsDialog({
  operatingInstructionTemplates = [],
  substance,
}: {
  operatingInstructionTemplates?: Array<{ id: string; title: string }>;
  substance: EditableHazardousSubstance;
}) {
  const [open, setOpen] = useState(false);
  const [deleteDocumentId, setDeleteDocumentId] = useState<string | null>(null);
  const deleteDocument = substance.dataSheets.find(
    (document) => document.id === deleteDocumentId,
  );

  return (
    <>
      <button
        aria-label={`${substance.name} öffnen`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        onClick={() => setOpen(true)}
        title="Öffnen"
        type="button"
      >
        <ActionIcon className="h-4 w-4" name="open" />
      </button>
      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] overflow-y-auto bg-gray-950/60 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div
            className="mx-auto my-8 max-w-3xl rounded-3xl bg-white p-6 text-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-600">
                  Laufende Nummer {substance.sequentialNumber ?? "—"}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-black">
                  {substance.name}
                </h2>
                <p className="mt-1 text-sm text-black">
                  {substance.manufacturer ?? "Kein Hersteller eingetragen"}
                </p>
              </div>
              <button
                aria-label="Popup schließen"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 text-xl font-bold text-black"
                onClick={() => setOpen(false)}
                type="button"
              >
                <ActionIcon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {HAZARD_SYMBOLS.filter(([code]) =>
                substance.hazardSymbols.includes(code),
              ).map(([code, label, imagePath]) => (
                <div
                  className="rounded-xl border border-gray-300 bg-gray-50 p-2 text-center"
                  key={code}
                  title={label}
                >
                  <img
                    alt={`${code}: ${label}`}
                    className="h-14 w-14 object-contain"
                    height={56}
                    src={imagePath}
                    width={56}
                  />
                  <span className="mt-1 block text-xs font-bold text-black">
                    {code}
                  </span>
                </div>
              ))}
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <Detail label="Stoffkategorie" value={substance.category} />
              <Detail label="Art" value={substance.substanceType} />
              <Detail label="Einheit / Gebinde" value={substance.packageUnit} />
              <Detail label="Menge" value={substance.quantity} />
              <Detail label="Arbeitsbereiche" value={substance.usageArea} />
              <Detail
                label="Kataster-Reiter"
                value={
                  substance.registerSection === "WITHOUT_BA"
                    ? "Gefahrstoffe ohne BA"
                    : "Gefährliche Gefahrstoffe"
                }
              />
              <Detail
                label="Sicherheitsdatenblatt"
                value={substance.safetyDataSheetPresent ? "Vorhanden" : "Nicht vorhanden"}
              />
              <Detail
                label="Betriebsanweisung"
                value={
                  substance.operatingInstructionPresent
                    ? "Vorhanden"
                    : "Nicht vorhanden"
                }
              />
            </dl>

            <section className="mt-6 border-t border-gray-200 pt-5">
              <h3 className="text-lg font-bold text-black">
                Dokumente
              </h3>
              {substance.dataSheets.length ? (
                <div className="mt-3 space-y-2">
                  {substance.dataSheets.map((document) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-300 bg-gray-50 p-3"
                      key={document.id}
                    >
                      <div>
                        <span className="mb-1 inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-black">
                          {document.documentType === "BA"
                            ? "Betriebsanweisung"
                            : "Sicherheitsdatenblatt"}
                        </span>
                        <p className="font-semibold text-black">
                          {document.displayName}
                        </p>
                        <p className="text-xs text-gray-600">
                          {document.versionDate
                            ? `Stand ${new Date(document.versionDate).toLocaleDateString("de-DE")}`
                            : `Hochgeladen ${new Date(document.uploadedAt).toLocaleDateString("de-DE")}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-black hover:bg-gray-100"
                          href={document.publicUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Öffnen
                        </a>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteDocumentId(document.id)}
                          title="Datenblatt löschen"
                          type="button"
                        >
                          <ActionIcon className="h-4 w-4" name="delete" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-600">
                  Keine Datei zu diesem Gefahrstoff hochgeladen.
                </p>
              )}
              {substance.operatingInstructionTemplateIds.length ? (
                <div className="mt-4">
                  <p className="text-sm font-bold text-black">
                    Zugewiesene bestehende Betriebsanweisungen
                  </p>
                  <ul className="mt-2 space-y-2">
                    {substance.operatingInstructionTemplateIds.map((id) => (
                      <li
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-black"
                        key={id}
                      >
                        {operatingInstructionTemplates.find(
                          (template) => template.id === id,
                        )?.title ?? id}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      ) : null}
      {deleteDocument ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal-nested)] flex items-center justify-center bg-gray-950/70 p-4"
          onClick={() => setDeleteDocumentId(null)}
          role="dialog"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 text-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-black">
              Sicherheitsdatenblatt löschen?
            </h2>
            <p className="mt-3 text-sm font-semibold text-black">
              {deleteDocument.displayName}
            </p>
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-black">
              Die Datei wird endgültig gelöscht und kann anschließend nicht
              mehr geöffnet werden.
            </p>
            <form action={deleteSafetyDataSheet} className="mt-6">
              <input name="id" type="hidden" value={deleteDocument.id} />
              <div className="flex justify-end gap-3">
                <button
                  className="rounded-xl border border-gray-400 px-4 py-2.5 text-sm font-bold text-black"
                  onClick={() => setDeleteDocumentId(null)}
                  type="button"
                >
                  Abbrechen
                </button>
                <button
                  className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white"
                  type="submit"
                >
                  Endgültig löschen
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: number | string | null;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-gray-600">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-black">{value ?? "—"}</dd>
    </div>
  );
}
