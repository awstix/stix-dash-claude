import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { getGeneralRiskAssessmentFormOptions } from "@/app/safety/risk-assessments/general/form-data";
import { prisma } from "@/lib/prisma";

import { DirectParticipantSignatures } from "../../_components/DirectParticipantSignatures";
import { SignatureFormField } from "../../_components/SignatureFormField";
import { createSafetyInstructionRecord } from "../../actions";
import { ProjectInstructorFields } from "../../operating-instructions/new/ProjectInstructorFields";

export default async function NewLibraryTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const templateId = (await searchParams).templateId;
  if (!templateId) notFound();
  const [template, options] = await Promise.all([
    prisma.safetyInstructionTemplate.findUnique({
      where: { id: templateId },
    }),
    getGeneralRiskAssessmentFormOptions(),
  ]);
  if (
    !template ||
    !["COMMISSION", "OPERATING_INSTRUCTION", "RISK_ASSESSMENT"].includes(
      template.type,
    )
  ) {
    notFound();
  }
  const sourcePdfPath =
    template.sourcePdfPath ??
    template.content
      ?.split("\n")
      .find((line) => line.startsWith("SOURCE_PDF:"))
      ?.slice("SOURCE_PDF:".length);
  if (!sourcePdfPath) notFound();
  const sections = parseSections(template.sectionsJson);
  const isRiskAssessment = template.type === "RISK_ASSESSMENT";
  const isCommission = template.type === "COMMISSION";
  const backHref = isRiskAssessment
    ? "/safety/risk-assessments"
    : isCommission
      ? "/safety/commissions"
      : "/safety/operating-instructions";

  return (
    <AppShell
      description="Original prüfen, Projekt und Teilnehmer zuordnen und digital unterschreiben lassen."
      title={template.title}
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700"
          href={backHref}
        >
          ← Zur Vorlagenbibliothek
        </Link>
        <a
          className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white"
          href={sourcePdfPath}
          target="_blank"
        >
          Original separat öffnen
        </a>
        {template.sourceDocxPath ? (
          <a
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700"
            href={template.sourceDocxPath}
          >
            Word herunterladen
          </a>
        ) : null}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.75fr)]">
        <section className="overflow-hidden rounded-2xl border border-gray-300 bg-gray-200 xl:aspect-[210/297]">
          <iframe
            className="h-[60dvh] min-h-[26rem] w-full bg-white xl:h-full xl:min-h-0"
            src={`${sourcePdfPath}#page=1&view=Fit&zoom=page-fit&navpanes=0`}
            title={`Original: ${template.title}`}
          />
        </section>
        <form
          action={createSafetyInstructionRecord}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <input name="templateId" type="hidden" value={template.id} />
          <input name="redirectTo" type="hidden" value={backHref} />
          <ProjectInstructorFields
            managerOptions={options.managerOptions}
            projects={options.projects}
          />
          <label className="block space-y-2">
            <span className="text-sm font-bold text-gray-950">Datum</span>
            <input
              className={inputClass}
              defaultValue={new Date().toISOString().slice(0, 10)}
              name="instructionDate"
              required
              type="date"
            />
          </label>
          <div>
            <p className="text-sm font-bold text-gray-950">
              Behandelte Inhalte
            </p>
            <div className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3">
              {sections.map((section) => (
                <label
                  className="flex items-start gap-2 text-sm font-semibold text-gray-800"
                  key={section}
                >
                  <input
                    className="mt-0.5 h-5 w-5 accent-gray-950"
                    defaultChecked
                    name="checkedSections"
                    type="checkbox"
                    value={section}
                  />
                  {section}
                </label>
              ))}
            </div>
          </div>
          {isCommission ? (
            <div className="space-y-4 rounded-2xl border border-gray-300 bg-white p-4">
              <h3 className="font-bold text-gray-950">
                Angaben zur beauftragten Person
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-bold text-gray-800">
                    Geburtsdatum
                  </span>
                  <input className={inputClass} name="birthDate" type="date" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-bold text-gray-800">
                    Wohnort
                  </span>
                  <input className={inputClass} name="residence" />
                </label>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-bold text-gray-800">
                  Geräte, Fahrzeuge oder Geltungsbereich
                </span>
                <textarea
                  className={`${inputClass} min-h-20`}
                  name="commissionScope"
                  placeholder="Kennzeichen, Inventarnummern, Maschinentypen, Betriebsteil oder Verantwortungsbereich"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-bold text-gray-800">
                  Befristung / Gültigkeit
                </span>
                <input
                  className={inputClass}
                  name="validity"
                  placeholder="z. B. unbefristet oder bis 31.12.2027"
                />
              </label>
              {commissionOptions(template.title).length ? (
                <div>
                  <p className="text-sm font-bold text-gray-950">
                    Auswahl gemäß Originalvorlage
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {commissionOptions(template.title).map((option) => (
                      <label
                        className="flex min-h-12 items-center gap-3 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900"
                        key={option}
                      >
                        <input
                          className="h-6 w-6 shrink-0 accent-gray-950"
                          name="checkedSections"
                          type="checkbox"
                          value={option}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <DirectParticipantSignatures employees={options.employees} />
          {isCommission ? (
            <div className="space-y-4 rounded-2xl border border-gray-300 bg-gray-50 p-4">
              <div>
                <h3 className="font-bold text-gray-950">
                  Externe beauftragte Person
                </h3>
                <p className="mt-1 text-xs font-medium text-gray-600">
                  Nur verwenden, wenn die Person nicht in der Mitarbeiterliste
                  geführt wird, zum Beispiel Betriebsarzt oder externe SiFa.
                </p>
              </div>
              <input
                className={inputClass}
                name="commissionedPersonName"
                placeholder="Name und Funktion (optional)"
              />
              <SignatureFormField
                label="Unterschrift externe beauftragte Person"
                name="commissionedPersonSignature"
              />
              <input
                className={inputClass}
                name="authorizedPersonName"
                placeholder="Name der bevollmächtigten Person / Geschäftsleitung"
                required
              />
              <SignatureFormField
                label="Unterschrift Unternehmen / Geschäftsleitung"
                name="authorizedPersonSignature"
              />
            </div>
          ) : null}
          <textarea
            className={`${inputClass} min-h-20`}
            name="notes"
            placeholder={
              isCommission
                ? "Geräte, Fahrzeuge, Geltungsbereich, Befristung und weitere Angaben"
                : "Notizen (optional)"
            }
          />
          <button
            className="w-full rounded-xl bg-gray-950 px-5 py-3 font-bold text-white"
            type="submit"
          >
            {isRiskAssessment
              ? "Gefährdungsbeurteilung speichern und abschließen"
              : isCommission
                ? "Beauftragung speichern und abschließen"
                : "Unterweisung speichern und abschließen"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}

function parseSections(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950";

function commissionOptions(title: string) {
  if (title.includes("Erdbaumaschinen")) {
    return [
      "Kettenbagger bis 5 t",
      "Kettenbagger über 5 t",
      "Mobilbagger bis 5 t",
      "Mobilbagger über 5 t",
      "Radlader bis 5 t",
      "Radlader über 5 t",
      "Straßenwalzen",
      "Erdbauwalzen",
      "Asphaltfräsen",
      "Asphaltfertiger",
      "Sicherheitsunterweisung durchgeführt",
      "Technische Einweisung durchgeführt",
      "Eignungstest und Fahrtraining durchgeführt",
    ];
  }
  if (title.includes("Einarbeitung LKW")) {
    return [
      "Sicherheitsunterweisung",
      "Technische Einweisung",
      "Eignungstest und Fahrtraining",
      "Gefahrenbereiche am Fahrzeug",
      "Bedieneinrichtungen und Anbaugeräte",
      "Tägliche Einsatzprüfung",
      "Verhalten bei Störungen und Unfällen",
      "Transportstellung und Verladevorbereitung",
    ];
  }
  if (title.includes("Gabelstapler")) {
    return [
      "Fahrausweis und Zertifikat vorgelegt",
      "Arbeitsmedizinische Eignung geprüft",
      "Betriebliche Einweisung durchgeführt",
      "Beauftragte Fahrzeuge festgelegt",
    ];
  }
  if (title.includes("LKW / PKW")) {
    return [
      "Fahrerlaubnis geprüft",
      "Fahrzeugbezogene Einweisung durchgeführt",
      "PKW",
      "LKW",
      "Anhänger",
      "Anbaugeräte",
    ];
  }
  return [];
}
