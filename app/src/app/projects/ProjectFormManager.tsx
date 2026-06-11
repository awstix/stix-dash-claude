"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import {
  createProjectFormTemplate,
  deleteProjectFormSubmission,
  saveProjectFormSubmission,
} from "./actions";
import {
  getProjectFormFieldTypeLabel,
  PROJECT_FORM_FIELD_TYPES,
} from "./projectFormTypes";
import type {
  ProjectFormFieldDefinition,
  ProjectFormFieldType,
} from "./projectFormTypes";

export type ProjectFormProjectOption = {
  id: string;
  label: string;
};

export type ProjectFormTemplateItem = {
  category: string | null;
  description: string | null;
  fields: ProjectFormFieldDefinition[];
  id: string;
  isActive: boolean;
  name: string;
  sortOrder: number;
};

export type ProjectFormSubmissionItem = {
  createdAt: string;
  createdByName: string | null;
  fields: ProjectFormFieldDefinition[];
  formDate: string | null;
  id: string;
  projectId: string;
  projectLabel: string;
  templateId: string | null;
  templateName: string;
  title: string;
  values: Record<string, boolean | string>;
};

type TemplateDraftField = {
  label: string;
  optionsText: string;
  required: boolean;
  type: ProjectFormFieldType;
};

export function ProjectFormManager({
  embedded = false,
  initialProjectId,
  lockedProjectId,
  projects,
  submissions,
  templates,
}: {
  embedded?: boolean;
  initialProjectId?: string;
  lockedProjectId?: string;
  projects: ProjectFormProjectOption[];
  submissions: ProjectFormSubmissionItem[];
  templates: ProjectFormTemplateItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const defaultProjectId = getInitialProjectId(projects, lockedProjectId ?? initialProjectId);
  const firstTemplateId = templates.find((template) => template.isActive)?.id ?? "";
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId);
  const [selectedTemplateId, setSelectedTemplateId] = useState(firstTemplateId);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [submissionFormKey, setSubmissionFormKey] = useState(0);
  const [templateFields, setTemplateFields] = useState<TemplateDraftField[]>([
    getEmptyTemplateField(),
  ]);
  const effectiveProjectId = lockedProjectId ?? selectedProjectId;
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ??
    templates.find((template) => template.isActive) ??
    null;
  const visibleSubmissions = useMemo(
    () =>
      submissions.filter((submission) =>
        effectiveProjectId ? submission.projectId === effectiveProjectId : true,
      ),
    [effectiveProjectId, submissions],
  );

  function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        await createProjectFormTemplate({
          category: String(formData.get("category") ?? ""),
          description: String(formData.get("description") ?? ""),
          fields: templateFields,
          name: String(formData.get("name") ?? ""),
        });
        form.reset();
        setTemplateFields([getEmptyTemplateField()]);
        setShowTemplateForm(false);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Formularvorlage konnte nicht gespeichert werden.",
        );
      }
    });
  }

  function saveSubmission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTemplate) {
      alert("Bitte eine Formularvorlage auswählen.");
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const values: Record<string, boolean | string> = {};

    for (const field of selectedTemplate.fields) {
      const key = `field:${field.id}`;
      values[field.id] =
        field.type === "checkbox"
          ? formData.get(key) === "on"
          : String(formData.get(key) ?? "");
    }

    startTransition(async () => {
      try {
        await saveProjectFormSubmission({
          createdByName: String(formData.get("createdByName") ?? ""),
          formDate: String(formData.get("formDate") ?? ""),
          projectId: effectiveProjectId,
          templateId: selectedTemplate.id,
          title: String(formData.get("title") ?? ""),
          values,
        });
        form.reset();
        setSubmissionFormKey((current) => current + 1);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Formular konnte nicht gespeichert werden.",
        );
      }
    });
  }

  function deleteSubmission(submission: ProjectFormSubmissionItem) {
    const confirmed = window.confirm(
      `Formular "${submission.title}" wirklich löschen?`,
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteProjectFormSubmission({
          id: submission.id,
        });
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Formular konnte nicht gelöscht werden.",
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Formulare</h2>
            <p className="mt-1 text-sm text-gray-600">
              Vorlagen erstellen, projektbezogen ausfüllen und in der Projektakte speichern.
            </p>
          </div>
          <button
            className="w-fit rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            onClick={() => setShowTemplateForm((current) => !current)}
            type="button"
          >
            {showTemplateForm ? "Vorlage schließen" : "Vorlage anlegen"}
          </button>
        </div>

        {showTemplateForm ? (
          <form className="mt-4 space-y-4" onSubmit={createTemplate}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <LabeledInput label="Vorlagenname" name="name" required />
              <LabeledInput label="Kategorie" name="category" />
              <label className="lg:col-span-2">
                <span className="text-xs font-semibold text-gray-600">
                  Beschreibung
                </span>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                  name="description"
                />
              </label>
            </div>

            <div className="rounded-lg border border-gray-200">
              <div className="grid grid-cols-[1fr_140px_96px_42px] gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase text-gray-500">
                <div>Feld</div>
                <div>Art</div>
                <div>Pflicht</div>
                <div />
              </div>
              <div className="divide-y divide-gray-100">
                {templateFields.map((field, index) => (
                  <div
                    className="grid grid-cols-1 gap-2 px-3 py-3 lg:grid-cols-[1fr_140px_96px_42px] lg:items-start"
                    key={index}
                  >
                    <div className="space-y-2">
                      <input
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                        onChange={(event) =>
                          updateTemplateField(index, {
                            label: event.currentTarget.value,
                          })
                        }
                        placeholder="z.B. Ausgeführte Leistung"
                        value={field.label}
                      />
                      {field.type === "select" ? (
                        <textarea
                          className="min-h-16 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                          onChange={(event) =>
                            updateTemplateField(index, {
                              optionsText: event.currentTarget.value,
                            })
                          }
                          placeholder="Optionen mit Komma oder neuer Zeile trennen"
                          value={field.optionsText}
                        />
                      ) : null}
                    </div>
                    <select
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                      onChange={(event) =>
                        updateTemplateField(index, {
                          type: event.currentTarget.value as ProjectFormFieldType,
                        })
                      }
                      value={field.type}
                    >
                      {PROJECT_FORM_FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {getProjectFormFieldTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700">
                      <input
                        checked={field.required}
                        onChange={(event) =>
                          updateTemplateField(index, {
                            required: event.currentTarget.checked,
                          })
                        }
                        type="checkbox"
                      />
                      Pflicht
                    </label>
                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                      disabled={templateFields.length === 1}
                      onClick={() => removeTemplateField(index)}
                      title="Feld entfernen"
                      type="button"
                    >
                      <ActionIcon name="delete" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                onClick={() =>
                  setTemplateFields((current) => [...current, getEmptyTemplateField()])
                }
                type="button"
              >
                Feld hinzufügen
              </button>
              <button
                className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                Vorlage speichern
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Vorlagen</h3>
          <div className="mt-4 space-y-2">
            {templates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm font-medium text-gray-500">
                Noch keine Formularvorlagen vorhanden.
              </p>
            ) : (
              templates.map((template) => (
                <button
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    template.id === selectedTemplateId
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                  }`}
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  type="button"
                >
                  <span className="font-semibold">{template.name}</span>
                  <span className="mt-1 block text-xs opacity-75">
                    {template.category || "ohne Kategorie"} ·{" "}
                    {template.fields.length} Felder
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <form
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          key={`${submissionFormKey}-${selectedTemplate?.id ?? "none"}`}
          onSubmit={saveSubmission}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Formular ausfüllen
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {selectedTemplate?.description ||
                  "Vorlage wählen und direkt für die Baustelle speichern."}
              </p>
            </div>
            <button
              className="w-fit rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
              disabled={isPending || !selectedTemplate || !effectiveProjectId}
              type="submit"
            >
              Formular speichern
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {!lockedProjectId ? (
              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Projekt
                </span>
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                  onChange={(event) => setSelectedProjectId(event.currentTarget.value)}
                  required
                  value={selectedProjectId}
                >
                  <option value="">Projekt auswählen</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              <span className="text-xs font-semibold text-gray-600">
                Vorlage
              </span>
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
                onChange={(event) => setSelectedTemplateId(event.currentTarget.value)}
                required
                value={selectedTemplateId}
              >
                <option value="">Vorlage auswählen</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <LabeledInput label="Titel" name="title" />
            <LabeledInput
              defaultValue={getTodayInputValue()}
              label="Datum"
              name="formDate"
              type="date"
            />
            <LabeledInput label="Ausgefüllt von" name="createdByName" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            {selectedTemplate?.fields.map((field) => (
              <ProjectFormFieldInput field={field} key={field.id} />
            ))}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Gespeicherte Formulare
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              {visibleSubmissions.length} Formular
              {visibleSubmissions.length === 1 ? "" : "e"} im aktuellen Projektfilter.
            </p>
          </div>
          {embedded ? null : (
            <div className="text-xs font-semibold text-gray-500">
              Projektfilter kommt aus der Auswahl oben.
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {visibleSubmissions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm font-medium text-gray-500">
              Noch keine Formulare gespeichert.
            </p>
          ) : (
            visibleSubmissions.map((submission) => (
              <details
                className="rounded-lg border border-gray-200 bg-white p-3"
                key={submission.id}
              >
                <summary className="flex cursor-pointer list-none flex-col gap-2 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="font-semibold text-gray-900">
                      {submission.title}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-gray-500">
                      {submission.templateName} · {submission.projectLabel} ·{" "}
                      {formatDate(submission.formDate ?? submission.createdAt)}
                    </span>
                  </span>
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                    onClick={(event) => {
                      event.preventDefault();
                      deleteSubmission(submission);
                    }}
                    title="Formular löschen"
                    type="button"
                  >
                    <ActionIcon name="delete" />
                  </button>
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {submission.fields.map((field) => (
                    <div
                      className="rounded-lg bg-gray-50 px-3 py-2 text-sm"
                      key={field.id}
                    >
                      <div className="text-xs font-semibold uppercase text-gray-500">
                        {field.label}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap font-medium text-gray-900">
                        {formatFormValue(submission.values[field.id])}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>
      </section>
    </div>
  );

  function updateTemplateField(
    index: number,
    patch: Partial<TemplateDraftField>,
  ) {
    setTemplateFields((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...patch } : field,
      ),
    );
  }

  function removeTemplateField(index: number) {
    setTemplateFields((current) =>
      current.filter((_, fieldIndex) => fieldIndex !== index),
    );
  }
}

function ProjectFormFieldInput({ field }: { field: ProjectFormFieldDefinition }) {
  const name = `field:${field.id}`;

  if (field.type === "textarea") {
    return (
      <label>
        <FieldLabel field={field} />
        <textarea
          className="mt-1 min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          name={name}
          required={field.required}
        />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label>
        <FieldLabel field={field} />
        <select
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          name={name}
          required={field.required}
        >
          <option value="">Bitte wählen</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800">
        <input name={name} required={field.required} type="checkbox" />
        {field.label}
      </label>
    );
  }

  return (
    <label>
      <FieldLabel field={field} />
      <input
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        name={name}
        required={field.required}
        step={field.type === "number" ? "0.01" : undefined}
        type={field.type}
      />
    </label>
  );
}

function FieldLabel({ field }: { field: ProjectFormFieldDefinition }) {
  return (
    <span className="text-xs font-semibold text-gray-600">
      {field.label}
      {field.required ? " *" : ""}
    </span>
  );
}

function LabeledInput({
  defaultValue,
  label,
  name,
  required = false,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label>
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function getEmptyTemplateField(): TemplateDraftField {
  return {
    label: "",
    optionsText: "",
    required: false,
    type: "text",
  };
}

function getInitialProjectId(
  projects: ProjectFormProjectOption[],
  preferredProjectId?: string,
) {
  if (preferredProjectId && projects.some((project) => project.id === preferredProjectId)) {
    return preferredProjectId;
  }

  return projects[0]?.id ?? "";
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE").format(new Date(value));
}

function formatFormValue(value: boolean | string | undefined) {
  if (typeof value === "boolean") {
    return value ? "Ja" : "Nein";
  }

  return value?.trim() || "-";
}
