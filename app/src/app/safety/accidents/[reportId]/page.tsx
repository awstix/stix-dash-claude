import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

import { deleteSafetyAccidentReport } from "../../actions";
import { DeleteAccidentReportButton } from "../DeleteAccidentReportButton";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl bg-gray-100 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-900">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-semibold text-gray-900">
        {value?.trim() || "—"}
      </p>
    </div>
  );
}

export default async function SafetyAccidentDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  const report = await prisma.safetyAccidentReport.findUnique({
    where: {
      id: reportId,
    },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      photos: {
        orderBy: {
          uploadedAt: "desc",
        },
      },
      notifications: {
        orderBy: {
          createdAt: "asc",
        },
      },
      project: {
        select: {
          name: true,
          projectNumber: true,
        },
      },
    },
  });

  if (!report) {
    notFound();
  }

  const employeeName = report.employee
    ? `${report.employee.lastName}, ${report.employee.firstName}`
    : report.employeeSnapshot;
  const projectName = report.project
    ? `${report.project.projectNumber} · ${report.project.name}`
    : report.projectSnapshot;

  return (
    <AppShell
      title="Unfallmeldung"
      description="Detailansicht der Unfallsofortmeldung mit Fotos und Prozessübersicht."
    >
      <div className="mb-5 flex flex-wrap gap-3">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
          href="/safety/accidents"
        >
          ← Unfallmeldungen
        </Link>
        <a
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          href={`/safety/accidents/${report.id}/pdf`}
          target="_blank"
        >
          PDF exportieren
        </a>
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
          href={`/safety/accidents?edit=${report.id}#unfallmeldung`}
        >
          Bearbeiten
        </Link>
        <DeleteAccidentReportButton
          action={deleteSafetyAccidentReport}
          reportId={report.id}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-900">
                Status
              </p>
              <p className="mt-1 rounded-full bg-yellow-100 px-3 py-1 text-sm font-bold text-yellow-950">
                {report.status === "OPEN" ? "Offen" : report.status}
              </p>
            </div>
            <div className="text-right text-sm text-gray-900">
              <p>Angelegt: {formatDateTime(report.createdAt)}</p>
              <p>Aktualisiert: {formatDateTime(report.updatedAt)}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field
              label="Unfalldatum"
              value={`${new Intl.DateTimeFormat("de-DE").format(report.accidentDate)}${
                report.accidentTime ? ` · ${report.accidentTime} Uhr` : ""
              }`}
            />
            <Field label="Projekt / Baustelle" value={projectName} />
            <Field label="Betroffener Mitarbeiter" value={employeeName} />
            <Field label="Gemeldet von" value={report.reportedByName} />
            <Field label="Unfallort" value={report.location} />
            <Field label="Abteilung / Kolonne" value={report.departmentCrew} />
            <Field
              label="Bauleitung"
              value={[
                report.constructionManagerSalutation,
                report.constructionManagerName,
              ]
                .filter(Boolean)
                .join(" ")}
            />
            <Field
              label="Telefonkontakt BL"
              value={report.constructionManagerPhone}
            />
            <Field
              label="Ansprechpartner AG"
              value={report.clientSafetyContact}
            />
            <Field label="Unfallart" value={report.accidentType} />
            <Field label="Verletzungsart" value={report.injuryType} />
            <Field label="Körperteil" value={report.bodyPart} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <Field
              label="Arzt / Durchgangsarzt"
              value={report.doctorVisit ? "Ja" : "Nein"}
            />
            <Field
              label="Arbeit unterbrochen"
              value={report.workStopped ? "Ja" : "Nein"}
            />
            <Field
              label="Notruf / Rettungsdienst"
              value={report.emergencyCalled ? "Ja" : "Nein"}
            />
          </div>

          <div className="mt-4 grid gap-4">
            <Field label="Zeugen" value={report.witnessNames} />
            <Field label="Unfallhergang" value={report.description} />
            <Field label="Schwere der Verletzung" value={report.injurySeverity} />
            <Field label="Behandlung" value={report.treatment} />
            <Field
              label="Sachschaden"
              value={[
                report.propertyDamageStatus,
                report.propertyDamageDescription,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            <Field
              label="Unfallanalyse externe SiFa"
              value={report.externalSafetyAnalysisStatus}
            />
            <Field label="Sofortmaßnahmen" value={report.immediateMeasures} />
            <Field label="Notizen" value={report.notes} />
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">Fotos</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {report.photos.length === 0 ? (
                <p className="rounded-2xl bg-gray-100 p-4 text-sm text-gray-800 sm:col-span-2">
                  Keine Fotos hinterlegt.
                </p>
              ) : (
                report.photos.map((photo) => (
                  <a
                    className="group block overflow-hidden rounded-2xl border border-gray-300 bg-gray-100"
                    href={photo.publicUrl}
                    key={photo.id}
                    target="_blank"
                  >
                    <div className="relative h-40 w-full">
                      <Image
                        alt={photo.originalFileName ?? "Unfallfoto"}
                        className="object-cover transition group-hover:scale-105"
                        fill
                        sizes="320px"
                        src={photo.publicUrl}
                      />
                    </div>
                    <div className="p-3 text-xs text-gray-800">
                      <p className="font-semibold text-gray-900">
                        {photo.originalFileName ?? photo.fileName}
                      </p>
                      <p>Hochgeladen: {formatDateTime(photo.uploadedAt)}</p>
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">
              Meldeprozess im Blick
            </h2>
            <div className="mt-4 space-y-3 text-sm text-gray-900">
              <p className="rounded-2xl bg-green-50 p-4 font-semibold text-green-950">
                1. Sofortmeldung ist erfasst.
              </p>
              <p className="rounded-2xl bg-yellow-50 p-4 font-semibold text-yellow-950">
                2. Prüfung durch Bauleitung / Verantwortlichen.
              </p>
              <p className="rounded-2xl bg-gray-100 p-4 font-semibold text-gray-800">
                3. Weitere Dokumente, Meldung und Abschluss folgen im nächsten
                Ausbauschritt.
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-950">
              Versandprotokoll
            </h2>
            <div className="mt-4 space-y-2">
              {report.notifications.length === 0 ? (
                <p className="rounded-2xl bg-gray-100 p-4 text-sm text-gray-800">
                  Kein Unfallbeauftragter hinterlegt oder noch kein
                  Versandprotokoll erzeugt.
                </p>
              ) : (
                report.notifications.map((notification) => (
                  <div
                    className="rounded-2xl border border-gray-300 p-3 text-sm"
                    key={notification.id}
                  >
                    <p className="font-bold text-gray-950">
                      {notification.recipientName || notification.recipientEmail}
                    </p>
                    <p className="text-gray-900">{notification.recipientEmail}</p>
                    <p className="text-xs font-semibold text-gray-900">
                      Status: {notification.status}
                    </p>
                    {notification.errorMessage ? (
                      <p className="mt-1 text-xs text-yellow-800">
                        {notification.errorMessage}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
