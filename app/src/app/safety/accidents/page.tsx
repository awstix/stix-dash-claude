import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

import { SignatureFormField } from "../_components/SignatureFormField";
import {
  createSafetyAccidentOfficer,
  createSafetyAccidentReport,
  deleteSafetyAccidentReport,
  replaceSafetyPdfTemplate,
  updateSafetyAccidentReport,
} from "../actions";
import { DeleteAccidentReportButton } from "./DeleteAccidentReportButton";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function dateInputValue(date?: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function fieldValue(value?: string | null) {
  return value ?? "";
}

function ChoiceGroup({
  name,
  noLabel = "Nein",
  value,
  yesLabel = "Ja",
}: {
  name: string;
  noLabel?: string;
  value?: string | null;
  yesLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-4 text-base font-bold text-gray-950">
      <label className="inline-flex items-center gap-2">
        <input
          className="h-4 w-4 accent-yellow-500"
          defaultChecked={value === "YES"}
          name={name}
          type="radio"
          value="YES"
        />
        {yesLabel}
      </label>
      <label className="inline-flex items-center gap-2">
        <input
          className="h-4 w-4 accent-yellow-500"
          defaultChecked={value === "NO"}
          name={name}
          type="radio"
          value="NO"
        />
        {noLabel}
      </label>
    </div>
  );
}

export default async function SafetyAccidentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const editReportId = typeof params.edit === "string" ? params.edit : null;
  const preselectedProjectId =
    !editReportId && typeof params.projectId === "string" ? params.projectId : "";

  const [projects, employees, reports, officers, editReport] = await Promise.all([
    prisma.project.findMany({
      orderBy: [
        {
          projectNumber: "desc",
        },
      ],
      select: {
        id: true,
        name: true,
        projectNumber: true,
      },
    }),
    prisma.employee.findMany({
      orderBy: [
        {
          lastName: "asc",
        },
        {
          firstName: "asc",
        },
      ],
      select: {
        firstName: true,
        id: true,
        lastName: true,
        statusLabel: true,
      },
    }),
    prisma.safetyAccidentReport.findMany({
      include: {
        _count: {
          select: {
            photos: true,
          },
        },
        employee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        project: {
          select: {
            name: true,
            projectNumber: true,
          },
        },
      },
      orderBy: {
        accidentDate: "desc",
      },
      take: 80,
    }),
    prisma.safetyAccidentOfficer.findMany({
      orderBy: [
        {
          isActive: "desc",
        },
        {
          name: "asc",
        },
      ],
    }),
    editReportId
      ? prisma.safetyAccidentReport.findUnique({
          where: {
            id: editReportId,
          },
        })
      : null,
  ]);
  const accidentFormAction = editReport
    ? updateSafetyAccidentReport.bind(null, editReport.id)
    : createSafetyAccidentReport;

  return (
    <AppShell
      title="Unfallmeldungen"
      description="Sofortmeldung mit Mitarbeiter, Projekt, Ablauf, Maßnahmen und Fotos. Foto-Upload öffnet auf dem Handy direkt Kamera oder Galerie."
    >
      <div className="space-y-6">
        <section className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200">
            Unfallmeldeprozess
          </h2>
          <p className="mt-4 rounded-2xl bg-yellow-50 p-4 text-sm font-semibold text-yellow-950">
            Hier kann der aktuelle Unfallmeldeprozess eingesehen werden. Die PDF
            beschreibt, was nach einem Unfall zu tun ist, wer informiert werden
            muss und welche Fristen gelten.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
              href="/templates/unfallmeldeprozess.pdf"
              target="_blank"
            >
              Unfallmeldeprozess öffnen
            </a>
            <a
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-950 hover:bg-gray-100"
              href="/templates/unfallsofortmeldung.pdf"
              target="_blank"
            >
              Unfallsofortmeldung-Vorlage öffnen
            </a>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <form
              action={replaceSafetyPdfTemplate}
              className="rounded-2xl border border-gray-300 bg-gray-100 p-4"
            >
              <input name="templateKey" type="hidden" value="ACCIDENT_PROCESS" />
              <p className="text-base font-bold text-gray-950">
                Unfallmeldeprozess austauschen
              </p>
              <input
                accept="application/pdf"
                className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-950 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                name="templateFile"
                required
                type="file"
              />
              <button
                className="mt-3 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-yellow-300"
                type="submit"
              >
                Prozess-PDF speichern
              </button>
            </form>

            <form
              action={replaceSafetyPdfTemplate}
              className="rounded-2xl border border-gray-300 bg-gray-100 p-4"
            >
              <input name="templateKey" type="hidden" value="ACCIDENT_REPORT" />
              <p className="text-base font-bold text-gray-950">
                Unfallsofortmeldung-Vorlage austauschen
              </p>
              <input
                accept="application/pdf"
                className="mt-3 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-950 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                name="templateFile"
                required
                type="file"
              />
              <button
                className="mt-3 rounded-xl bg-yellow-400 px-4 py-2 text-sm font-bold text-gray-950 hover:bg-yellow-300"
                type="submit"
              >
                Formular-PDF speichern
              </button>
            </form>
          </div>
        </section>

        <section
          className="rounded-3xl border border-gray-300 bg-white p-6 shadow-sm"
          id="unfallmeldung"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200">Unfallmeldung</h2>
              <p className="mt-1 text-sm text-gray-800">
                {editReport
                  ? "Bestehende Unfallmeldung bearbeiten. Neue Fotos können ergänzt werden."
                  : "Für erste Erfassung auf der Baustelle. Details und Fotos können anschließend in der Meldung ergänzt werden."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {editReport ? (
                <Link
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
                  href="/safety/accidents"
                >
                  Bearbeiten abbrechen
                </Link>
              ) : null}
              <Link
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
                href="/safety"
              >
                ← Arbeitssicherheit
              </Link>
            </div>
          </div>

          <form
            action={accidentFormAction}
            className="mt-6 space-y-5"
            key={editReport?.id ?? "new-accident-report"}
          >
            <div className="rounded-2xl border border-gray-300">
              <div className="border-b border-gray-300 bg-gray-100 px-5 py-3 text-xl font-bold text-gray-950">
                Anbei wird intern ein Betriebsunfall gemeldet:
              </div>
              <div className="grid border-b border-gray-300 text-base font-bold text-gray-950 md:grid-cols-2">
                <div className="border-b border-gray-300 px-5 py-3 md:border-b-0 md:border-r">
                  INFORMATIONEN:
                </div>
                <div className="px-5 py-3">Eintragungen:</div>
              </div>
              <div className="grid divide-y divide-gray-300 text-base">
                <div className="grid md:grid-cols-2">
                  <div className="border-gray-300 px-5 py-4 font-bold leading-snug text-gray-950 md:border-r">
                    Verunfallte Person(en):
                  </div>
                  <div className="grid gap-3 px-5 py-4 md:grid-cols-[150px_minmax(0,1fr)]">
                    <select
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                      defaultValue={fieldValue(editReport?.employeeSalutation)}
                      name="employeeSalutation"
                    >
                      <option value="">Anrede</option>
                      <option value="Herr">Herr</option>
                      <option value="Frau">Frau</option>
                      <option value="Divers">Divers / andere</option>
                    </select>
                    <select
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                      defaultValue={fieldValue(editReport?.employeeId)}
                      name="employeeId"
                    >
                      <option value="">Mitarbeiter auswählen</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.lastName}, {employee.firstName}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-xl border border-gray-300 px-3 py-2 text-gray-950 md:col-span-2"
                      defaultValue={
                        editReport?.employeeId
                          ? ""
                          : fieldValue(editReport?.employeeSnapshot)
                      }
                      name="employeeSnapshot"
                      placeholder="Freier Name, falls nicht in Mitarbeiterliste"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2">
                  <div className="border-gray-300 px-5 py-4 font-bold leading-snug text-gray-950 md:border-r">
                    Interne(r) Mitarbeiter(in):
                    <p className="mt-2 text-sm font-semibold italic text-red-800">
                      Bitte rechts markieren – X
                    </p>
                  </div>
                  <div className="space-y-3 px-5 py-4">
                    <ChoiceGroup
                      name="internalEmployeeStatus"
                      value={editReport?.internalEmployeeStatus}
                    />
                    <input
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                      defaultValue={fieldValue(editReport?.externalCompany)}
                      name="externalCompany"
                      placeholder="Falls nein, Firma"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2">
                  <div className="border-gray-300 px-5 py-4 font-bold leading-snug text-gray-950 md:border-r">
                    Auszubildende(r):
                  </div>
                  <div className="px-5 py-4">
                    <ChoiceGroup
                      name="apprenticeStatus"
                      value={editReport?.apprenticeStatus}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2">
                  <div className="border-gray-300 px-5 py-4 font-bold leading-snug text-gray-950 md:border-r">
                    Externe Unfallverursacher*in?
                    <p className="mt-2 text-sm font-semibold italic text-red-800">
                      z. B. bei Verkehrsunfällen
                    </p>
                  </div>
                  <div className="space-y-3 px-5 py-4">
                    <ChoiceGroup
                      name="externalCauserStatus"
                      value={editReport?.externalCauserStatus}
                    />
                    <input
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                      defaultValue={fieldValue(editReport?.externalCauserName)}
                      name="externalCauserName"
                      placeholder="Falls ja, wer?"
                    />
                    <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                      <ChoiceGroup
                        name="policeReportStatus"
                        value={editReport?.policeReportStatus}
                      />
                      <input
                        className="w-full rounded-xl border border-gray-300 px-3 py-2 text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                        defaultValue={fieldValue(editReport?.policeReportNotes)}
                        name="policeReportNotes"
                        placeholder="Unfallaufnahme durch Polizei / weitere Info"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Projekt / Baustelle
                </span>
                <select
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.projectId) || preselectedProjectId}
                  name="projectId"
                >
                  <option value="">Kein Projekt auswählen</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.projectNumber} · {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Gemeldet von
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.reportedByName)}
                  name="reportedByName"
                  placeholder="Bauleiter / Mitarbeiter"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Abteilung / Kolonne
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.departmentCrew)}
                  name="departmentCrew"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Unfalldatum
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={
                    editReport?.accidentDate
                      ? dateInputValue(editReport.accidentDate)
                      : todayInputValue()
                  }
                  name="accidentDate"
                  required
                  type="date"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Uhrzeit
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.accidentTime)}
                  name="accidentTime"
                  type="time"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Bauleitung
                </span>
                <div className="grid gap-2 md:grid-cols-[120px_minmax(0,1fr)]">
                  <select
                    className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                    defaultValue={fieldValue(editReport?.constructionManagerSalutation)}
                    name="constructionManagerSalutation"
                  >
                    <option value="">Anrede wählen</option>
                    <option value="Herr">Herr</option>
                    <option value="Frau">Frau</option>
                    <option value="Divers">Divers / andere</option>
                  </select>
                  <input
                    className="rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                    defaultValue={fieldValue(editReport?.constructionManagerName)}
                    name="constructionManagerName"
                    placeholder="Name Bauleitung"
                  />
                </div>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Telefonkontakt BL
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.constructionManagerPhone)}
                  name="constructionManagerPhone"
                  placeholder="Tel. / Mobil"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-gray-800">
                  Ansprechpartner AG (SiFa o. ä., falls relevant)
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.clientSafetyContact)}
                  name="clientSafetyContact"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-gray-800">
                  Unfallort
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.location)}
                  name="location"
                  placeholder="z. B. Bauabschnitt, Straße, Maschine"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Unfallart
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.accidentType)}
                  name="accidentType"
                  placeholder="Sturz, Schnitt, Quetschung..."
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Verletzungsart
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.injuryType)}
                  name="injuryType"
                  placeholder="Prellung, Wunde..."
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Körperteil
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.bodyPart)}
                  name="bodyPart"
                  placeholder="Hand, Bein, Kopf..."
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Zeugen
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.witnessNames)}
                  name="witnessNames"
                  placeholder="Namen"
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-gray-800">
                Unfallhergang
              </span>
              <textarea
                className="min-h-28 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                defaultValue={fieldValue(editReport?.description)}
                name="description"
                placeholder="Kurz und sachlich beschreiben, was passiert ist."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Verletzung betroffene Körperteile / Art der Verletzung
                </span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.injuryType)}
                  name="injuryType"
                />
              </label>
              <div className="rounded-2xl border border-gray-300 bg-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-800">
                  Schwere der Verletzung
                </p>
                <div className="mt-3 space-y-2 text-sm font-semibold text-gray-800">
                  <label className="flex items-center gap-2">
                    <input
                      defaultChecked={editReport?.injurySeverity === "LIGHT"}
                      name="injurySeverity"
                      type="radio"
                      value="LIGHT"
                    />
                    leicht (Arzt selbst aufgesucht / gefahren worden)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      defaultChecked={editReport?.injurySeverity === "MEDIUM"}
                      name="injurySeverity"
                      type="radio"
                      value="MEDIUM"
                    />
                    mittel (Krankenwagen)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      defaultChecked={editReport?.injurySeverity === "SEVERE"}
                      name="injurySeverity"
                      type="radio"
                      value="SEVERE"
                    />
                    schwer (ggf. Lebensgefahr, Krankenwagen)
                  </label>
                </div>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Behandlung
                </span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.treatment)}
                  name="treatment"
                  placeholder="Ärztliche Praxis, Notarzt, Krankenhaus"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Sofortmaßnahmen
                </span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.immediateMeasures)}
                  name="immediateMeasures"
                  placeholder="Erste Hilfe, Arzt, Absicherung, Maschine stillgelegt..."
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["doctorVisit", "Arzt / Durchgangsarzt", editReport?.doctorVisit],
                ["workStopped", "Arbeit unterbrochen", editReport?.workStopped],
                ["emergencyCalled", "Notruf / Rettungsdienst", editReport?.emergencyCalled],
              ].map(([name, label, isChecked]) => (
                <label
                  className="flex items-center gap-3 rounded-2xl border border-gray-300 bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-800"
                  key={String(name)}
                >
                  <input
                    className="h-5 w-5 accent-yellow-500"
                    defaultChecked={Boolean(isChecked)}
                    name={String(name)}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-300 bg-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-800">
                  Nennenswerter Sachschaden entstanden?
                </p>
                <div className="mt-3">
                  <ChoiceGroup
                    name="propertyDamageStatus"
                    value={editReport?.propertyDamageStatus}
                  />
                </div>
                <textarea
                  className="mt-3 min-h-20 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={fieldValue(editReport?.propertyDamageDescription)}
                  name="propertyDamageDescription"
                  placeholder="Falls ja, Kurzbeschreibung"
                />
              </div>
              <div className="rounded-2xl border border-gray-300 bg-gray-100 p-4">
                <p className="text-sm font-semibold text-gray-800">
                  Unfallanalyse durch externe SiFa (EGRO)?
                </p>
                <div className="mt-3 space-y-2 text-sm font-semibold text-gray-800">
                  <label className="flex items-center gap-2">
                    <input
                      className="h-4 w-4 accent-yellow-500"
                      defaultChecked={editReport?.externalSafetyAnalysisStatus === "YES"}
                      name="externalSafetyAnalysisStatus"
                      type="radio"
                      value="YES"
                    />
                    Ja, bitte kurzfristig veranlassen.
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      className="h-4 w-4 accent-yellow-500"
                      defaultChecked={
                        editReport?.externalSafetyAnalysisStatus === "NOT_REQUIRED"
                      }
                      name="externalSafetyAnalysisStatus"
                      type="radio"
                      value="NOT_REQUIRED"
                    />
                    Nicht erforderlich aus Sicht der Baustelle.
                  </label>
                </div>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-gray-800">
                Fotos / Kamera
              </span>
              <input
                accept="image/*"
                capture="environment"
                className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-100 px-4 py-4 text-sm text-gray-800"
                multiple
                name="photos"
                type="file"
              />
              <span className="block text-xs text-gray-900">
                Auf dem Handy öffnet das Kamerasymbol je nach Gerät direkt Kamera
                oder Galerie.
              </span>
            </label>

            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Datum Unterschrift
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  defaultValue={
                    editReport?.signatureDate
                      ? dateInputValue(editReport.signatureDate)
                      : todayInputValue()
                  }
                  name="signatureDate"
                  type="date"
                />
              </label>
              <SignatureFormField
                label="Unterschrift Abteilungs- / Bauleitung"
                name="managerSignatureDataUrl"
                value={editReport?.managerSignatureDataUrl}
              />
            </div>

            <button
              className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200 hover:bg-yellow-300"
              type="submit"
            >
              {editReport ? "Änderungen speichern" : "Unfallmeldung speichern"}
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-4">
          <div className="order-2 rounded-3xl border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200">
              Unfallbeauftragte / E-Mail-Verteiler
            </h2>
            <p className="mt-1 text-sm text-gray-800">
              Bei jeder neuen Unfallmeldung wird automatisch ein Versandprotokoll
              für diese aktiven Empfänger angelegt.
            </p>
            <form action={createSafetyAccidentOfficer} className="mt-4 space-y-3">
              <input
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                name="name"
                placeholder="Name"
                required
              />
              <input
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                name="email"
                placeholder="E-Mail"
                required
                type="email"
              />
              <input
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                name="role"
                placeholder="Rolle, z. B. SGU, Personal, SiFa"
              />
              <button
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
                type="submit"
              >
                Empfänger speichern
              </button>
            </form>
            <div className="mt-4 space-y-2">
              {officers.length === 0 ? (
                <p className="rounded-2xl bg-gray-100 p-4 text-sm text-gray-800">
                  Noch keine Unfallbeauftragten hinterlegt.
                </p>
              ) : (
                officers.map((officer) => (
                  <div
                    className="rounded-2xl border border-gray-300 p-3 text-sm"
                    key={officer.id}
                  >
                    <p className="font-bold text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200">{officer.name}</p>
                    <p className="text-gray-900">{officer.email}</p>
                    <p className="text-xs text-gray-900">
                      {officer.role || "Ohne Rolle"} ·{" "}
                      {officer.isActive ? "aktiv" : "inaktiv"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="order-1 rounded-3xl border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200">
              Gespeicherte Unfallmeldungen
            </h2>
            <div className="mt-4 space-y-3">
              {reports.length === 0 ? (
                <p className="rounded-2xl bg-gray-100 p-4 text-sm text-gray-800">
                  Noch keine Unfallmeldungen vorhanden.
                </p>
              ) : (
                reports.map((report) => (
                  <div
                    className="rounded-2xl border border-gray-300 p-4 transition hover:border-yellow-300 hover:bg-yellow-50"
                    key={report.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-950 placeholder:text-gray-700 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200">
                          {formatDate(report.accidentDate)}
                          {report.accidentTime ? ` · ${report.accidentTime}` : ""}
                        </p>
                        <p className="mt-1 text-sm text-gray-900">
                          {report.employee
                            ? `${report.employee.lastName}, ${report.employee.firstName}`
                            : report.employeeSnapshot ?? "Ohne Mitarbeiter"}
                        </p>
                        <p className="text-xs text-gray-900">
                          {report.project
                            ? `${report.project.projectNumber} · ${report.project.name}`
                            : report.projectSnapshot ?? "Ohne Projekt"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-900">
                          {report._count.photos} Foto
                          {report._count.photos === 1 ? "" : "s"}
                        </span>
                        <Link
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                          href={`/safety/accidents/${report.id}`}
                        >
                          Öffnen
                        </Link>
                        <Link
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                          href={`/safety/accidents?edit=${report.id}#unfallmeldung`}
                        >
                          Bearbeiten
                        </Link>
                        <a
                          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100"
                          href={`/safety/accidents/${report.id}/pdf`}
                          target="_blank"
                        >
                          PDF
                        </a>
                        <DeleteAccidentReportButton
                          action={deleteSafetyAccidentReport}
                          reportId={report.id}
                        />
                      </div>
                    </div>
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
