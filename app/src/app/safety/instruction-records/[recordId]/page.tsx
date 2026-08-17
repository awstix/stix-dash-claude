import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

import { SafetySignaturePad } from "../../_components/SafetySignaturePad";
import {
  addSafetyInstructionParticipants,
  saveSafetyInstructionSignature,
} from "../../actions";

function parseSections(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map((entry) => String(entry)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function SafetyInstructionRecordPage({
  params,
}: {
  params: Promise<{ recordId: string }>;
}) {
  const { recordId } = await params;
  const [record, employees] = await Promise.all([
    prisma.safetyInstructionRecord.findUnique({
      where: {
        id: recordId,
      },
      include: {
      project: {
        select: {
          name: true,
          projectNumber: true,
        },
      },
      signatures: {
        include: {
          employee: {
            select: {
              firstName: true,
              id: true,
              lastName: true,
              photoUrl: true,
            },
          },
        },
        orderBy: {
          employeeName: "asc",
        },
      },
      template: true,
      },
    }),
    prisma.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        firstName: true,
        id: true,
        lastName: true,
        statusValue: true,
      },
    }),
  ]);

  if (!record) {
    notFound();
  }

  const checkedSections = parseSections(record.checkedSectionsJson);
  const sourcePdfPath =
    record.template.sourcePdfPath ??
    record.template.content
      ?.split("\n")
      .find((line) => line.startsWith("SOURCE_PDF:"))
      ?.slice("SOURCE_PDF:".length) ?? null;
  const projectName = record.project
    ? `${record.project.projectNumber} · ${record.project.name}`
    : record.projectSnapshot ?? "Ohne Projekt";
  const backHref =
    record.template.type === "RISK_ASSESSMENT"
      ? "/safety/risk-assessments"
      : record.template.type === "COMMISSION"
        ? "/safety/commissions"
      : "/safety/operating-instructions";

  return (
    <AppShell
      title={record.template.title}
      description={`${record.template.type === "RISK_ASSESSMENT" ? "Gefährdungsbeurteilung" : record.template.type === "COMMISSION" ? "Beauftragung" : "Betriebsunterweisung"} · ${formatDate(record.instructionDate)} · ${projectName}`}
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          href={backHref}
        >
          ← Zur Übersicht
        </Link>
        {sourcePdfPath ? (
          <a
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            href={sourcePdfPath}
            target="_blank"
          >
            Original öffnen
          </a>
        ) : null}
        {["OPERATING_INSTRUCTION", "RISK_ASSESSMENT"].includes(
          record.template.type,
        ) ? (
          <a
            className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white"
            href={`/safety/instruction-records/${record.id}/pdf`}
            target="_blank"
          >
            Unterweisungsnachweis PDF
          </a>
        ) : null}
        {record.template.type === "COMMISSION" ? (
          <a
            className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white"
            href={`/safety/instruction-records/${record.id}/pdf`}
            target="_blank"
          >
            Ausgefüllte Beauftragung als PDF
          </a>
        ) : null}
      </div>

      {sourcePdfPath ? (
        <section className="mb-6 overflow-hidden rounded-3xl border border-gray-300 bg-gray-200 shadow-sm">
          <iframe
            className="h-[70vh] w-full bg-white"
            src={`${
              record.template.type === "COMMISSION"
                ? `/safety/instruction-records/${record.id}/pdf`
                : sourcePdfPath
            }#page=1&view=Fit&zoom=page-fit&navpanes=0`}
            title={`Original: ${record.template.title}`}
          />
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Unterweisungsdaten
              </p>
              <h2 className="mt-1 text-2xl font-bold text-gray-950">
                {record.template.title}
              </h2>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700">
              {record.status === "SIGNED" ? "Unterschrieben" : "Offen"}
            </span>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Datum
              </dt>
              <dd className="mt-1 font-semibold text-gray-950">
                {formatDate(record.instructionDate)}
              </dd>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Projekt
              </dt>
              <dd className="mt-1 font-semibold text-gray-950">{projectName}</dd>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Unterwiesen durch
              </dt>
              <dd className="mt-1 font-semibold text-gray-950">
                {record.instructedByName || "—"}
              </dd>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Angelegt
              </dt>
              <dd className="mt-1 font-semibold text-gray-950">
                {formatDateTime(record.createdAt)}
              </dd>
            </div>
          </dl>

          {record.template.description ? (
            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Beschreibung
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                {record.template.description}
              </p>
            </div>
          ) : null}

          {record.template.content &&
          !record.template.content.startsWith("SOURCE_PDF:") ? (
            <div className="mt-4 rounded-2xl bg-gray-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Inhalt
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                {record.template.content}
              </p>
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl bg-yellow-50 p-4">
            <p className="text-sm font-bold text-yellow-950">
              Unterwiesene Bereiche
            </p>
            {checkedSections.length === 0 ? (
              <p className="mt-2 text-sm text-yellow-900">
                Keine Bereiche ausgewählt.
              </p>
            ) : (
              <ul className="mt-3 grid gap-2 text-sm font-semibold text-yellow-950">
                {checkedSections.map((section) => (
                  <li key={section}>☑ {section}</li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950">
            Teilnehmer unterschreiben
          </h2>
          <div className="mt-5 grid gap-4">
            {record.signatures.map((signature) => (
              <div
                className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                key={signature.id}
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-950">
                      {signature.employeeName}
                    </p>
                    {signature.signedAt ? (
                      <p className="text-xs font-semibold text-green-700">
                        Unterschrieben am {formatDateTime(signature.signedAt)}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-yellow-700">
                        Unterschrift offen
                      </p>
                    )}
                  </div>
                  {signature.employee ? (
                    <Link
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                      href={`/employees/certificates/${signature.employee.id}`}
                    >
                      Mitarbeiterakte
                    </Link>
                  ) : null}
                </div>

                <SafetySignaturePad
                  action={saveSafetyInstructionSignature.bind(
                    null,
                    record.id,
                    signature.id,
                  )}
                  defaultValue={signature.signatureDataUrl}
                />
              </div>
            ))}
          </div>
          <details className="mt-5 rounded-2xl border border-gray-300 bg-white">
            <summary className="cursor-pointer px-4 py-3 font-bold text-gray-950">
              Weitere Mitarbeiter nachtragen
            </summary>
            <form
              action={addSafetyInstructionParticipants.bind(null, record.id)}
              className="border-t border-gray-200 p-4"
            >
              <p className="mb-3 text-sm text-gray-600">
                Nachgetragene Mitarbeiter unterschreiben separat. Das
                tatsächliche Unterschriftsdatum wird am Nachweis gespeichert.
              </p>
              <div className="grid max-h-60 gap-2 overflow-auto sm:grid-cols-2">
                {employees
                  .filter(
                    (employee) =>
                      employee.statusValue !== "ausgeschieden" &&
                      !record.signatures.some(
                        (signature) => signature.employeeId === employee.id,
                      ),
                  )
                  .map((employee) => (
                    <label
                      className="flex items-center gap-2 text-sm font-semibold text-gray-800"
                      key={employee.id}
                    >
                      <input
                        className="h-5 w-5 accent-gray-950"
                        name="employeeIds"
                        type="checkbox"
                        value={employee.id}
                      />
                      {employee.lastName}, {employee.firstName}
                    </label>
                  ))}
              </div>
              <button
                className="mt-4 rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white"
                type="submit"
              >
                Ausgewählte nachtragen
              </button>
            </form>
          </details>
        </section>
      </div>
    </AppShell>
  );
}
