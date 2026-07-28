"use client";

import { useRef, useState } from "react";

import { ActionIcon } from "@/components/ActionIcon";
import { SignatureFormField } from "../../_components/SignatureFormField";

const FORM_ID = "safety-template-record-form";
const BASE =
  "/templates/operating-instructions/A-70-20/A-70-20-001 - Erstunterweisung Allgemein - 2024-08-29 Rev00-page";

export function FirstInductionOriginalForm() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [hasPresenterSignature, setHasPresenterSignature] = useState(false);

  return (
    <>
      <section className="space-y-5 rounded-2xl border border-gray-300 bg-gray-200 p-2 shadow-sm">
        {Array.from({ length: 13 }, (_, index) => index + 1).map((page) => (
          <div
            className="relative mx-auto aspect-[210/297] w-full max-w-[62rem] overflow-hidden bg-white shadow-lg"
            key={page}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`Erstunterweisung Allgemein, Seite ${page}`}
              className="absolute inset-0 h-full w-full select-none object-contain"
              draggable={false}
              src={`${BASE}-${String(page).padStart(2, "0")}.png`}
            />
            {page === 12 ? (
              <>
                <textarea
                  aria-label="Sonstige Themen"
                  className={`${overlayInput} resize-none`}
                  form={FORM_ID}
                  name="commissionField.Sonstige Themen"
                  placeholder="Sonstige Themen"
                  style={{ height: "4.8%", left: "31.5%", top: "25.2%", width: "65%" }}
                />
                <label className={checkLabel} style={{ left: "13.8%", top: "31.8%" }}>
                  <input className="peer absolute inset-0 opacity-0" defaultChecked form={FORM_ID} name="checkedSections" type="checkbox" value="Gesamtes Dokument" />
                  <span className={checkMark}>×</span>
                </label>
                <label className={checkLabel} style={{ left: "13.8%", top: "34.4%" }}>
                  <input className="peer absolute inset-0 opacity-0" form={FORM_ID} name="checkedSections" type="checkbox" value="Einzelne Kapitel" />
                  <span className={checkMark}>×</span>
                </label>
                <textarea
                  aria-label="Einzelne Kapitel"
                  className={`${overlayInput} resize-none`}
                  form={FORM_ID}
                  name="commissionField.Kapitel"
                  placeholder="Kapitel auflisten"
                  style={{ height: "4.7%", left: "21%", top: "36.7%", width: "75.5%" }}
                />
                <input
                  aria-label="Ort"
                  className={overlayInput}
                  form={FORM_ID}
                  name="commissionField.Ort"
                  placeholder="Ort"
                  style={{ left: "31.5%", top: "42.1%", width: "26%" }}
                />
                <button
                  className={`absolute z-10 min-h-10 rounded-lg border-2 border-dashed px-2 text-[clamp(8px,1vw,13px)] font-bold shadow-sm ${
                    hasPresenterSignature
                      ? "border-green-700 bg-green-50/95 text-green-950"
                      : "border-blue-700 bg-blue-50/95 text-blue-950"
                  }`}
                  onClick={() => dialogRef.current?.showModal()}
                  style={{ left: "75.5%", top: "45.7%", width: "21%" }}
                  type="button"
                >
                  ✍ Vortragende Person
                </button>
                <p className="absolute left-[13%] top-[57.8%] z-10 w-[83%] rounded-lg border border-blue-300 bg-blue-50/95 px-3 py-2 text-center text-[clamp(8px,1vw,13px)] font-bold text-blue-950">
                  Teilnehmende Mitarbeiter rechts auswählen und direkt
                  unterschreiben lassen. Die Tabelle wird im PDF automatisch
                  gefüllt.
                </p>
              </>
            ) : null}
          </div>
        ))}
      </section>

      <dialog
        className="m-auto w-[min(94vw,48rem)] rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-gray-950/60"
        ref={dialogRef}
      >
        <div className="relative p-5 pt-16">
          <button
            aria-label="Unterschriftenfenster schließen"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-800"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            <ActionIcon className="h-5 w-5" name="close" />
          </button>
          <SignatureFormField
            form={FORM_ID}
            label="Unterschrift der vortragenden Person"
            name="presenterSignatureDataUrl"
            onChange={(value) => setHasPresenterSignature(Boolean(value))}
          />
          <button
            className="mt-4 w-full rounded-xl bg-gray-950 px-5 py-3 font-bold text-white"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            Unterschrift übernehmen
          </button>
        </div>
      </dialog>
    </>
  );
}

const overlayInput =
  "absolute z-10 min-h-8 rounded-md border-2 border-blue-600 bg-white/95 px-2 py-1 text-[clamp(9px,1.15vw,15px)] font-semibold text-gray-950 shadow-sm outline-none focus:border-green-600 focus:ring-4 focus:ring-green-200";
const checkLabel =
  "absolute z-10 flex h-[clamp(22px,2vw,27px)] w-[clamp(22px,2vw,27px)] cursor-pointer items-center justify-center";
const checkMark =
  "pointer-events-none text-[clamp(20px,2vw,27px)] font-black leading-none text-transparent peer-checked:text-green-700";
