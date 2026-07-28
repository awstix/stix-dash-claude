"use client";

import { useRef, useState } from "react";

import { ActionIcon } from "@/components/ActionIcon";
import { SignatureFormField } from "../../_components/SignatureFormField";

const FORM_ID = "safety-template-record-form";

type Field = {
  label: string;
  name: string;
  left: number;
  top: number;
  width: number;
  type?: "date";
  value?: string;
};

type Signature = {
  label: string;
  name: string;
  left: number;
  top: number;
  width: number;
};

type Checkbox = {
  label: string;
  left: number;
  top: number;
};

type TextArea = Field & {
  height: number;
};

type PageConfig = {
  checkboxes?: Checkbox[];
  fields?: Field[];
  image: string;
  signatures?: Signature[];
  textareas?: TextArea[];
};

export function CommissionOriginalForm({
  initialCheckedSections = [],
  initialValues = {},
  sourcePdfPath,
  title,
}: {
  initialCheckedSections?: string[];
  initialValues?: Record<string, string>;
  sourcePdfPath: string;
  title: string;
}) {
  const pages = commissionPages(title, sourcePdfPath);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [signatureTarget, setSignatureTarget] = useState<string | null>(null);
  const [completedSignatures, setCompletedSignatures] = useState<
    Record<string, boolean>
  >({});
  const [signerNames, setSignerNames] = useState<Record<string, string>>({});
  const [signatureError, setSignatureError] = useState("");
  const signatures = pages.flatMap((page) => page.signatures ?? []);
  const activeSignature = signatures.find(
    (signature) => signature.name === signatureTarget,
  );

  function openSignature(name: string) {
    setSignatureTarget(name);
    setSignatureError("");
    dialogRef.current?.showModal();
  }

  function acceptSignature() {
    if (
      !signatureTarget ||
      !signerNames[signatureTarget]?.trim() ||
      !completedSignatures[signatureTarget]
    ) {
      setSignatureError(
        "Name und Unterschrift sind Pflichtfelder. Bitte beides vollständig ausfüllen.",
      );
      return;
    }
    setSignatureError("");
    dialogRef.current?.close();
  }

  function closeSignatureDialog() {
    setSignatureError("");
    setSignatureTarget(null);
    dialogRef.current?.close();
  }

  return (
    <>
      <section className="space-y-5 rounded-2xl border border-gray-300 bg-gray-200 p-2 shadow-sm">
        {pages.map((page, pageIndex) => (
          <div
            className="relative mx-auto aspect-[210/297] w-full max-w-[62rem] overflow-hidden bg-white shadow-lg"
            key={page.image}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${title}, Seite ${pageIndex + 1}`}
              className="absolute inset-0 h-full w-full select-none object-contain"
              draggable={false}
              src={page.image}
            />
            {(page.fields ?? []).map((field) => (
              <OverlayInput
                field={{ ...field, value: initialValues[field.name] ?? field.value }}
                key={`${pageIndex}-${field.name}`}
              />
            ))}
            {(page.textareas ?? []).map((field) => (
              <OverlayTextarea
                field={{ ...field, value: initialValues[field.name] ?? field.value }}
                key={`${pageIndex}-${field.name}`}
              />
            ))}
            {(page.checkboxes ?? []).map((checkbox) => (
              <label
                className="absolute z-10 flex h-[clamp(22px,2vw,26px)] w-[clamp(22px,2vw,26px)] cursor-pointer items-center justify-center"
                key={`${pageIndex}-${checkbox.label}`}
                style={{
                  left: `${checkbox.left}%`,
                  top: `${checkbox.top}%`,
                }}
                title={checkbox.label}
              >
                <input
                  aria-label={checkbox.label}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                  defaultChecked={initialCheckedSections.includes(checkbox.label)}
                  form={FORM_ID}
                  name="checkedSections"
                  type="checkbox"
                  value={checkbox.label}
                />
                <span className="pointer-events-none -translate-y-[1px] text-[clamp(20px,1.9vw,25px)] font-black leading-none text-transparent peer-checked:text-green-700">
                  ×
                </span>
              </label>
            ))}
            {(page.signatures ?? []).map((signature) => (
              <button
                className={`absolute z-10 min-h-10 rounded-lg border-2 border-dashed px-2 text-[clamp(8px,1vw,13px)] font-bold shadow-sm ${
                  completedSignatures[signature.name]
                    ? "border-green-700 bg-green-50/95 text-green-950 hover:bg-green-100"
                    : "border-blue-700 bg-blue-50/95 text-blue-950 hover:bg-blue-100"
                }`}
                key={signature.name}
                onClick={() => openSignature(signature.name)}
                style={{
                  left: `${signature.left}%`,
                  top: `${signature.top}%`,
                  width: `${signature.width}%`,
                }}
                type="button"
              >
                ✍ {signature.label}
              </button>
            ))}
          </div>
        ))}
        <p className="px-2 pb-1 text-center text-sm font-semibold text-gray-700">
          Direkt in die blau markierten Stellen tippen. Unterschriften öffnen
          sich groß und tabletgerecht.
        </p>
      </section>

      <dialog
        className="m-auto w-[min(94vw,48rem)] rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-gray-950/60"
        ref={dialogRef}
      >
        <div className="relative p-5 pt-16">
          <button
            aria-label="Unterschriftenfenster schließen"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-800 shadow-sm hover:bg-gray-100"
            onClick={closeSignatureDialog}
            title="Schließen"
            type="button"
          >
            <ActionIcon className="h-5 w-5" name="close" />
          </button>
          {Object.entries(signerNames).map(([name, value]) => (
            <input
              form={FORM_ID}
              key={name}
              name={`${name}SignerName`}
              type="hidden"
              value={value}
            />
          ))}
          {activeSignature ? (
            <label className="mb-4 block space-y-2">
              <span className="text-sm font-bold text-gray-950">
                Name der unterschreibenden Person – {activeSignature.label} *
              </span>
              <input
                className="w-full rounded-xl border-2 border-red-500 bg-white px-4 py-3 font-semibold text-gray-950 focus:border-gray-950 focus:outline-none"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setSignerNames((current) => ({
                    ...current,
                    [activeSignature.name]: value,
                  }));
                }}
                placeholder="Pflichtfeld: Vor- und Nachname"
                required
                value={signerNames[activeSignature.name] ?? ""}
              />
            </label>
          ) : null}
          {signatures.map((signature) => (
            <div
              className={signatureTarget === signature.name ? "" : "hidden"}
              key={signature.name}
            >
              <SignatureFormField
                form={FORM_ID}
                label={signature.label}
                name={signature.name}
                onChange={(value) =>
                  setCompletedSignatures((current) => ({
                    ...current,
                    [signature.name]: Boolean(value),
                  }))
                }
              />
            </div>
          ))}
          {signatureError ? (
            <p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-800">
              {signatureError}
            </p>
          ) : null}
          <button
            className="mt-4 w-full rounded-xl bg-gray-950 px-5 py-3 font-bold text-white"
            onClick={acceptSignature}
            type="button"
          >
            Name und Unterschrift übernehmen
          </button>
        </div>
      </dialog>
    </>
  );
}

function OverlayInput({ field }: { field: Field }) {
  const initialValue =
    field.value ??
    (field.type === "date" ? new Date().toISOString().slice(0, 10) : "");
  const [filled, setFilled] = useState(Boolean(initialValue));

  return (
    <input
      aria-label={field.label}
      className={`absolute z-10 min-h-7 rounded-md border-2 bg-white/95 px-2 py-1 text-[clamp(9px,1.15vw,15px)] font-semibold text-gray-950 shadow-sm outline-none focus:ring-4 ${
        filled
          ? "border-green-600 focus:ring-green-300"
          : "border-blue-600 focus:ring-blue-300"
      }`}
      defaultValue={initialValue}
      form={FORM_ID}
      name={field.name}
      onChange={(event) => setFilled(Boolean(event.currentTarget.value.trim()))}
      placeholder={field.label}
      required={[
        "authorizedPersonName",
        "commissionedPersonName",
        "instructionDate",
      ].includes(field.name)}
      style={{
        left: `${field.left}%`,
        top: `${field.top}%`,
        width: `${field.width}%`,
      }}
      type={field.type ?? "text"}
    />
  );
}

function OverlayTextarea({ field }: { field: TextArea }) {
  const [filled, setFilled] = useState(Boolean(field.value));

  return (
    <textarea
      aria-label={field.label}
      className={`absolute z-10 resize-none rounded-md border-2 bg-white/95 px-2 py-1 text-[clamp(9px,1.15vw,15px)] font-semibold text-gray-950 shadow-sm outline-none focus:ring-4 ${
        filled
          ? "border-green-600 focus:ring-green-300"
          : "border-blue-600 focus:ring-blue-300"
      }`}
      form={FORM_ID}
      defaultValue={field.value}
      name={field.name}
      onChange={(event) => setFilled(Boolean(event.currentTarget.value.trim()))}
      placeholder={field.label}
      style={{
        height: `${field.height}%`,
        left: `${field.left}%`,
        top: `${field.top}%`,
        width: `${field.width}%`,
      }}
    />
  );
}

const company: Field = {
  label: "Firma",
  left: 31.5,
  name: "companyName",
  top: 14.15,
  value: "Josef Stix GmbH & Co. KG",
  width: 55.5,
};

const dateField = (left: number, top: number, width = 18): Field => ({
  label: "Datum",
  left,
  name: "instructionDate",
  top,
  type: "date",
  width,
});

function pdfPage(sourcePdfPath: string, page: number) {
  return `${sourcePdfPath.slice(0, -4)}-page-${page}.png`;
}

function commissionPages(title: string, sourcePdfPath: string): PageConfig[] {
  if (title.includes("Bestellung SiFa") || title.includes("Betriebsarzt")) {
    const isSifa = title.includes("SiFa");
    return [{
      image: pdfPage(sourcePdfPath, 1),
      fields: [
        company,
        {
          label: "Vertreten durch",
          left: 31.5,
          name: "authorizedPersonName",
          top: 17.55,
          width: 55.5,
        },
        {
          label: isSifa ? "Sicherheitsfachkraft" : "Betriebsarzt / Betriebsärztin",
          left: 31.5,
          name: "commissionedPersonName",
          top: isSifa ? 22.9 : 22.3,
          width: 55.5,
        },
        dateField(8.2, isSifa ? 83.8 : 83.2),
      ],
      signatures: [
        {
          label: "Geschäftsleitung",
          left: 30.2,
          name: "authorizedPersonSignature",
          top: isSifa ? 82.7 : 82.1,
          width: 26.7,
        },
        {
          label: isSifa ? "Sicherheitsfachkraft" : "Betriebsarzt / Betriebsärztin",
          left: 61.5,
          name: "commissionedPersonSignature",
          top: isSifa ? 82.7 : 82.1,
          width: 27.2,
        },
      ],
    }];
  }

  if (title.includes("Unternehmerpflichten")) {
    const role = title.includes("Bauleitung") ? "Bauleiter/in" : "Polier/in";
    return [1, 2, 3].map((page) => ({
      image: pdfPage(sourcePdfPath, page),
      fields: page === 1
        ? [
            {
              label: role,
              left: 9,
              name: "commissionedPersonName",
              top: 24.5,
              width: 78,
            },
            {
              label: "Ort",
              left: 9,
              name: "commissionField.Ort",
              top: title.includes("Bauleitung") ? 72.2 : 70.5,
              width: 35,
            },
            dateField(50.5, title.includes("Bauleitung") ? 72.2 : 70.5, 35),
            {
              label: "Geschäftsleitung",
              left: 9,
              name: "authorizedPersonName",
              top: title.includes("Bauleitung") ? 76.2 : 74.5,
              width: 35,
            },
          ]
        : [],
      signatures: page === 1
        ? [
            {
              label: "Unterschrift Unternehmen",
              left: 9,
              name: "authorizedPersonSignature",
              top: title.includes("Bauleitung") ? 78 : 76.2,
              width: 35,
            },
            {
              label: `Unterschrift ${role}`,
              left: 50.5,
              name: "commissionedPersonSignature",
              top: title.includes("Bauleitung") ? 78 : 76.2,
              width: 35,
            },
          ]
        : [],
    }));
  }

  if (
    title.includes("Ersthelfer") ||
    title.includes("Brandschutzhelfer") ||
    title.includes("Sicherheitsbeauftragten")
  ) {
    const signatureTop = title.includes("Ersthelfer") ? 58 : 70;
    const pageCount = title.includes("Sicherheitsbeauftragten") ? 2 : 1;
    return Array.from({ length: pageCount }, (_, index) => ({
      image: pdfPage(sourcePdfPath, index + 1),
      fields: index === 0
        ? [
            {
              ...company,
              left: 18,
              top: 15,
              width: 69,
            },
            {
              label: "Mitarbeiter/in",
              left: 18,
              name: "commissionedPersonName",
              top: 20,
              width: 48,
            },
            {
              label: "Geburtsdatum",
              left: 68,
              name: "birthDate",
              top: 20,
              type: "date",
              width: 19,
            },
            dateField(8.5, signatureTop - 1.2),
            {
              label: "Geschäftsleitung",
              left: 29.5,
              name: "authorizedPersonName",
              top: signatureTop - 1.2,
              width: 27,
            },
          ]
        : [],
      signatures: index === 0
        ? [
            {
              label: "Unternehmen",
              left: 29.5,
              name: "authorizedPersonSignature",
              top: signatureTop + 1,
              width: 27,
            },
            {
              label: "Beauftragte Person",
              left: 61,
              name: "commissionedPersonSignature",
              top: signatureTop + 1,
              width: 27,
            },
          ]
        : [],
    }));
  }

  if (title.includes("Erdbaumaschinen")) {
    const page1Checks = positionedChecks(
      [
        "Kettenbagger bis 5 t",
        "Mobilbagger bis 5 t",
        "Radlader bis 5 t",
        "Straßenwalzen",
        "Asphaltfräsen",
      ],
      10,
      38,
      2.5,
    ).concat(
      positionedChecks(
        [
          "Kettenbagger über 5 t",
          "Mobilbagger über 5 t",
          "Radlader über 5 t",
          "Erdbauwalzen",
          "Asphaltfertiger",
        ],
        55.4,
        38,
        2.5,
      ),
      positionedChecks(
        ["Sicherheitsunterweisung durchgeführt", "Eignungstest und Fahrtraining durchgeführt"],
        10,
        54,
        3,
      ),
      positionedChecks(["Technische Einweisung durchgeführt"], 55.4, 54, 3),
    );
    const safetyChecks = positionedChecks(
      [
        "Bestimmungsgemäße Verwendung",
        "Gefahrenbereiche am Gerät",
        "Einsatz von Einweisern",
        "Wahrung der Standsicherheit",
        "Bedieneinrichtungen am Gerät",
        "Anbaugeräte",
        "Verhalten bei Störungen",
        "Einsatz der PSA",
        "Verhalten bei Stromübertritt",
      ],
      11.2,
      40.1,
      2.75,
    ).concat(
      positionedChecksAt(
        [
          "Betriebsanleitung Hersteller übergeben",
          "Befördern von Personen verboten",
          "KMS Kamera-Monitor-System",
          "Fahrbetrieb angepasst",
          "Lasttabellen / Hebebetrieb",
          "Höhenbegrenzung",
          "Not-Aus-Schalter",
          "Montage / Wartung / Instandsetzung",
        ],
        55.4,
        [40.2, 43, 45.8, 48.5, 51.3, 54.1, 56.9, 62.4],
      ),
    );
    const technicalChecks = positionedChecks(
      [
        "Technik: Bestimmungsgemäße Verwendung",
        "Technik: Fahrbetrieb",
        "Technik: Standsicherheit",
        "Technik: Bedieneinrichtungen",
        "Technik: Anbaugeräte / Schnellwechseleinrichtungen",
        "Technik: Verhalten bei Störungen",
      ],
      11.2,
      42.2,
      2.85,
    ).concat(
      positionedChecks(
        [
          "Technik: Betriebsanleitung übergeben",
          "Technik: Lasttabellen / Hebebetrieb",
          "Technik: KMS Kamera-Monitor-System",
          "Technik: Anzeigen / Warnhinweise",
          "Technik: Höhenbegrenzung",
          "Technik: Not-Aus-Schalter",
          "Technik: Montage / Wartung / Instandsetzung",
        ],
        56,
        42.2,
        2.85,
      ),
    );
    const trainingChecks = positionedChecks(
      [
        "Fahrtraining: Ein- und Ausstieg sicher",
        "Fahrtraining: Bedienelemente erreichbar",
        "Fahrtraining: Rückhalteeinrichtungen benutzt",
        "Fahrtraining: Sichtprüfung",
        "Fahrtraining: Fahrbewegungen in Ordnung",
      ],
      11.2,
      43.7,
      2.8,
    ).concat(
      positionedChecks(
        [
          "Fahrtraining: Standsicherheit beachtet",
          "Fahrtraining: Anbaugerät geprüft",
          "Fahrtraining: umsichtig gearbeitet",
          "Fahrtraining: sicher gearbeitet",
          "Fahrtraining: Maschine gesichert abgestellt",
        ],
        56,
        43.7,
        2.8,
      ),
    );
    return [
      {
        image: pdfPage(sourcePdfPath, 1),
        fields: [
          { ...company, left: 20.5, top: 13, width: 66 },
          { label: "Mitarbeiter/in", left: 20.5, name: "commissionedPersonName", top: 16.6, width: 37 },
          { label: "Geburtsdatum", left: 64, name: "birthDate", top: 16.6, type: "date", width: 22.5 },
          { label: "Wohnort", left: 20.5, name: "residence", top: 20, width: 66 },
          dateField(9, 86.2, 18),
        ],
        checkboxes: page1Checks,
        signatures: [
          { label: "Unternehmen", left: 31.5, name: "authorizedPersonSignature", top: 82.5, width: 26 },
          { label: "Maschinenführer/in", left: 62.5, name: "commissionedPersonSignature", top: 82.5, width: 27 },
        ],
      },
      earthAppendixPage(
        sourcePdfPath,
        2,
        safetyChecks,
        "Bemerkungen Sicherheitsunterweisung",
        "earthSafetyConductedSignature",
        "earthSafetyReceivedSignature",
      ),
      earthAppendixPage(
        sourcePdfPath,
        3,
        technicalChecks,
        "Bemerkungen Technische Einweisung",
        "earthTechnicalConductedSignature",
        "earthTechnicalReceivedSignature",
      ),
      earthAppendixPage(
        sourcePdfPath,
        4,
        trainingChecks,
        "Bemerkungen Fahrtraining",
        "earthTrainingConductedSignature",
        "earthTrainingReceivedSignature",
      ),
    ];
  }

  const pageCount =
    title.includes("LKW / PKW") ||
    title.includes("Einarbeitung")
      ? 4
      : 1;
  const isEinarbeitung = title.includes("Einarbeitung");
  return Array.from({ length: pageCount }, (_, index) => ({
    image: pdfPage(sourcePdfPath, index + 1),
    fields: index === 0
      ? [
          {
            ...company,
            left: 18,
            top: isEinarbeitung ? 13 : 12.5,
            width: 69,
          },
          {
            label: "Mitarbeiter/in",
            left: 18,
            name: "commissionedPersonName",
            top: isEinarbeitung ? 16.5 : 16,
            width: 48,
          },
          {
            label: "Geburtsdatum",
            left: 68,
            name: "birthDate",
            top: isEinarbeitung ? 16.5 : 16,
            type: "date",
            width: 19,
          },
          {
            label: "Wohnort",
            left: 18,
            name: "residence",
            top: isEinarbeitung ? 20 : 19.5,
            width: 69,
          },
          {
            label: isEinarbeitung ? "Geräteart / Fahrzeug" : "Fahrzeuge / Geräte",
            left: 18,
            name: "commissionScope",
            top: isEinarbeitung ? 31 : 39,
            width: 69,
          },
          {
            label: "Ort",
            left: 9,
            name: "commissionField.Ort",
            top: isEinarbeitung ? 76.3 : 86.5,
            width: 30,
          },
          dateField(43.5, isEinarbeitung ? 76.3 : 86.5, 25),
          {
            label: "Geschäftsleitung",
            left: 9,
            name: "authorizedPersonName",
            top: isEinarbeitung ? 81 : 88,
            width: 30,
          },
        ]
      : [],
    signatures: index === 0
      ? [
          {
            label: "Unternehmen",
            left: 29,
            name: "authorizedPersonSignature",
            top: isEinarbeitung ? 80 : 87,
            width: 27,
          },
          {
            label: "Beauftragte Person",
            left: 61,
            name: "commissionedPersonSignature",
            top: isEinarbeitung ? 80 : 87,
            width: 27,
          },
        ]
      : [],
  }));
}

function positionedChecks(
  labels: string[],
  left: number,
  top: number,
  step: number,
) {
  return labels.map((label, index) => ({
    label,
    left,
    top: top + index * step,
  }));
}

function positionedChecksAt(labels: string[], left: number, tops: number[]) {
  return labels.map((label, index) => ({
    label,
    left,
    top: tops[index],
  }));
}

function earthAppendixPage(
  sourcePdfPath: string,
  page: number,
  checkboxes: Checkbox[],
  notesLabel: string,
  conductedSignature: string,
  receivedSignature: string,
): PageConfig {
  const bottomTop = page === 4 ? 77.2 : 80.3;
  const locationTop = page === 4 ? bottomTop : 78;
  const signatureTop = page === 4 ? 80.2 : 80.8;
  return {
    image: pdfPage(sourcePdfPath, page),
    fields: [
      { ...company, left: 23, top: page === 2 ? 24 : 26, width: 65 },
      { label: "Mitarbeiter/in", left: 20, name: `commissionField.Mitarbeiter Anlage ${page - 1}`, top: page === 2 ? 27.7 : 29.4, width: 41 },
      { label: "Geburtsdatum", left: 70, name: `commissionField.Geburtsdatum Anlage ${page - 1}`, top: page === 2 ? 27.7 : 29.4, type: "date", width: 19 },
      { label: "Ort", left: 28, name: `commissionField.Ort Anlage ${page - 1}`, top: locationTop, width: 25.5 },
      { label: "Datum", left: 62.7, name: `commissionField.Datum Anlage ${page - 1}`, top: locationTop, type: "date", width: 30 },
    ],
    checkboxes,
    signatures: [
      { label: page === 4 ? "Fahrtraining durchgeführt" : "Unterweisung durchgeführt", left: 18.5, name: conductedSignature, top: signatureTop, width: 35 },
      { label: page === 4 ? "Fahrtraining erhalten" : "Unterweisung erhalten", left: 62.7, name: receivedSignature, top: signatureTop, width: 30 },
    ],
    textareas: [
      {
        height: page === 4 ? 15 : 10,
        label: notesLabel,
        left: 25.8,
        name: `commissionField.${notesLabel}`,
        top: page === 4 ? 59 : page === 3 ? 62.4 : 68,
        width: 66.2,
      },
    ],
  };
}
