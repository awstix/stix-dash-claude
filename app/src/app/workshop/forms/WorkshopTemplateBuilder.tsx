"use client";

import { DragEvent, FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ActionIcon } from "@/components/ActionIcon";
import {
  FormTemplateFieldEditor,
  FormTemplateFieldPreview,
} from "@/components/FormTemplateFieldUI";
import {
  getProjectFormFieldTypeLabel,
  type ProjectFormFieldDefinition,
  type ProjectFormFieldType,
} from "@/app/projects/projectFormTypes";
import { deleteWorkshopFormTemplate, saveWorkshopFormTemplate } from "../form-actions";

type Template = {
  category: string | null;
  description: string | null;
  emailRecipients: string[];
  fields: ProjectFormFieldDefinition[];
  id: string;
  isRepairTemplate: boolean;
  name: string;
  paperOrientation: string;
  paperSize: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 placeholder:text-gray-500 outline-none focus:border-gray-900";

export function WorkshopTemplateBuilder({
  templates,
}: {
  templates: Template[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Template | null>(null);
  const [fields, setFields] = useState<ProjectFormFieldDefinition[]>([]);
  const [dragged, setDragged] = useState<number | null>(null);
  const [dragTarget, setDragTarget] = useState<number | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);

  function start(template?: Template) {
    setEditing(
      template ?? {
        category: "Werkstatt",
        description: "",
        emailRecipients: [],
        fields: [],
        id: "",
        isRepairTemplate: false,
        name: "",
        paperOrientation: "PORTRAIT",
        paperSize: "A4",
      },
    );
    setFields(template?.fields ?? []);
    setEditingFieldIndex(null);
  }

  function addField(type: ProjectFormFieldType = "text") {
    const index = fields.length;
    setFields((current) => [
      ...current,
      {
        description: "",
        id: `workshop-field-${Date.now().toString(36)}-${current.length + 1}`,
        label: getProjectFormFieldTypeLabel(type),
        options: [],
        required: false,
        type,
        width: 6,
      },
    ]);
    setEditingFieldIndex(index);
  }

  function move(event: DragEvent, target: number) {
    event.preventDefault();
    if (dragged === null || dragged === target) return;

    setFields((current) => {
      const next = [...current];
      const [item] = next.splice(dragged, 1);
      next.splice(target, 0, item);
      return next;
    });
    setDragged(target);
    setDragTarget(target);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await saveWorkshopFormTemplate({
          category: String(data.get("category") ?? ""),
          description: String(data.get("description") ?? ""),
          emailRecipients: String(data.get("emailRecipients") ?? "")
            .split(/[\n,;]/)
            .map((value) => value.trim())
            .filter(Boolean),
          fields,
          id: editing?.id || undefined,
          name: String(data.get("name") ?? ""),
          paperOrientation: String(data.get("paperOrientation") ?? ""),
          paperSize: String(data.get("paperSize") ?? ""),
        });
        setEditing(null);
        setFields([]);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Vorlage konnte nicht gespeichert werden.",
        );
      }
    });
  }

  function deleteTemplate(template: Template) {
    if (template.isRepairTemplate) return;

    const confirmed = window.confirm(
      `Vorlage "${template.name}" wirklich löschen?\n\nBereits gespeicherte Formulare bleiben erhalten.`,
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteWorkshopFormTemplate(template.id);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Vorlage konnte nicht gelöscht werden.",
        );
      }
    });
  }

  return (
    <>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Werkstatt-Formularvorlagen
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Vorlagen direkt hier anlegen und bearbeiten. Die gespeicherten
              Werkstattformulare bleiben hier und in den Werkstattaufträgen
              nutzbar.
            </p>
          </div>
          <button
            className="w-fit rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
            onClick={() => start()}
            type="button"
          >
            + Neue Vorlage
          </button>
        </div>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm font-medium text-gray-500">
            Noch keine Werkstatt-Formularvorlagen vorhanden.
          </p>
        ) : (
          templates.map((template) => (
            <div
              key={template.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {template.category || "Werkstatt"}
              </div>
              <h2 className="mt-1 font-semibold text-gray-900">
                {template.name}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {template.fields.length} Felder · {template.paperSize}{" "}
                {template.paperOrientation === "LANDSCAPE" ? "quer" : "hoch"} ·{" "}
                {template.emailRecipients.length} Empfänger
              </p>
              {template.description ? (
                <p className="mt-2 text-sm text-gray-500">
                  {template.description}
                </p>
              ) : null}
              {template.isRepairTemplate ? (
                <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900">
                  Systemvorlage: geschützte Reparaturfelder bleiben erhalten.
                </p>
              ) : null}
              <div className="mt-4 flex gap-2">
                <button
                  aria-label="Vorlage bearbeiten"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  onClick={() => start(template)}
                  title="Vorlage bearbeiten"
                  type="button"
                >
                  <ActionIcon className="h-4 w-4" name="edit" />
                </button>
                {!template.isRepairTemplate ? (
                  <button
                    aria-label="Vorlage löschen"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60"
                    disabled={isPending}
                    onClick={() => deleteTemplate(template)}
                    title="Vorlage löschen"
                    type="button"
                  >
                    <ActionIcon className="h-4 w-4" name="delete" />
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/45 p-4">
          <form
            onSubmit={submit}
            className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white text-gray-950 shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-950">
                {editing.id
                  ? "Formularvorlage bearbeiten"
                  : "Formularvorlage erstellen"}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-3xl text-gray-500"
              >
                <ActionIcon name="close" className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-6 p-6 lg:grid-cols-[300px_1fr]">
              <aside>
                <label className="text-sm font-medium">
                  Name
                  <input
                    name="name"
                    required
                    defaultValue={editing.name}
                    className={inputClass}
                  />
                </label>
                <label className="mt-3 block text-sm font-medium">
                  Kategorie
                  <input
                    name="category"
                    defaultValue={editing.category ?? ""}
                    className={inputClass}
                  />
                </label>
                <label className="mt-3 block text-sm font-medium">
                  Beschreibung
                  <textarea
                    name="description"
                    defaultValue={editing.description ?? ""}
                    rows={3}
                    className={inputClass}
                  />
                </label>
                <label className="mt-3 block text-sm font-medium">
                  E-Mail-Verteiler
                  <textarea
                    name="emailRecipients"
                    defaultValue={editing.emailRecipients.join("\n")}
                    rows={4}
                    placeholder="Eine E-Mail pro Zeile"
                    className={inputClass}
                  />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-sm font-medium">
                    Format
                    <select
                      name="paperSize"
                      defaultValue={editing.paperSize}
                      className={inputClass}
                    >
                      <option>A4</option>
                      <option>A5</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Ausrichtung
                    <select
                      name="paperOrientation"
                      defaultValue={editing.paperOrientation}
                      className={inputClass}
                    >
                      <option value="PORTRAIT">Hoch</option>
                      <option value="LANDSCAPE">Quer</option>
                    </select>
                  </label>
                </div>
              </aside>

              <main>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Formularvorschau</h3>
                    <p className="text-sm text-gray-500">
                      Elemente frei ziehen und auf Breite 1–6 setzen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addField()}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                  >
                    + Element hinzufügen
                  </button>
                </div>
                <div className="grid grid-cols-6 grid-flow-row-dense gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  {fields.map((field, index) => (
                    <FormTemplateFieldPreview
                      field={field}
                      isDragged={dragged === index}
                      isDragTarget={dragTarget === index}
                      key={`${field.id}-${index}`}
                      onDelete={() =>
                        setFields((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      onDragEnd={() => {
                        setDragged(null);
                        setDragTarget(null);
                      }}
                      onDragStart={() => setDragged(index)}
                      onDragOver={(event) => move(event, index)}
                      onEdit={() => setEditingFieldIndex(index)}
                    />
                  ))}
                  {fields.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => addField()}
                      className="col-span-full min-h-32 rounded-xl border-2 border-dashed border-gray-300 bg-white text-sm font-semibold text-gray-500"
                    >
                      Erstes Formularelement hinzufügen
                    </button>
                  ) : null}
                </div>

                {editingFieldIndex !== null && fields[editingFieldIndex] ? (
                  <div className="mt-4">
                    <FormTemplateFieldEditor
                      field={fields[editingFieldIndex]}
                      onClose={() => setEditingFieldIndex(null)}
                      onChange={(patch) =>
                        setFields((current) =>
                          current.map((field, index) =>
                            index === editingFieldIndex
                              ? { ...field, ...patch }
                              : field,
                          ),
                        )
                      }
                    />
                  </div>
                ) : null}
              </main>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl bg-yellow-400 px-5 py-2 text-sm font-bold text-gray-950 disabled:opacity-60"
              >
                {isPending ? "Speichert…" : "Vorlage speichern"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
