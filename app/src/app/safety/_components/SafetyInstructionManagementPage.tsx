import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

import {
  createSafetyInstructionRecord,
  createSafetyInstructionTemplate,
} from "../actions";

type InstructionKind = {
  createDescription: string;
  description: string;
  emptyText: string;
  title: string;
  type: "RISK_ASSESSMENT" | "OPERATING_INSTRUCTION" | "COMMISSION";
};

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

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export async function SafetyInstructionManagementPage({
  kind,
}: {
  kind: InstructionKind;
}) {
  const [templates, projects, employees, records] = await Promise.all([
    prisma.safetyInstructionTemplate.findMany({
      where: {
        type: kind.type,
      },
      orderBy: [
        {
          isActive: "desc",
        },
        {
          sortOrder: "asc",
        },
        {
          title: "asc",
        },
      ],
    }),
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
        statusValue: true,
      },
    }),
    prisma.safetyInstructionRecord.findMany({
      where: {
        template: {
          type: kind.type,
        },
      },
      include: {
        _count: {
          select: {
            signatures: true,
          },
        },
        project: {
          select: {
            name: true,
            projectNumber: true,
          },
        },
        signatures: {
          select: {
            signedAt: true,
          },
        },
        template: {
          select: {
            title: true,
          },
        },
      },
      orderBy: {
        instructionDate: "desc",
      },
      take: 80,
    }),
  ]);

  const activeEmployees = employees.filter(
    (employee) => employee.statusValue !== "ausgeschieden",
  );

  return (
    <AppShell title={kind.title} description={kind.description}>
      <div className="space-y-6">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-950">
                Vorlage anlegen
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {kind.createDescription}
              </p>
            </div>
            <Link
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              href="/safety"
            >
              ← Arbeitssicherheit
            </Link>
          </div>

          <form
            action={createSafetyInstructionTemplate}
            className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
          >
            <input name="type" type="hidden" value={kind.type} />
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Titel
                </span>
                <input
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="title"
                  placeholder="z. B. Arbeiten im Verkehrsraum"
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Kurzbeschreibung
                </span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="description"
                  placeholder="Worum geht es?"
                />
              </label>
            </div>
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Unterweisungsbereiche / Checkliste
                </span>
                <textarea
                  className="min-h-32 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="sections"
                  placeholder={"Ein Punkt pro Zeile\nPersönliche Schutzausrüstung\nSicherung Arbeitsbereich\nMaschinen / Geräte"}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-800">
                  Inhalt / Hinweistext
                </span>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                  name="content"
                  placeholder="Optionaler Unterweisungstext oder interne Hinweise."
                />
              </label>
              <button
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-bold text-white hover:bg-gray-800"
                type="submit"
              >
                Vorlage speichern
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950">
            Unterweisung starten
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Vorlage wählen, Bereiche abhaken, Mitarbeiter auswählen und danach
            direkt unterschreiben lassen.
          </p>

          {templates.length === 0 ? (
            <p className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
              {kind.emptyText}
            </p>
          ) : (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {templates.map((template) => {
                const sections = parseSections(template.sectionsJson);

                return (
                  <form
                    action={createSafetyInstructionRecord}
                    className="rounded-2xl border border-gray-200 p-5"
                    key={template.id}
                  >
                    <input name="templateId" type="hidden" value={template.id} />
                    <h3 className="text-lg font-bold text-gray-950">
                      {template.title}
                    </h3>
                    {template.description ? (
                      <p className="mt-1 text-sm text-gray-600">
                        {template.description}
                      </p>
                    ) : null}

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-800">
                          Projekt
                        </span>
                        <select
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 shadow-sm"
                          name="projectId"
                        >
                          <option value="">Ohne Projekt</option>
                          {projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.projectNumber} · {project.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-gray-800">
                          Datum
                        </span>
                        <input
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                          defaultValue={todayInputValue()}
                          name="instructionDate"
                          required
                          type="date"
                        />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-semibold text-gray-800">
                          Unterwiesen durch
                        </span>
                        <input
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                          name="instructedByName"
                          placeholder="Bauleiter / Polier"
                        />
                      </label>
                    </div>

                    {sections.length > 0 ? (
                      <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                        <p className="text-sm font-bold text-gray-950">
                          Unterwiesene Bereiche
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {sections.map((section) => (
                            <label
                              className="flex items-center gap-2 text-sm font-semibold text-gray-800"
                              key={section}
                            >
                              <input
                                className="h-5 w-5 accent-yellow-500"
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
                    ) : null}

                    <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm font-bold text-gray-950">
                        Teilnehmer
                      </p>
                      <div className="mt-3 grid max-h-64 gap-2 overflow-auto pr-2 sm:grid-cols-2">
                        {activeEmployees.map((employee) => (
                          <label
                            className="flex items-center gap-2 text-sm font-semibold text-gray-800"
                            key={employee.id}
                          >
                            <input
                              className="h-5 w-5 accent-yellow-500"
                              name="employeeIds"
                              type="checkbox"
                              value={employee.id}
                            />
                            {employee.lastName}, {employee.firstName}
                          </label>
                        ))}
                      </div>
                    </div>

                    <label className="mt-4 block space-y-2">
                      <span className="text-sm font-semibold text-gray-800">
                        Notiz
                      </span>
                      <textarea
                        className="min-h-20 w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-950 shadow-sm"
                        name="notes"
                      />
                    </label>

                    <button
                      className="mt-4 rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-gray-950 hover:bg-yellow-300"
                      type="submit"
                    >
                      Unterweisung anlegen
                    </button>
                  </form>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-950">
            Durchgeführte Unterweisungen
          </h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Vorlage</th>
                  <th className="px-4 py-3">Projekt</th>
                  <th className="px-4 py-3">Unterschriften</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aktion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800">
                {records.length === 0 ? (
                  <tr>
                    <td className="px-4 py-5 text-gray-500" colSpan={6}>
                      Noch keine Unterweisungen vorhanden.
                    </td>
                  </tr>
                ) : (
                  records.map((record) => {
                    const signedCount = record.signatures.filter(
                      (signature) => signature.signedAt,
                    ).length;

                    return (
                      <tr key={record.id}>
                        <td className="px-4 py-3 font-semibold">
                          {formatDate(record.instructionDate)}
                        </td>
                        <td className="px-4 py-3">{record.template.title}</td>
                        <td className="px-4 py-3">
                          {record.project
                            ? `${record.project.projectNumber} · ${record.project.name}`
                            : record.projectSnapshot ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {signedCount}/{record._count.signatures}
                        </td>
                        <td className="px-4 py-3">
                          {record.status === "SIGNED"
                            ? "Unterschrieben"
                            : "Offen"}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white"
                            href={`/safety/instruction-records/${record.id}`}
                          >
                            Öffnen
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
