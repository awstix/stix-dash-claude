import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createProjectNote,
  deleteProjectNote,
  updateProjectNote,
} from "../actions";
import { ProjectNavigation } from "../ProjectNavigation";

const categoryOptions = [
  { label: "Allgemein", value: "GENERAL" },
  { label: "Behinderung", value: "OBSTRUCTION" },
  { label: "Vorkommnis", value: "INCIDENT" },
  { label: "Auftraggeber / Bauleiter", value: "CLIENT" },
  { label: "Intern", value: "INTERNAL" },
];

const visibilityOptions = [
  { label: "Intern", value: "INTERNAL" },
  { label: "Disposition sichtbar", value: "DISPATCH" },
  { label: "BTB / Bericht", value: "BTB" },
];

export default async function ProjectNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId: selectedProjectId = "" } = await searchParams;
  const projects = await prisma.project.findMany({
    include: {
      projectNotes: {
        orderBy: [{ noteDate: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ status: "asc" }, { projectNumber: "asc" }],
  });
  const notes = projects.flatMap((project) =>
    project.projectNotes.map((note) => ({
      ...note,
      project,
    })),
  );

  return (
    <AppShell
      title="Projekte Notizen"
      description="Projektbezogene Notizen mit Datum, Sichtbarkeit und BTB-Übernahme."
    >
      <ProjectNavigation active="notes" />

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Neue Notiz erfassen
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Notizen können in der Kolonneneinteilung eingeblendet und bei neuen
          Bautagesberichten vorgeschlagen werden.
        </p>
        <ProjectNoteForm
          action={createProjectNoteAction}
          defaultProjectId={selectedProjectId}
          projects={projects}
          submitLabel="Notiz speichern"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 bg-gray-50 p-5">
          <h2 className="text-xl font-semibold text-gray-900">
            Notizenübersicht
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {notes.length} Notiz{notes.length === 1 ? "" : "en"} über alle
            Projekte.
          </p>
        </div>

        {notes.length === 0 ? (
          <p className="p-8 text-center text-sm font-medium text-gray-500">
            Noch keine Projekt-Notizen erfasst.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {notes.map((note) => (
              <article className="p-5" key={note.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
                        {note.project.projectNumber} · {note.project.name}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                        {getCategoryLabel(note.category)}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
                        {getVisibilityLabel(note.visibility)}
                      </span>
                      {note.includeInDailyReport ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                          BTB
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-gray-900">
                      {note.title || "Ohne Titel"}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-gray-500">
                      {formatDate(note.noteDate)}
                      {note.createdByName ? ` · ${note.createdByName}` : ""}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                      {note.content}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <details className="rounded-xl border border-gray-200 bg-gray-50">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-800">
                        Bearbeiten
                      </summary>
                      <div className="w-full max-w-3xl p-4 lg:w-[720px]">
                        <ProjectNoteForm
                          action={updateProjectNoteAction}
                          note={note}
                          projects={projects}
                          submitLabel="Änderungen speichern"
                        />
                      </div>
                    </details>
                    <form action={deleteProjectNoteAction}>
                      <input name="id" type="hidden" value={note.id} />
                      <input
                        name="projectId"
                        type="hidden"
                        value={note.projectId}
                      />
                      <button
                        className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                        type="submit"
                      >
                        Löschen
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

async function createProjectNoteAction(formData: FormData) {
  "use server";

  await createProjectNote(noteInputFromFormData(formData));
}

async function updateProjectNoteAction(formData: FormData) {
  "use server";

  await updateProjectNote(noteInputFromFormData(formData));
}

async function deleteProjectNoteAction(formData: FormData) {
  "use server";

  await deleteProjectNote({
    id: text(formData.get("id")),
    projectId: text(formData.get("projectId")),
  });
}

function ProjectNoteForm({
  action,
  defaultProjectId = "",
  note,
  projects,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  defaultProjectId?: string;
  note?: {
    category: string;
    content: string;
    createdByName: string | null;
    id: string;
    includeInDailyReport: boolean;
    noteDate: Date;
    projectId: string;
    title: string | null;
    visibility: string;
  };
  projects: {
    id: string;
    name: string;
    projectNumber: string;
  }[];
  submitLabel: string;
}) {
  return (
    <form action={action} className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-6">
      {note ? <input name="id" type="hidden" value={note.id} /> : null}
      <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
        Projekt
        <select
          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          defaultValue={note?.projectId ?? defaultProjectId}
          name="projectId"
          required
        >
          <option value="">Projekt wählen</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectNumber} · {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-gray-700">
        Datum
        <input
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={formatDateInput(note?.noteDate ?? new Date())}
          name="noteDate"
          type="date"
        />
      </label>
      <label className="text-xs font-semibold text-gray-700">
        Kategorie
        <select
          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          defaultValue={note?.category ?? "GENERAL"}
          name="category"
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-gray-700">
        Sichtbarkeit
        <select
          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          defaultValue={note?.visibility ?? "DISPATCH"}
          name="visibility"
        >
          {visibilityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-gray-700">
        <input
          className="h-4 w-4 rounded border-gray-300"
          defaultChecked={note?.includeInDailyReport ?? true}
          name="includeInDailyReport"
          type="checkbox"
          value="1"
        />
        In BTB übernehmen
      </label>
      <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
        Titel
        <input
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={note?.title ?? ""}
          name="title"
          placeholder="Optional, z.B. Zufahrt gesperrt"
        />
      </label>
      <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
        Erfasst von
        <input
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={note?.createdByName ?? ""}
          name="createdByName"
          placeholder="Name"
        />
      </label>
      <label className="text-xs font-semibold text-gray-700 lg:col-span-6">
        Notiz
        <textarea
          className="mt-1 min-h-28 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={note?.content ?? ""}
          name="content"
          required
        />
      </label>
      <div className="lg:col-span-6">
        <button
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function noteInputFromFormData(formData: FormData) {
  return {
    category: text(formData.get("category")),
    content: text(formData.get("content")),
    createdByName: text(formData.get("createdByName")),
    id: text(formData.get("id")) || undefined,
    includeInDailyReport: formData.get("includeInDailyReport") === "1",
    noteDate: text(formData.get("noteDate")),
    projectId: text(formData.get("projectId")),
    title: text(formData.get("title")),
    visibility: text(formData.get("visibility")),
  };
}

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getCategoryLabel(value: string) {
  return categoryOptions.find((option) => option.value === value)?.label ?? value;
}

function getVisibilityLabel(value: string) {
  return (
    visibilityOptions.find((option) => option.value === value)?.label ?? value
  );
}
