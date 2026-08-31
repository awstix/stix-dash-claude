"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import { FormSignaturePad } from "@/components/FormSignaturePad";
import { FreeTextCombobox } from "@/components/FreeTextCombobox";
import {
  getProjectFormPresetOptions,
  type ProjectFormFieldDefinition,
} from "@/app/projects/projectFormTypes";
import { deleteSafetyFormSubmission, saveSafetyFormSubmission } from "../form-actions";

type SafetyFormTemplateItem = {
  category: string | null;
  description: string | null;
  fields: ProjectFormFieldDefinition[];
  id: string;
  name: string;
};

type Submission = {
  completedAt: string;
  completedByName: string | null;
  createdByName: string | null;
  formDate: string;
  id: string;
  projectId: string;
  templateId: string;
  templateName: string;
  title: string;
  values: Record<string, boolean | string>;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 placeholder:text-gray-500 outline-none focus:border-gray-900";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function SafetyFormCenter({
  employees,
  projects,
  submissions,
  templates,
}: {
  employees: { id: string; name: string }[];
  projects: { id: string; name: string; projectNumber: string }[];
  submissions: Submission[];
  templates: SafetyFormTemplateItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = submissions.find((item) => item.id === editingId) ?? null;
  const activeTemplate =
    templates.find((item) => item.id === (editing?.templateId ?? activeTemplateId)) ?? null;

  function close() {
    setActiveTemplateId(null);
    setEditingId(null);
  }

  function submit(formData: FormData) {
    if (!activeTemplate) return;
    const values: Record<string, boolean | string> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("value:")) values[key.slice(6)] = String(value);
    }
    for (const input of Array.from(
      (document.getElementById("safety-form-dialog") as HTMLFormElement | null)?.elements ?? [],
    )) {
      if (input instanceof HTMLInputElement && input.name.startsWith("value:") && input.type === "checkbox") {
        values[input.name.slice(6)] = input.checked;
      }
    }

    startTransition(async () => {
      try {
        await saveSafetyFormSubmission({
          completedAt: String(formData.get("completedAt") ?? ""),
          completedByName: String(formData.get("completedByName") ?? ""),
          createdByName: String(formData.get("createdByName") ?? ""),
          formDate: String(formData.get("formDate") ?? ""),
          id: editing?.id,
          projectId: String(formData.get("projectId") ?? ""),
          templateId: activeTemplate.id,
          title: String(formData.get("title") ?? ""),
          values,
        });
        close();
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Formular konnte nicht gespeichert werden.");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Ausgefülltes Formular wirklich löschen?")) return;
    startTransition(async () => {
      await deleteSafetyFormSubmission(id);
      router.refresh();
    });
  }

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Formular ausfüllen</h2>
          <p className="mt-1 text-sm text-gray-600">
            Vorlage auswählen und direkt im Dialog erfassen.
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <p className="mt-5 text-sm text-gray-500">
          Noch keine Formularvorlage vorhanden – unten eine neue Vorlage anlegen.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setActiveTemplateId(template.id)}
              className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-gray-900 hover:bg-gray-50"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {template.category ?? "Formular"}
              </span>
              <span className="mt-1 block font-semibold text-gray-900">{template.name}</span>
              {template.description ? (
                <span className="mt-1 block text-sm text-gray-600">{template.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {submissions.length > 0 ? (
        <div className="mt-6 border-t border-gray-200 pt-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Ausgefüllte Formulare
          </h3>
          <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {submissions.map((submission) => (
              <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-semibold text-gray-900">{submission.title}</p>
                  <p className="text-xs text-gray-500">
                    {submission.templateName}
                    {submission.formDate ? ` · ${formatDate(submission.formDate)}` : ""}
                    {submission.createdByName ? ` · ${submission.createdByName}` : ""}
                    {submission.completedAt ? " · erledigt" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(submission.id)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Bearbeiten
                  </button>
                  <Link
                    href={`/safety/forms/${submission.id}/pdf`}
                    target="_blank"
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    PDF
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(submission.id)}
                    disabled={isPending}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTemplate ? (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white text-gray-950 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{activeTemplate.name}</h2>
                <p className="text-sm text-gray-500">Formular ausfüllen</p>
              </div>
              <button type="button" onClick={close} className="text-3xl leading-none text-gray-500">
                <ActionIcon name="close" className="h-4 w-4" />
              </button>
            </div>
            <form id="safety-form-dialog" action={submit} className="p-6 text-gray-950">
              <div className="grid gap-4 md:grid-cols-4">
                <label className="text-sm font-medium text-gray-800 md:col-span-2">
                  Titel
                  <input name="title" defaultValue={editing?.title ?? activeTemplate.name} className={inputClass} />
                </label>
                <label className="text-sm font-medium text-gray-800">
                  Datum
                  <input type="date" name="formDate" defaultValue={editing?.formDate || today()} className={inputClass} />
                </label>
                <label className="text-sm font-medium text-gray-800">
                  Ausgefüllt von
                  <FreeTextCombobox
                    name="createdByName"
                    defaultValue={editing?.createdByName ?? ""}
                    className={inputClass}
                    options={employees.map((employee) => ({
                      id: employee.id,
                      label: employee.name,
                    }))}
                    suggestionsId="safety-form-personnel"
                  />
                </label>
                <label className="text-sm font-medium text-gray-800 md:col-span-4">
                  Projekt (optional)
                  <select name="projectId" defaultValue={editing?.projectId ?? ""} className={inputClass}>
                    <option value="">Ohne Projektzuordnung</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.projectNumber} · {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-6 border-t border-gray-200 pt-6">
                <SafetyFields fields={activeTemplate.fields} values={editing?.values ?? {}} />
              </div>
              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium text-gray-800">
                    Erledigt am
                    <input
                      type="date"
                      name="completedAt"
                      defaultValue={editing?.completedAt ?? ""}
                      className={inputClass}
                    />
                  </label>
                  <label className="text-sm font-medium text-gray-800">
                    Erledigt / freigegeben von
                    <FreeTextCombobox
                      name="completedByName"
                      defaultValue={editing?.completedByName ?? ""}
                      className={inputClass}
                      options={employees.map((employee) => ({
                        id: employee.id,
                        label: employee.name,
                      }))}
                      suggestionsId="safety-form-completed-by"
                    />
                  </label>
                </div>
              </div>
              <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
                <button type="button" onClick={close} className="rounded-xl border border-gray-300 px-4 py-2 font-semibold">
                  Abbrechen
                </button>
                <button disabled={isPending} className="rounded-xl bg-gray-900 px-5 py-2 font-semibold text-white disabled:opacity-50">
                  {isPending ? "Speichert…" : "Formular speichern"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SafetyFields({
  fields,
  values,
}: {
  fields: ProjectFormFieldDefinition[];
  values: Record<string, boolean | string>;
}) {
  return (
    <div className="grid grid-cols-6 gap-4">
      {fields.map((field) => (
        <div key={field.id} style={{ gridColumn: `span ${field.width}` }}>
          {field.type === "checkbox" ? (
            <Check name={field.id} label={field.label} values={values} />
          ) : field.type === "divider" || field.type === "companydata" ? (
            <div className="border-b border-gray-300 pb-2 font-semibold">{field.label}</div>
          ) : field.type === "select" ||
            field.type === "masterdata" ||
            field.type === "trafficlight" ||
            field.type === "grade" ? (
            <label className="text-sm font-medium text-gray-800">
              {field.label}
              <select name={`value:${field.id}`} defaultValue={String(values[field.id] ?? "")} required={field.required} className={inputClass}>
                <option value="">Bitte auswählen</option>
                {(field.options.length > 0
                  ? field.options
                  : getProjectFormPresetOptions(field.type)
                ).map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          ) : field.type === "signature" ? (
            <FormSignaturePad
              name={`value:${field.id}`}
              label={field.label}
              required={field.required}
              value={String(values[field.id] ?? "")}
            />
          ) : (
            <Text
              name={field.id}
              label={field.label}
              values={values}
              textarea={
                field.type === "textarea" ||
                field.type === "chart" ||
                field.type === "subform"
              }
              type={field.type === "date" || field.type === "time" || field.type === "number" ? field.type : "text"}
              required={field.required}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Text({
  label,
  name,
  required,
  textarea,
  type = "text",
  values,
}: {
  label: string;
  name: string;
  required?: boolean;
  textarea?: boolean;
  type?: "text" | "date" | "time" | "number";
  values: Record<string, boolean | string>;
}) {
  const value = String(values[name] ?? "");
  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      {textarea ? (
        <textarea name={`value:${name}`} defaultValue={value} required={required} rows={3} className={inputClass} />
      ) : (
        <input name={`value:${name}`} defaultValue={value} required={required} type={type} className={inputClass} />
      )}
    </label>
  );
}

function Check({
  label,
  name,
  values,
}: {
  label: string;
  name: string;
  values: Record<string, boolean | string>;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
      <input type="checkbox" name={`value:${name}`} defaultChecked={values[name] === true} className="h-5 w-5" />
      {label}
    </label>
  );
}

function formatDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}
