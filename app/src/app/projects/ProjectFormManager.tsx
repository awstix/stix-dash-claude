"use client";

import {
  DragEvent,
  FormEvent,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import {
  createProjectFormTemplate,
  deleteProjectFormTemplate,
  deleteProjectFormSubmission,
  saveProjectFormSubmission,
  uploadProjectPhotos,
  updateProjectFormTemplate,
} from "./actions";
import {
  getProjectFormPresetOptions,
  getProjectFormFieldTypeLabel,
  projectFormFieldCollectsValue,
  projectFormFieldUsesOptions,
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

export type ProjectDailyReportFormPrefill = {
  title: string;
  values: Record<string, boolean | string>;
};

type TemplateDraftField = {
  description: string;
  label: string;
  optionsText: string;
  required: boolean;
  type: ProjectFormFieldType;
  width: number;
};

const inputClassName =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-900";
const selectClassName =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900";
const textAreaClassName =
  "mt-1 min-h-24 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-900";
const projectFormFieldTypeGroups: Array<{
  label: string;
  types: ProjectFormFieldType[];
}> = [
  {
    label: "Eingaben",
    types: ["text", "textarea", "number", "date", "time"],
  },
  {
    label: "Auswahl",
    types: ["select", "checkbox", "masterdata", "trafficlight", "grade"],
  },
  {
    label: "Medien und Nachweise",
    types: ["photo", "signature", "qrcode", "barcode", "chart"],
  },
  {
    label: "Aufbau und Logik",
    types: ["divider", "subform", "formula"],
  },
];

export function ProjectFormManager({
  dailyReportPrefills = {},
  embedded = false,
  initialProjectId,
  lockedProjectId,
  projects,
  submissions,
  templates,
}: {
  dailyReportPrefills?: Record<string, ProjectDailyReportFormPrefill>;
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
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [draggedFieldIndex, setDraggedFieldIndex] = useState<number | null>(null);
  const [dragOverFieldIndex, setDragOverFieldIndex] = useState<number | null>(
    null,
  );
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(
    null,
  );
  const [submissionFormKey, setSubmissionFormKey] = useState(0);
  const [formDate, setFormDate] = useState(getTodayInputValue());
  const [templateFields, setTemplateFields] = useState<TemplateDraftField[]>([]);
  const effectiveProjectId = lockedProjectId ?? selectedProjectId;
  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ??
    templates.find((template) => template.isActive) ??
    null;
  const selectedDailyReportPrefill =
    selectedTemplate && isDailyReportTemplate(selectedTemplate)
      ? dailyReportPrefills[formDate] ?? null
      : null;
  const editingTemplate =
    templates.find((template) => template.id === editingTemplateId) ?? null;
  const editingSubmission =
    submissions.find((submission) => submission.id === editingSubmissionId) ??
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
        const input = {
          category: String(formData.get("category") ?? ""),
          description: String(formData.get("description") ?? ""),
          fields: templateFields,
          name: String(formData.get("name") ?? ""),
        };

        if (editingTemplateId) {
          await updateProjectFormTemplate({
            ...input,
            id: editingTemplateId,
          });
        } else {
          await createProjectFormTemplate(input);
        }
        form.reset();
        setTemplateFields([]);
        setEditingFieldIndex(null);
        setEditingTemplateId(null);
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
    const photoFiles = new Map<string, File>();

    for (const field of selectedTemplate.fields) {
      const key = `field:${field.id}`;
      const entry = formData.get(key);

      if (!projectFormFieldCollectsValue(field.type)) {
        values[field.id] = "";
      } else if (field.type === "checkbox") {
        values[field.id] = entry === "on";
      } else if (field.type === "photo" && entry instanceof File) {
        if (entry.size > 0) {
          photoFiles.set(field.id, entry);
          values[field.id] = entry.name;
        } else {
          values[field.id] =
            editingSubmission &&
            typeof editingSubmission.values[field.id] === "string"
              ? editingSubmission.values[field.id]
              : "";
        }
      } else {
        values[field.id] = String(entry ?? "");
      }
    }

    startTransition(async () => {
      try {
        for (const [fieldId, file] of photoFiles) {
          const photoFormData = new FormData();
          photoFormData.set("projectId", effectiveProjectId);
          photoFormData.set("photos", file);
          photoFormData.set("compressPhotos", "on");
          photoFormData.set("takeMetadata", "on");
          photoFormData.set("availableForDailyReports", "on");
          const publicUrls = await uploadProjectPhotos(photoFormData);
          values[fieldId] = publicUrls[0] ?? file.name;
        }

        await saveProjectFormSubmission({
          createdByName: String(formData.get("createdByName") ?? ""),
          formDate: String(formData.get("formDate") ?? ""),
          id: editingSubmissionId ?? undefined,
          projectId: effectiveProjectId,
          templateId: selectedTemplate.id,
          title: String(formData.get("title") ?? ""),
          values,
        });
        form.reset();
        setEditingSubmissionId(null);
        setFormDate(getTodayInputValue());
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

  function updateFormDate(value: string) {
    setFormDate(value);
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

  function editTemplate(template: ProjectFormTemplateItem) {
    setEditingTemplateId(template.id);
    setTemplateFields(
      template.fields.map((field) => ({
        description: field.description,
        label: field.label,
        optionsText: field.options.join("\n"),
        required: field.required,
        type: field.type,
        width: field.width,
      })),
    );
    setEditingFieldIndex(null);
    setShowTemplateForm(true);
  }

  function closeTemplateForm() {
    setEditingTemplateId(null);
    setEditingFieldIndex(null);
    setTemplateFields([]);
    setShowTemplateForm(false);
  }

  function deleteTemplate(template: ProjectFormTemplateItem) {
    const confirmed = window.confirm(
      `Vorlage "${template.name}" wirklich löschen?\n\nBereits gespeicherte Formulare bleiben erhalten.`,
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteProjectFormTemplate({
          id: template.id,
        });
        if (selectedTemplateId === template.id) {
          setSelectedTemplateId(
            templates.find((item) => item.id !== template.id && item.isActive)
              ?.id ?? "",
          );
        }
        if (editingTemplateId === template.id) {
          closeTemplateForm();
        }
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Formularvorlage konnte nicht gelöscht werden.",
        );
      }
    });
  }

  function editSubmission(submission: ProjectFormSubmissionItem) {
    if (!submission.templateId) {
      alert(
        "Die ursprüngliche Vorlage wurde gelöscht. Dieses Formular kann deshalb nur noch angesehen oder gelöscht werden.",
      );
      return;
    }

    setEditingSubmissionId(submission.id);
    setSelectedTemplateId(submission.templateId);
    setSelectedProjectId(submission.projectId);
    setFormDate(
      submission.formDate
        ? submission.formDate.slice(0, 10)
        : getTodayInputValue(),
    );
    setSubmissionFormKey((current) => current + 1);
  }

  function cancelSubmissionEdit() {
    setEditingSubmissionId(null);
    setFormDate(getTodayInputValue());
    setSubmissionFormKey((current) => current + 1);
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
            onClick={() => {
              if (showTemplateForm) {
                closeTemplateForm();
              } else {
                setEditingTemplateId(null);
                setTemplateFields([]);
                setEditingFieldIndex(null);
                setShowTemplateForm(true);
              }
            }}
            type="button"
          >
            {showTemplateForm ? "Vorlage schließen" : "Vorlage anlegen"}
          </button>
        </div>

        {showTemplateForm ? (
          <form
            className="mt-4 space-y-4"
            key={editingTemplate?.id ?? "new-template"}
            onSubmit={createTemplate}
          >
            {editingTemplate ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
                Vorlage „{editingTemplate.name}“ wird bearbeitet.
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_0.8fr]">
              <LabeledInput
                defaultValue={editingTemplate?.name}
                label="Vorlagenname"
                name="name"
                required
              />
              <LabeledInput
                defaultValue={editingTemplate?.category ?? undefined}
                label="Kategorie"
                name="category"
              />
              <label className="lg:col-span-2">
                  <span className="text-xs font-semibold text-gray-600">
                    Beschreibung
                  </span>
                <textarea
                  className={textAreaClassName}
                  defaultValue={editingTemplate?.description ?? undefined}
                  name="description"
                />
              </label>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              <div className="flex flex-col gap-2 border-b border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Formularvorschau
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Am Griff frei nach links, rechts, oben oder unten ziehen.
                  </p>
                </div>
                <button
                  className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                  onClick={addTemplateField}
                  type="button"
                >
                  + Element hinzufügen
                </button>
              </div>

              {templateFields.length === 0 ? (
                <button
                  className="m-4 flex min-h-32 w-[calc(100%-2rem)] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 text-sm font-semibold text-gray-500 hover:border-gray-500 hover:text-gray-800"
                  onClick={addTemplateField}
                  type="button"
                >
                  Erstes Formularelement hinzufügen
                </button>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-6">
                  {templateFields.map((field, index) => (
                    <TemplateFieldPreview
                      field={field}
                      index={index}
                      isDragged={draggedFieldIndex === index}
                      isDragTarget={dragOverFieldIndex === index}
                      key={`${index}-${field.label}-${field.type}`}
                      moveDown={() => moveTemplateField(index, 1)}
                      moveUp={() => moveTemplateField(index, -1)}
                      onDelete={() => removeTemplateField(index)}
                      onDragEnd={finishTemplateFieldDrag}
                      onDragEnter={(event) =>
                        moveDraggedFieldTo(event, index)
                      }
                      onDragStart={(event) =>
                        startTemplateFieldDrag(event, index)
                      }
                      onDrop={(event) => dropTemplateField(event, index)}
                      onEdit={() => setEditingFieldIndex(index)}
                      total={templateFields.length}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4">
              <button
                className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
                disabled={isPending}
                type="submit"
              >
                {editingTemplate ? "Änderungen speichern" : "Vorlage speichern"}
              </button>
              {editingTemplate ? (
                <button
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={closeTemplateForm}
                  type="button"
                >
                  Abbrechen
                </button>
              ) : null}
            </div>

            {editingFieldIndex !== null &&
            templateFields[editingFieldIndex] ? (
              <TemplateFieldEditor
                field={templateFields[editingFieldIndex]}
                onChange={(patch) =>
                  updateTemplateField(editingFieldIndex, patch)
                }
                onClose={() => setEditingFieldIndex(null)}
              />
            ) : null}
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
                <div
                  className={`flex items-center gap-2 rounded-lg border p-2 ${
                    template.id === selectedTemplateId
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-800"
                  }`}
                  key={template.id}
                >
                  <button
                    className="min-w-0 flex-1 px-1 text-left text-sm"
                    onClick={() => setSelectedTemplateId(template.id)}
                    type="button"
                  >
                    <span className="font-semibold">{template.name}</span>
                    <span className="mt-1 block text-xs opacity-75">
                      {template.category || "ohne Kategorie"} ·{" "}
                      {template.fields.length} Felder
                    </span>
                  </button>
                  <button
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-current/30 hover:bg-white/10"
                    onClick={() => editTemplate(template)}
                    title="Vorlage bearbeiten"
                    type="button"
                  >
                    <ActionIcon className="h-4 w-4" name="edit" />
                  </button>
                  <button
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-current/30 hover:bg-white/10"
                    onClick={() => deleteTemplate(template)}
                    title="Vorlage löschen"
                    type="button"
                  >
                    <ActionIcon className="h-4 w-4" name="delete" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <form
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          key={`${submissionFormKey}-${selectedTemplate?.id ?? "none"}-${formDate}`}
          onSubmit={saveSubmission}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {editingSubmission ? "Formular bearbeiten" : "Formular ausfüllen"}
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
              {editingSubmission ? "Änderungen speichern" : "Formular speichern"}
            </button>
            {editingSubmission ? (
              <button
                className="w-fit rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                onClick={cancelSubmissionEdit}
                type="button"
              >
                Abbrechen
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {!lockedProjectId ? (
              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Projekt
                </span>
                <select
                  className={selectClassName}
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
                className={selectClassName}
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

            <LabeledInput
              defaultValue={
                editingSubmission?.title ??
                selectedDailyReportPrefill?.title ??
                ""
              }
              label="Titel"
              name="title"
            />
            <label>
              <span className="text-xs font-semibold text-gray-600">
                Datum
              </span>
              <input
                className={inputClassName}
                name="formDate"
                onChange={(event) => updateFormDate(event.currentTarget.value)}
                onInput={(event) => updateFormDate(event.currentTarget.value)}
                type="date"
                value={formDate}
              />
            </label>
            <LabeledInput
              defaultValue={editingSubmission?.createdByName ?? undefined}
              label="Ausgefüllt von"
              name="createdByName"
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
            {selectedTemplate?.fields.map((field) => (
              <div className={getFieldWidthClass(field.width)} key={field.id}>
                <ProjectFormFieldInput
                  defaultValue={
                    editingSubmission?.values[field.id] ??
                    selectedDailyReportPrefill?.values[field.id]
                  }
                  field={field}
                />
              </div>
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
                  <span className="flex items-center gap-2">
                    <button
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={!submission.templateId}
                      onClick={(event) => {
                        event.preventDefault();
                        editSubmission(submission);
                      }}
                      title={
                        submission.templateId
                          ? "Formular bearbeiten"
                          : "Vorlage wurde gelöscht"
                      }
                      type="button"
                    >
                      <ActionIcon className="h-4 w-4" name="edit" />
                    </button>
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
                  </span>
                </summary>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-6">
                  {submission.fields.map((field) => (
                    <div
                      className={`${getFieldWidthClass(field.width)} rounded-lg bg-gray-50 px-3 py-2 text-sm`}
                      key={field.id}
                    >
                      <div className="text-xs font-semibold uppercase text-gray-500">
                        {field.label}
                      </div>
                      <div className="mt-1 whitespace-pre-wrap font-medium text-gray-900">
                        <ProjectFormStoredValue
                          field={field}
                          value={submission.values[field.id]}
                        />
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
    setEditingFieldIndex(null);
  }

  function addTemplateField() {
    const newIndex = templateFields.length;
    setTemplateFields((current) => {
      return [...current, getEmptyTemplateField()];
    });
    setEditingFieldIndex(newIndex);
  }

  function moveTemplateField(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= templateFields.length) {
      return;
    }

    setTemplateFields((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setEditingFieldIndex(null);
  }

  function startTemplateFieldDrag(
    event: DragEvent<HTMLElement>,
    index: number,
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    setDraggedFieldIndex(index);
    setDragOverFieldIndex(index);
    setEditingFieldIndex(null);
  }

  function moveDraggedFieldTo(
    event: DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverFieldIndex(targetIndex);

    if (
      draggedFieldIndex === null ||
      draggedFieldIndex === targetIndex ||
      targetIndex < 0 ||
      targetIndex >= templateFields.length
    ) {
      return;
    }

    setTemplateFields((current) => {
      const next = [...current];
      const [movedField] = next.splice(draggedFieldIndex, 1);
      next.splice(targetIndex, 0, movedField);
      return next;
    });
    setDraggedFieldIndex(targetIndex);
  }

  function dropTemplateField(
    event: DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) {
    event.preventDefault();
    const sourceIndex =
      draggedFieldIndex ??
      Number.parseInt(event.dataTransfer.getData("text/plain"), 10);

    if (
      draggedFieldIndex === null &&
      !Number.isNaN(sourceIndex) &&
      sourceIndex !== targetIndex &&
      sourceIndex >= 0 &&
      sourceIndex < templateFields.length
    ) {
      setTemplateFields((current) => {
        const next = [...current];
        const [movedField] = next.splice(sourceIndex, 1);
        next.splice(targetIndex, 0, movedField);
        return next;
      });
    }
    finishTemplateFieldDrag();
  }

  function finishTemplateFieldDrag() {
    setDraggedFieldIndex(null);
    setDragOverFieldIndex(null);
  }
}

function TemplateFieldPreview({
  field,
  index,
  isDragged,
  isDragTarget,
  moveDown,
  moveUp,
  onDelete,
  onDragEnd,
  onDragEnter,
  onDragStart,
  onDrop,
  onEdit,
  total,
}: {
  field: TemplateDraftField;
  index: number;
  isDragged: boolean;
  isDragTarget: boolean;
  moveDown: () => void;
  moveUp: () => void;
  onDelete: () => void;
  onDragEnd: () => void;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onEdit: () => void;
  total: number;
}) {
  return (
    <div
      className={`${getFieldWidthClass(field.width)} group relative rounded-xl border bg-white p-3 shadow-sm transition ${
        isDragged
          ? "scale-[0.98] border-gray-400 opacity-45"
          : isDragTarget
            ? "border-blue-500 ring-2 ring-blue-200"
            : "border-gray-200 hover:border-gray-400"
      }`}
      onDragEnter={onDragEnter}
      onDragOver={onDragEnter}
      onDrop={onDrop}
    >
      <button
        className="block w-full text-left"
        onClick={onEdit}
        type="button"
      >
        <span className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold text-gray-800">
            {field.label || "Neues Element"}
            {field.required ? <span className="text-red-600"> *</span> : null}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
            {field.width}/6
          </span>
        </span>
        {field.description ? (
          <span className="mt-1 block text-[11px] text-gray-500">
            {field.description}
          </span>
        ) : null}
        <span className="mt-2 block">
          <TemplateFieldMock field={field} />
        </span>
      </button>
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2">
        <span className="flex items-center gap-2">
          <span
            className="cursor-grab select-none rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold tracking-widest text-gray-500 active:cursor-grabbing"
            draggable
            onDragEnd={onDragEnd}
            onDragStart={onDragStart}
            title="Element ziehen und neu anordnen"
          >
            ⠿
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {getProjectFormFieldTypeLabel(field.type)}
          </span>
        </span>
        <span className="flex gap-1">
          <button
            className="h-7 w-7 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30"
            disabled={index === 0}
            onClick={moveUp}
            title="Element nach vorne"
            type="button"
          >
            ←
          </button>
          <button
            className="h-7 w-7 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-30"
            disabled={index === total - 1}
            onClick={moveDown}
            title="Element nach hinten"
            type="button"
          >
            →
          </button>
          <button
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-700"
            onClick={onDelete}
            title="Element löschen"
            type="button"
          >
            <ActionIcon className="h-3.5 w-3.5" name="delete" />
          </button>
        </span>
      </div>
    </div>
  );
}

function TemplateFieldMock({ field }: { field: TemplateDraftField }) {
  if (field.type === "divider") {
    return <span className="block border-t-2 border-gray-300" />;
  }

  if (field.type === "checkbox") {
    return (
      <span className="flex items-center gap-2 text-xs font-medium text-gray-500">
        <span className="h-4 w-4 rounded border border-gray-300 bg-gray-50" />
        Ja / bestätigt
      </span>
    );
  }

  if (
    field.type === "textarea" ||
    field.type === "chart" ||
    field.type === "subform"
  ) {
    return (
      <span className="block h-14 rounded-lg border border-gray-300 bg-gray-50" />
    );
  }

  if (
    projectFormFieldUsesOptions(field.type) ||
    field.type === "trafficlight" ||
    field.type === "grade"
  ) {
    const options = projectFormFieldUsesOptions(field.type)
      ? getFieldOptions(field)
      : getProjectFormPresetOptions(field.type);

    return (
      <span className="flex h-9 items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 text-xs text-gray-400">
        {options[0] || "Bitte wählen"}
        <span>⌄</span>
      </span>
    );
  }

  if (field.type === "photo") {
    return (
      <span className="flex h-14 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-xs font-semibold text-gray-400">
        Foto auswählen
      </span>
    );
  }

  if (field.type === "signature") {
    return (
      <span className="flex h-14 items-end rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 pb-2 text-xs italic text-gray-400">
        Unterschrift
      </span>
    );
  }

  if (field.type === "qrcode" || field.type === "barcode") {
    return (
      <span className="flex h-12 items-center justify-center rounded-lg border border-gray-300 bg-gray-50 font-mono text-xs tracking-[0.25em] text-gray-400">
        {field.type === "qrcode" ? "▦ QR-CODE" : "|||| BARCODE ||||"}
      </span>
    );
  }

  if (field.type === "formula") {
    return (
      <span className="flex h-9 items-center rounded-lg border border-gray-300 bg-gray-100 px-3 font-mono text-xs text-gray-500">
        = Berechneter Wert
      </span>
    );
  }

  return (
    <span className="flex h-9 items-center rounded-lg border border-gray-300 bg-gray-50 px-3 text-xs text-gray-400">
      {getProjectFormFieldTypeLabel(field.type)}
    </span>
  );
}

function TemplateFieldEditor({
  field,
  onChange,
  onClose,
}: {
  field: TemplateDraftField;
  onChange: (patch: Partial<TemplateDraftField>) => void;
  onClose: () => void;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-end justify-center bg-gray-950/45 p-0 sm:items-center sm:p-5"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Formularelement bearbeiten
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Inhalt, Darstellung und Breite festlegen.
            </p>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            onClick={onClose}
            title="Schließen"
            type="button"
          >
            <ActionIcon name="close" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold text-gray-600">
                Beschriftung *
              </span>
              <input
                autoFocus
                className={inputClassName}
                onChange={(event) =>
                  onChange({ label: event.currentTarget.value })
                }
                placeholder="z.B. Ausgeführte Leistung"
                value={field.label}
              />
            </label>

            <label>
              <span className="text-xs font-semibold text-gray-600">
                Feldtyp
              </span>
              <select
                className={selectClassName}
                onChange={(event) =>
                  onChange({
                    type: event.currentTarget.value as ProjectFormFieldType,
                  })
                }
                value={field.type}
              >
                {projectFormFieldTypeGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.types.map((type) => (
                      <option key={type} value={type}>
                        {getProjectFormFieldTypeLabel(type)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <label>
              <span className="text-xs font-semibold text-gray-600">
                Pflichtfeld
              </span>
              <span className="mt-1 flex h-[42px] items-center gap-3 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-800">
                <input
                  checked={field.required}
                  onChange={(event) =>
                    onChange({ required: event.currentTarget.checked })
                  }
                  type="checkbox"
                />
                Muss ausgefüllt werden
              </span>
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold text-gray-600">
              Breite im Formular
            </span>
            <div className="mt-1 grid grid-cols-6 overflow-hidden rounded-lg border border-gray-300">
              {[1, 2, 3, 4, 5, 6].map((width) => (
                <button
                  className={`border-r border-gray-200 px-2 py-2.5 text-sm font-semibold last:border-r-0 ${
                    field.width === width
                      ? "bg-gray-900 text-white"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  key={width}
                  onClick={() => onChange({ width })}
                  type="button"
                >
                  {width}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              1 = schmal, 3 = halbe Zeile, 6 = ganze Zeile.
            </p>
          </div>

          {projectFormFieldUsesOptions(field.type) ? (
            <label>
              <span className="text-xs font-semibold text-gray-600">
                Auswahloptionen *
              </span>
              <textarea
                className={textAreaClassName}
                onChange={(event) =>
                  onChange({ optionsText: event.currentTarget.value })
                }
                placeholder={"Eine Option pro Zeile\nz.B. sonnig\nbewölkt\nRegen"}
                value={field.optionsText}
              />
              <span className="mt-1 block text-[11px] text-gray-500">
                Eine Option pro Zeile oder mit Komma trennen.
              </span>
            </label>
          ) : null}

          <label>
            <span className="text-xs font-semibold text-gray-600">
              Beschreibung / Hilfetext
            </span>
            <textarea
              className={textAreaClassName}
              onChange={(event) =>
                onChange({ description: event.currentTarget.value })
              }
              placeholder="Optionaler Hinweis für die Person, die das Formular ausfüllt"
              value={field.description}
            />
          </label>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Vorschau
            </div>
            <div className="mt-2 max-w-xl">
              <div className="text-xs font-semibold text-gray-700">
                {field.label || "Beschriftung"}
                {field.required ? <span className="text-red-600"> *</span> : null}
              </div>
              {field.description ? (
                <div className="mt-0.5 text-[11px] text-gray-500">
                  {field.description}
                </div>
              ) : null}
              <div className="mt-2">
                <TemplateFieldMock field={field} />
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end border-t border-gray-200 bg-white px-5 py-4">
          <button
            className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
            onClick={onClose}
            type="button"
          >
            Element übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectFormFieldInput({
  defaultValue,
  field,
}: {
  defaultValue?: boolean | string;
  field: ProjectFormFieldDefinition;
}) {
  const name = `field:${field.id}`;
  const textDefaultValue =
    typeof defaultValue === "string" ? defaultValue : undefined;

  if (field.type === "divider") {
    return (
      <div className="py-2">
        <div className="border-t border-gray-300" />
        {field.label ? (
          <div className="-mt-2.5 w-fit bg-white pr-3 text-xs font-semibold text-gray-600">
            {field.label}
          </div>
        ) : null}
      </div>
    );
  }

  if (
    field.type === "textarea" ||
    field.type === "chart" ||
    field.type === "subform"
  ) {
    return (
      <label>
        <FieldLabel field={field} />
        <FieldDescription field={field} />
        <textarea
          className={textAreaClassName}
          defaultValue={textDefaultValue}
          name={name}
          required={field.required}
        />
      </label>
    );
  }

  if (
    projectFormFieldUsesOptions(field.type) ||
    field.type === "trafficlight" ||
    field.type === "grade"
  ) {
    const options =
      field.options.length > 0
        ? field.options
        : getProjectFormPresetOptions(field.type);

    return (
      <label>
        <FieldLabel field={field} />
        <FieldDescription field={field} />
        <select
          className={selectClassName}
          defaultValue={textDefaultValue ?? ""}
          name={name}
          required={field.required}
        >
          <option value="">Bitte wählen</option>
          {options.map((option) => (
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
      <label className="block rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800">
        <span className="flex items-center gap-3">
          <input
            defaultChecked={defaultValue === true}
            name={name}
            required={field.required}
            type="checkbox"
          />
          {field.label}
          {field.required ? <span className="text-red-600">*</span> : null}
        </span>
        <FieldDescription field={field} />
      </label>
    );
  }

  if (field.type === "photo") {
    return (
      <label>
        <FieldLabel field={field} />
        <FieldDescription field={field} />
        <input
          accept="image/*"
          className={`${inputClassName} file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold`}
          name={name}
          required={field.required && !textDefaultValue}
          type="file"
        />
        {textDefaultValue?.startsWith("/") ? (
          <a
            className="mt-1 block text-[11px] font-semibold text-blue-700 hover:underline"
            href={textDefaultValue}
            rel="noreferrer"
            target="_blank"
          >
            Bisheriges Foto öffnen
          </a>
        ) : textDefaultValue ? (
          <span className="mt-1 block text-[11px] text-gray-500">
            Bisher gespeichert: {textDefaultValue}
          </span>
        ) : null}
      </label>
    );
  }

  if (field.type === "signature") {
    return (
      <label>
        <FieldLabel field={field} />
        <FieldDescription field={field} />
        <textarea
          className={`${textAreaClassName} min-h-20 border-dashed italic`}
          defaultValue={textDefaultValue}
          name={name}
          placeholder="Name oder Unterschrift eintragen"
          required={field.required}
        />
      </label>
    );
  }

  return (
    <label>
      <FieldLabel field={field} />
      <FieldDescription field={field} />
      <input
        className={inputClassName}
        defaultValue={textDefaultValue}
        name={name}
        required={field.required}
        placeholder={
          field.type === "qrcode"
            ? "Inhalt des QR-Codes"
            : field.type === "barcode"
              ? "Barcodewert"
              : field.type === "formula"
                ? "Formel oder berechneter Wert"
                : undefined
        }
        step={field.type === "number" ? "0.01" : undefined}
        type={getHtmlInputType(field.type)}
      />
    </label>
  );
}

function FieldDescription({ field }: { field: ProjectFormFieldDefinition }) {
  if (!field.description) {
    return null;
  }

  return (
    <span className="mt-0.5 block text-[11px] font-normal text-gray-500">
      {field.description}
    </span>
  );
}

function ProjectFormStoredValue({
  field,
  value,
}: {
  field: ProjectFormFieldDefinition;
  value: boolean | string | undefined;
}) {
  if (
    field.type === "photo" &&
    typeof value === "string" &&
    value.startsWith("/")
  ) {
    return (
      <a
        className="text-blue-700 hover:underline"
        href={value}
        rel="noreferrer"
        target="_blank"
      >
        Foto öffnen
      </a>
    );
  }

  if (field.type === "divider") {
    return <span className="text-gray-400">Trennlinie</span>;
  }

  return formatFormValue(value);
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
        className={inputClassName}
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
    description: "",
    label: "",
    optionsText: "",
    required: false,
    type: "text",
    width: 6,
  };
}

function getFieldOptions(field: TemplateDraftField) {
  return field.optionsText
    .split(/\r?\n|,/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function getHtmlInputType(type: ProjectFormFieldType) {
  if (type === "number" || type === "date" || type === "time") {
    return type;
  }

  return "text";
}

function getFieldWidthClass(width: number) {
  const classes: Record<number, string> = {
    1: "md:col-span-1",
    2: "md:col-span-2",
    3: "md:col-span-3",
    4: "md:col-span-4",
    5: "md:col-span-5",
    6: "md:col-span-6",
  };

  return classes[width] ?? classes[6];
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

function isDailyReportTemplate(template: ProjectFormTemplateItem) {
  const templateText = normalizeSearchText(
    [template.name, template.category, template.description].join(" "),
  );
  const fieldIds = new Set(template.fields.map((field) => field.id));

  return (
    templateText.includes("bautagesbericht") ||
    (fieldIds.has("wetter") &&
      fieldIds.has("personal") &&
      fieldIds.has("leistung"))
  );
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
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
