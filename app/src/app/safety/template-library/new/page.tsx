import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { getGeneralRiskAssessmentFormOptions } from "@/app/safety/risk-assessments/general/form-data";
import { prisma } from "@/lib/prisma";

import { DirectParticipantSignatures } from "../../_components/DirectParticipantSignatures";
import { createSafetyInstructionRecord } from "../../actions";
import { ProjectInstructorFields } from "../../operating-instructions/new/ProjectInstructorFields";
import { CommissionOriginalForm } from "./SifaOriginalForm";
import { FirstInductionOriginalForm } from "./FirstInductionOriginalForm";

export default async function NewLibraryTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ sourceRecordId?: string; templateId?: string }>;
}) {
  const params = await searchParams;
  const templateId = params.templateId;
  if (!templateId) notFound();
  const [template, options, sourceRecord, folders] = await Promise.all([
    prisma.safetyInstructionTemplate.findUnique({
      where: { id: templateId },
    }),
    getGeneralRiskAssessmentFormOptions(),
    params.sourceRecordId
      ? prisma.safetyInstructionRecord.findFirst({
          include: { signatures: { select: { employeeId: true, employeeName: true } } },
          where: { id: params.sourceRecordId, templateId },
        })
      : null,
    prisma.safetyTemplateFolder.findMany({
      select: { defaultValidityMonths: true, id: true, parentId: true },
    }),
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
  const isFirstInduction = template.title.includes(
    "Erstunterweisung Allgemein",
  );
  const backHref = isRiskAssessment
    ? "/safety/risk-assessments"
    : isCommission
      ? "/safety/commissions"
      : "/safety/operating-instructions";
  const initialValues = sourceRecord ? recordValues(sourceRecord.notes) : {};
  if (sourceRecord) {
    const externalPerson = sourceRecord.signatures.find(
      (signature) =>
        !signature.employeeId &&
        !signature.employeeName.startsWith("Unternehmen · ") &&
        !signature.employeeName.includes("durchgeführt") &&
        !signature.employeeName.includes("erhalten"),
    );
    const authorizedPerson = sourceRecord.signatures.find((signature) =>
      signature.employeeName.startsWith("Unternehmen · "),
    );
    if (externalPerson) {
      initialValues.commissionedPersonName = externalPerson.employeeName;
    }
    if (authorizedPerson) {
      initialValues.authorizedPersonName = authorizedPerson.employeeName.replace(
        /^Unternehmen · /,
        "",
      );
    }
  }
  const initialCheckedSections = sourceRecord
    ? parseSections(sourceRecord.checkedSectionsJson)
    : [];
  const initialEmployeeIds =
    sourceRecord?.signatures
      .map((signature) => signature.employeeId)
      .filter((id): id is string => Boolean(id)) ?? [];
  const validityMonths =
    sourceRecord?.validityMonths ??
    inheritedValidityMonths(template.folderId, folders);

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
        {isFirstInduction ? (
          <FirstInductionOriginalForm />
        ) : isCommission ? (
          <CommissionOriginalForm
            initialCheckedSections={initialCheckedSections}
            initialValues={initialValues}
            sourcePdfPath={sourcePdfPath}
            title={template.title}
          />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-gray-300 bg-gray-200 xl:aspect-[210/297]">
            <iframe
              className="h-[60dvh] min-h-[26rem] w-full bg-white xl:h-full xl:min-h-0"
              src={`${sourcePdfPath}#page=1&view=Fit&zoom=page-fit&navpanes=0`}
              title={`Original: ${template.title}`}
            />
          </section>
        )}
        <form
          action={createSafetyInstructionRecord}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          id="safety-template-record-form"
        >
          <input name="templateId" type="hidden" value={template.id} />
          {sourceRecord ? (
            <input name="previousVersionId" type="hidden" value={sourceRecord.id} />
          ) : null}
          <input name="redirectTo" type="hidden" value={backHref} />
          <ProjectInstructorFields
            initialInstructor={sourceRecord?.instructedByName ?? ""}
            initialProjectId={sourceRecord?.projectId ?? ""}
            managerOptions={options.managerOptions}
            projects={options.projects}
          />
          <label className="block space-y-2">
            <span className="text-sm font-bold text-gray-950">
              Gültigkeit in Monaten
            </span>
            <input
              className={inputClass}
              defaultValue={validityMonths}
              min="1"
              name="validityMonths"
              required
              type="number"
            />
            <span className="block text-xs text-gray-600">
              Aus dem Ordner vorausgewählt und für diesen Nachweis individuell
              änderbar.
            </span>
          </label>
          {!isCommission ? <label className="block space-y-2">
            <span className="text-sm font-bold text-gray-950">Datum</span>
            <input
              className={inputClass}
              defaultValue={new Date().toISOString().slice(0, 10)}
              name="instructionDate"
              required
              type="date"
            />
          </label> : null}
          {!isFirstInduction ? <div>
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
          </div> : null}
          <DirectParticipantSignatures
            employees={options.employees}
            initialSelectedIds={initialEmployeeIds}
          />
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

function recordValues(notes: string | null) {
  const values: Record<string, string> = {};
  const standardNames: Record<string, string> = {
    Firma: "companyName",
    Geburtsdatum: "birthDate",
    Wohnort: "residence",
    "Geräte / Fahrzeuge / Geltungsbereich": "commissionScope",
    "Befristung / Gültigkeit": "validity",
  };
  for (const line of notes?.split("\n") ?? []) {
    const separator = line.indexOf(": ");
    if (separator < 1) continue;
    const label = line.slice(0, separator);
    const value = line.slice(separator + 2);
    values[standardNames[label] ?? `commissionField.${label}`] = value;
  }
  return values;
}

function inheritedValidityMonths(
  folderId: string | null,
  folders: Array<{
    defaultValidityMonths: number | null;
    id: string;
    parentId: string | null;
  }>,
) {
  let currentId = folderId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = folders.find((entry) => entry.id === currentId);
    if (!folder) break;
    if (folder.defaultValidityMonths) return folder.defaultValidityMonths;
    currentId = folder.parentId;
  }
  return 12;
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
