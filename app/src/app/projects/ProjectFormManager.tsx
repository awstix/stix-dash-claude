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
  projectFormFieldCollectsValue,
  projectFormFieldUsesOptions,
} from "./projectFormTypes";
import type {
  ProjectFormFieldDefinition,
  ProjectFormPaperOrientation,
  ProjectFormPaperSize,
  ProjectFormFieldType,
} from "./projectFormTypes";
import {
  FormTemplateFieldEditor,
  FormTemplateFieldPreview,
} from "@/components/FormTemplateFieldUI";

export type ProjectFormProjectOption = {
  id: string;
  label: string;
};

export type ProjectFormTemplateItem = {
  category: string | null;
  description: string | null;
  emailRecipients: string[];
  fields: ProjectFormFieldDefinition[];
  id: string;
  isActive: boolean;
  name: string;
  paperOrientation: ProjectFormPaperOrientation;
  paperSize: ProjectFormPaperSize;
  sortOrder: number;
};

export type ProjectFormSubmissionItem = {
  createdAt: string;
  createdByName: string | null;
  fields: ProjectFormFieldDefinition[];
  formDate: string | null;
  id: string;
  paperOrientation: ProjectFormPaperOrientation;
  paperSize: ProjectFormPaperSize;
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

export type ProjectFormCompanyInfo = {
  city: string | null;
  companyName: string;
  country: string | null;
  email: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  legalName: string | null;
  linkedinUrl: string | null;
  logoPublicUrl: string | null;
  mobile: string | null;
  phone: string | null;
  postalCode: string | null;
  street: string | null;
  tiktokUrl: string | null;
  website: string | null;
  youtubeUrl: string | null;
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
export function ProjectFormManager({
  companyInfo,
  dailyReportPrefills = {},
  embedded = false,
  initialProjectId,
  lockedProjectId,
  projects,
  submissions,
  templates,
}: {
  companyInfo: ProjectFormCompanyInfo;
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
  const [showSubmissionForm, setShowSubmissionForm] = useState(!embedded);
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
          emailRecipients: String(formData.get("emailRecipients") ?? "")
            .split(/[\n,;]/)
            .map((value) => value.trim())
            .filter(Boolean),
          fields: templateFields,
          name: String(formData.get("name") ?? ""),
          paperOrientation: String(formData.get("paperOrientation") ?? ""),
          paperSize: String(formData.get("paperSize") ?? ""),
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
        if (embedded) {
          setShowSubmissionForm(false);
        }
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
    router.push(`/form-builder?scope=PROJECT&templateId=${template.id}`);
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
    setShowSubmissionForm(true);
  }

  function closeSubmissionForm() {
    setEditingSubmissionId(null);
    setShowSubmissionForm(!embedded);
    setFormDate(getTodayInputValue());
    setSubmissionFormKey((current) => current + 1);
  }

  function openSubmissionForm() {
    if (!selectedTemplate) {
      alert("Bitte zuerst eine Formularvorlage auswählen.");
      return;
    }

    setEditingSubmissionId(null);
    setFormDate(getTodayInputValue());
    setSubmissionFormKey((current) => current + 1);
    setShowSubmissionForm(true);
  }

  return (
    <div className="space-y-5">
      {!embedded ? (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Formulare</h2>
            <p className="mt-1 text-sm text-gray-600">
              Formulare projektbezogen ausfüllen und in der Projektakte speichern.
              Vorlagen werden zentral im Formularbuilder gepflegt.
            </p>
          </div>
          <button
            className="w-fit rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            onClick={() => router.push("/form-builder?scope=PROJECT")}
            type="button"
          >
            Formularvorlage anlegen
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
              <label className="lg:col-span-2">
                <span className="text-xs font-semibold text-gray-600">
                  E-Mail-Verteiler
                </span>
                <textarea
                  className={textAreaClassName}
                  defaultValue={editingTemplate?.emailRecipients.join("\n")}
                  name="emailRecipients"
                  placeholder="Eine E-Mail pro Zeile. Beim Speichern/Ausfüllen kann daraus später automatisch versendet werden."
                />
              </label>
              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Papierformat
                </span>
                <select
                  className={selectClassName}
                  defaultValue={editingTemplate?.paperSize ?? "A4"}
                  name="paperSize"
                >
                  <option value="A4">DIN A4</option>
                  <option value="A5">DIN A5</option>
                </select>
              </label>
              <label>
                <span className="text-xs font-semibold text-gray-600">
                  Ausrichtung
                </span>
                <select
                  className={selectClassName}
                  defaultValue={
                    editingTemplate?.paperOrientation ?? "PORTRAIT"
                  }
                  name="paperOrientation"
                >
                  <option value="PORTRAIT">Hochformat</option>
                  <option value="LANDSCAPE">Querformat</option>
                </select>
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
      ) : null}

      <section
        className={
          embedded
            ? ""
            : "grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]"
        }
      >
        {embedded ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900">
                  Formulare
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Vorlage auswählen und kompakt in einem eigenen Fenster ausfüllen.
                </p>
                <label className="mt-4 block max-w-2xl">
                  <span className="text-xs font-semibold text-gray-600">
                    Formularvorlage
                  </span>
                  <select
                    className={selectClassName}
                    onChange={(event) => {
                      setSelectedTemplateId(event.currentTarget.value);
                      setEditingSubmissionId(null);
                    }}
                    value={selectedTemplateId}
                  >
                    <option value="">Vorlage auswählen</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.category ? ` · ${template.category}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedTemplate ? (
                  <p className="mt-2 text-xs text-gray-500">
                    {selectedTemplate.fields.length} Felder ·{" "}
                    {selectedTemplate.paperSize}{" "}
                    {selectedTemplate.paperOrientation === "LANDSCAPE"
                      ? "quer"
                      : "hoch"}
                    {selectedTemplate.description
                      ? ` · ${selectedTemplate.description}`
                      : ""}
                  </p>
                ) : null}
              </div>
              <button
                className="w-fit rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
                disabled={!selectedTemplate}
                onClick={openSubmissionForm}
                type="button"
              >
                Formular ausfüllen
              </button>
            </div>
          </div>
        ) : (
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
                      {template.fields.length} Felder · {template.paperSize}{" "}
                      {template.paperOrientation === "LANDSCAPE"
                        ? "quer"
                        : "hoch"}
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
        )}

        {showSubmissionForm ? (
        <div
          className={
            embedded
              ? "fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-gray-950/50 p-0 sm:items-center sm:p-5"
              : ""
          }
        >
        <form
          className={
            embedded
              ? "max-h-[94vh] w-full overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-5 shadow-2xl sm:max-w-5xl sm:rounded-2xl"
              : "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          }
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
            <div className="flex flex-wrap gap-2">
              {embedded || editingSubmission ? (
              <button
                className="w-fit rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                onClick={closeSubmissionForm}
                type="button"
              >
                {embedded ? "Fenster schließen" : "Abbrechen"}
              </button>
              ) : null}
              <button
                className="w-fit rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
                disabled={isPending || !selectedTemplate || !effectiveProjectId}
                type="submit"
              >
                {editingSubmission ? "Änderungen speichern" : "Formular speichern"}
              </button>
            </div>
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
                  companyInfo={companyInfo}
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
        </div>
        ) : null}
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
                    <a
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                      href={`/projects/formulare/${submission.id}/pdf`}
                      title="Formular als PDF herunterladen"
                    >
                      <ActionIcon className="h-4 w-4" name="download" />
                    </a>
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
  onEdit: () => void;
  total: number;
}) {
  return (
    <FormTemplateFieldPreview
      field={{
        ...field,
        options: getFieldOptions(field),
      }}
      isDragged={isDragged}
      isDragTarget={isDragTarget}
      moveBackward={index === 0 ? undefined : moveUp}
      moveForward={index === total - 1 ? undefined : moveDown}
      onDelete={onDelete}
      onDragEnd={onDragEnd}
      onDragOver={onDragEnter}
      onDragStart={onDragStart}
      onEdit={onEdit}
    />
  );
  /*
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
  */
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
    <FormTemplateFieldEditor
      field={{
        ...field,
        options: getFieldOptions(field),
      }}
      onChange={(patch) =>
        onChange({
          ...patch,
          ...(patch.options
            ? { optionsText: patch.options.join("\n") }
            : {}),
        })
      }
      onClose={onClose}
    />
  );
  /*
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-gray-950/45 p-0 sm:items-center sm:p-5"
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
                    ...(!field.label &&
                    event.currentTarget.value === "companydata"
                      ? { label: "Firmendaten" }
                      : {}),
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
  */
}

function ProjectFormFieldInput({
  companyInfo,
  defaultValue,
  field,
}: {
  companyInfo: ProjectFormCompanyInfo;
  defaultValue?: boolean | string;
  field: ProjectFormFieldDefinition;
}) {
  const name = `field:${field.id}`;
  const textDefaultValue =
    typeof defaultValue === "string" ? defaultValue : undefined;

  if (field.type === "companydata") {
    return <CompanyInfoBlock companyInfo={companyInfo} />;
  }

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

function CompanyInfoBlock({
  companyInfo,
}: {
  companyInfo: ProjectFormCompanyInfo;
}) {
  const address = [
    companyInfo.street,
    [companyInfo.postalCode, companyInfo.city].filter(Boolean).join(" "),
  ].filter(Boolean);
  const contacts = [
    companyInfo.phone,
    companyInfo.mobile,
    companyInfo.email,
    companyInfo.website ? formatWebsiteLabel(companyInfo.website) : null,
  ].filter(Boolean);
  const socials = [
    { name: "Instagram", type: "instagram", url: companyInfo.instagramUrl },
    { name: "LinkedIn", type: "linkedin", url: companyInfo.linkedinUrl },
    { name: "Facebook", type: "facebook", url: companyInfo.facebookUrl },
    { name: "YouTube", type: "youtube", url: companyInfo.youtubeUrl },
    { name: "TikTok", type: "tiktok", url: companyInfo.tiktokUrl },
  ].filter(
    (
      social,
    ): social is {
      name: string;
      type: "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube";
      url: string;
    } => Boolean(social.url),
  );

  return (
    <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-[160px_1fr] sm:items-center">
      <div className="flex min-h-24 items-center justify-center rounded-lg bg-white p-3">
        {companyInfo.logoPublicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${companyInfo.companyName} Logo`}
            className="max-h-20 max-w-full object-contain"
            src={companyInfo.logoPublicUrl}
          />
        ) : (
          <span className="text-xl font-black tracking-wide text-gray-800">
            {companyInfo.companyName}
          </span>
        )}
      </div>
      <div className="text-sm text-gray-700">
        <div className="font-semibold text-gray-900">
          {companyInfo.companyName}
        </div>
        {companyInfo.legalName ? <div>{companyInfo.legalName}</div> : null}
        {address.length ? <div className="mt-1">{address.join(" · ")}</div> : null}
        {contacts.length ? <div className="mt-1">{contacts.join(" · ")}</div> : null}
        {socials.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {socials.map((social) => (
              <a
                aria-label={social.name}
                className="inline-flex h-8 items-center gap-2 rounded-full border border-gray-300 bg-white px-2.5 text-gray-700 transition hover:border-gray-500 hover:bg-gray-100"
                href={social.url}
                key={social.type}
                rel="noreferrer"
                target="_blank"
                title={social.name}
              >
                <SocialMediaIcon type={social.type} />
                <span className="text-xs font-semibold">
                  {getSocialMediaAccountName(social.type, social.url)}
                </span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatWebsiteLabel(value: string) {
  try {
    return new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    ).hostname.replace(/^www\./i, "");
  } catch {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
  }
}

function getSocialMediaAccountName(
  type: "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube",
  value: string,
) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const rawName =
      type === "linkedin" && segments[0] === "company"
        ? segments[1]
        : segments[0];

    if (!rawName) {
      return url.hostname.replace(/^www\./, "");
    }

    const decoded = decodeURIComponent(rawName);
    return decoded.startsWith("@") ? decoded : `@${decoded}`;
  } catch {
    const cleaned = value.trim().replace(/^@/, "");
    return cleaned ? `@${cleaned}` : "";
  }
}

function SocialMediaIcon({
  type,
}: {
  type: "facebook" | "instagram" | "linkedin" | "tiktok" | "youtube";
}) {
  if (type === "linkedin") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
        <path
          d="M6.5 8.4H3.3V21h3.2ZM4.9 3A1.9 1.9 0 1 0 5 6.8 1.9 1.9 0 0 0 4.9 3ZM21 13.8c0-3.8-2-5.6-4.7-5.6-2.2 0-3.1 1.2-3.7 2v-1.7H9.4V21h3.2v-6.2c0-1.6.3-3.2 2.3-3.2 2 0 2 1.8 2 3.3V21H20Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (type === "facebook") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
        <path
          d="M14 8.5V6.7c0-.8.5-1 1-1h2V3h-2.8C11.4 3 11 5.1 11 6.5v2H9v3h2V21h3v-9.5h2.7l.4-3Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (type === "youtube") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
        <path
          d="M7.6 7.4h8.8a2 2 0 0 1 2 2v5.2a2 2 0 0 1-2 2H7.6a2 2 0 0 1-2-2V9.4a2 2 0 0 1 2-2Z"
          fill="currentColor"
        />
        <path d="M10.9 9.35v5.3L15.3 12Z" fill="#111827" />
      </svg>
    );
  }

  if (type === "tiktok") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
        <path
          d="M15 3c.3 2.1 1.5 3.4 3.5 3.8v3a8 8 0 0 1-3.5-1v6.1A6.1 6.1 0 1 1 9.7 9v3.1a3.1 3.1 0 1 0 2.3 3V3Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <rect
        height="16"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        width="16"
        x="4"
        y="4"
      />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" fill="currentColor" r="1" />
    </svg>
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
