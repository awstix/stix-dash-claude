import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

import { DirectParticipantSignatures } from "../../_components/DirectParticipantSignatures";
import { createSafetyInstructionRecord } from "../../actions";
import { ProjectInstructorFields } from "./ProjectInstructorFields";

export default async function NewOperatingInstructionPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const title = (await searchParams).template;
  if (!title) notFound();
  const [template, projects, employees] = await Promise.all([
    prisma.safetyInstructionTemplate.findFirst({
      where: { title, type: "OPERATING_INSTRUCTION" },
    }),
    prisma.project.findMany({
      orderBy: { projectNumber: "desc" },
      select: {
        constructionManager: true,
        id: true,
        name: true,
        projectNumber: true,
      },
    }),
    prisma.employee.findMany({
      include: { positions: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);
  if (!template) notFound();
  const sections = JSON.parse(template.sectionsJson) as string[];
  const pdfPath =
    template.content
      ?.split("\n")
      .find((line) => line.startsWith("SOURCE_PDF:"))
      ?.slice("SOURCE_PDF:".length) ?? "";

  return (
    <AppShell
      description="Original gemeinsam durchgehen, Teilnehmer auswählen und anschließend digital unterschreiben lassen."
      title={template.title}
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700"
          href="/safety/operating-instructions"
        >
          ← Betriebsanweisungen
        </Link>
        <a
          className="rounded-xl bg-gray-950 px-4 py-2 text-sm font-bold text-white"
          href={pdfPath}
          target="_blank"
        >
          Original separat öffnen
        </a>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(380px,0.75fr)]">
        <section className="overflow-hidden rounded-2xl border border-gray-300 bg-gray-200 shadow-sm xl:aspect-[210/297]">
          <iframe
            className="h-[60dvh] min-h-[26rem] w-full bg-white xl:h-full xl:min-h-0"
            src={`${pdfPath}#page=1&view=Fit&zoom=page-fit&navpanes=0`}
            title={`Original: ${template.title}`}
          />
        </section>
        <form
          action={createSafetyInstructionRecord}
          className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <input name="templateId" type="hidden" value={template.id} />
          <input
            name="redirectTo"
            type="hidden"
            value="/safety/operating-instructions"
          />
          <ProjectInstructorFields
            managerOptions={employees
              .filter((employee) =>
                employee.positions.some((position) =>
                  position.positionLabel
                    .toLocaleLowerCase("de")
                    .includes("bauleit"),
                ),
              )
              .map(
                (employee) =>
                  `${employee.lastName}, ${employee.firstName}`,
              )}
            projects={projects.map((project) => ({
              constructionManager: project.constructionManager ?? "",
              id: project.id,
              label: `${project.projectNumber} · ${project.name}`,
            }))}
          />
          <Field label="Datum">
            <input
              className={inputClass}
              defaultValue={new Date().toISOString().slice(0, 10)}
              name="instructionDate"
              required
              type="date"
            />
          </Field>
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
          <DirectParticipantSignatures
            employees={employees
              .filter((employee) => employee.statusValue !== "ausgeschieden")
              .map((employee) => ({
                id: employee.id,
                label: `${employee.lastName}, ${employee.firstName}`,
              }))}
          />
          <Field label="Notizen">
            <textarea className={`${inputClass} min-h-20`} name="notes" />
          </Field>
          <button
            className="w-full rounded-xl bg-gray-950 px-5 py-3 font-bold text-white"
            type="submit"
          >
            Unterweisung speichern und abschließen
          </button>
        </form>
      </div>
    </AppShell>
  );
}

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-950 shadow-sm";

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-gray-950">{label}</span>
      {children}
    </label>
  );
}
