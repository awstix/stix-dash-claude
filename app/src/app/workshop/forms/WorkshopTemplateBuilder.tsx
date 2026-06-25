"use client";

import { DragEvent, FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getProjectFormFieldTypeLabel,
  type ProjectFormFieldDefinition,
  type ProjectFormFieldType,
} from "@/app/projects/projectFormTypes";
import {
  deleteWorkshopFormTemplate,
  saveWorkshopFormTemplate,
} from "../form-actions";
import { ActionIcon } from "@/components/ActionIcon";
import { WORKSHOP_REPAIR_SYSTEM_FIELD_IDS } from "../repairOrderTemplateConfig";
import {
  FormTemplateFieldEditor,
  FormTemplateFieldPreview,
} from "@/components/FormTemplateFieldUI";

type Template = {
  category: string | null;
  description: string | null;
  fields: ProjectFormFieldDefinition[];
  id: string;
  isRepairTemplate: boolean;
  name: string;
  paperOrientation: string;
  paperSize: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 placeholder:text-gray-500 outline-none focus:border-gray-900";

export function WorkshopTemplateBuilder({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Template | null>(null);
  const [fields, setFields] = useState<ProjectFormFieldDefinition[]>([]);
  const [dragged, setDragged] = useState<number | null>(null);
  const [dragTarget, setDragTarget] = useState<number | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);

  function start(template?: Template) {
    setEditing(template ?? {
      category: "Werkstatt",
      description: "",
      fields: [],
      id: "",
      isRepairTemplate: false,
      name: "",
      paperOrientation: "PORTRAIT",
      paperSize: "A4",
    });
    setFields(template?.fields ?? []);
    setEditingFieldIndex(null);
  }

  function addField(type: ProjectFormFieldType = "text") {
    const index = fields.length;
    setFields((current) => [
      ...current,
      {
        description: "",
        id: `field-${Date.now().toString(36)}-${current.length + 1}`,
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
        alert(error instanceof Error ? error.message : "Vorlage konnte nicht gespeichert werden.");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Eigene Werkstattformulare mit frei anordenbaren Feldern erstellen.
        </p>
        <button onClick={() => start()} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          + Neue Vorlage
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <div key={template.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{template.category || "Werkstatt"}</div>
            <h2 className="mt-1 font-semibold text-gray-900">{template.name}</h2>
            <p className="mt-2 text-sm text-gray-600">{template.fields.length} Felder · {template.paperSize} {template.paperOrientation === "LANDSCAPE" ? "quer" : "hoch"}</p>
            {template.isRepairTemplate ? (
              <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900">
                Verbundene Systemvorlage: Änderungen gelten für echte Reparaturaufträge.
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => start(template)}
                title="Vorlage bearbeiten"
                aria-label="Vorlage bearbeiten"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                <ActionIcon name="edit" className="h-4 w-4" />
              </button>
              {!template.isRepairTemplate ? <button
                onClick={() => confirm("Vorlage wirklich löschen?") && startTransition(async () => {
                  await deleteWorkshopFormTemplate(template.id);
                  router.refresh();
                })}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700"
              >
                Löschen
              </button> : null}
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4">
          <form onSubmit={submit} className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white text-gray-950 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-950">{editing.id ? "Formularvorlage bearbeiten" : "Formularvorlage erstellen"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="text-3xl text-gray-500">×</button>
            </div>
            <div className="grid gap-6 p-6 lg:grid-cols-[280px_1fr]">
              <aside>
                <label className="text-sm font-medium">Name<input name="name" required defaultValue={editing.name} className={inputClass} /></label>
                <label className="mt-3 block text-sm font-medium">Kategorie<input name="category" defaultValue={editing.category ?? ""} className={inputClass} /></label>
                <label className="mt-3 block text-sm font-medium">Beschreibung<textarea name="description" defaultValue={editing.description ?? ""} rows={3} className={inputClass} /></label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-sm font-medium">Format<select name="paperSize" defaultValue={editing.paperSize} className={inputClass}><option>A4</option><option>A5</option></select></label>
                  <label className="text-sm font-medium">Ausrichtung<select name="paperOrientation" defaultValue={editing.paperOrientation} className={inputClass}><option value="PORTRAIT">Hoch</option><option value="LANDSCAPE">Quer</option></select></label>
                </div>
                {editing.isRepairTemplate ? (
                  <p className="mt-6 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-950">
                    Bestehende Systemfelder sind geschützt. Neue Zusatzfelder können frei ergänzt und wieder gelöscht werden.
                  </p>
                ) : null}
              </aside>
              <main>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Formularvorschau</h3>
                    <p className="text-sm text-gray-500">
                      Am Griff frei nach links, rechts, oben oder unten ziehen.
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
                    (() => {
                    const protectedRepairField =
                      editing.isRepairTemplate &&
                      WORKSHOP_REPAIR_SYSTEM_FIELD_IDS.has(field.id);
                    return (
                    <WorkshopFieldPreview
                      field={field}
                      isDragged={dragged === index}
                      isDragTarget={dragTarget === index}
                      key={`${field.id}-${index}`}
                      onDelete={
                        protectedRepairField
                          ? undefined
                          : () =>
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
                    );
                    })()
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
              </main>
            </div>
            {editingFieldIndex !== null && fields[editingFieldIndex] ? (
              <WorkshopFieldEditor
                field={fields[editingFieldIndex]}
                protectedField={
                  editing.isRepairTemplate &&
                  WORKSHOP_REPAIR_SYSTEM_FIELD_IDS.has(
                    fields[editingFieldIndex].id,
                  )
                }
                onChange={(patch) =>
                  setFields((current) =>
                    current.map((field, index) =>
                      index === editingFieldIndex
                        ? { ...field, ...patch }
                        : field,
                    ),
                  )
                }
                onClose={() => setEditingFieldIndex(null)}
              />
            ) : null}
            <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-white px-6 py-4">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-gray-300 px-4 py-2 font-semibold">Abbrechen</button>
              <button disabled={isPending} className="rounded-xl bg-gray-900 px-5 py-2 font-semibold text-white disabled:opacity-50">{isPending ? "Speichert…" : "Vorlage speichern"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function WorkshopFieldPreview({
  field,
  isDragged,
  isDragTarget,
  onDelete,
  onDragEnd,
  onDragOver,
  onDragStart,
  onEdit,
}: {
  field: ProjectFormFieldDefinition;
  isDragged: boolean;
  isDragTarget: boolean;
  onDelete?: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart: () => void;
  onEdit: () => void;
}) {
  return (
    <FormTemplateFieldPreview
      field={field}
      isDragged={isDragged}
      isDragTarget={isDragTarget}
      onDelete={onDelete}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={() => onDragStart()}
      onEdit={onEdit}
    />
  );
}

function WorkshopFieldEditor({
  field,
  onChange,
  onClose,
  protectedField,
}: {
  field: ProjectFormFieldDefinition;
  onChange: (patch: Partial<ProjectFormFieldDefinition>) => void;
  onClose: () => void;
  protectedField: boolean;
}) {
  return (
    <FormTemplateFieldEditor
      field={field}
      onChange={onChange}
      onClose={onClose}
      protectedType={protectedField}
    />
  );
  /*
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-gray-950/45 sm:items-center sm:p-5">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Formularelement bearbeiten</h3>
            <p className="text-xs text-gray-500">Inhalt, Darstellung und Breite festlegen.</p>
          </div>
          <button onClick={onClose} type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-600">
            <ActionIcon name="close" />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Beschriftung *</span>
            <input autoFocus value={field.label} onChange={(event) => onChange({ label: event.currentTarget.value })} className={inputClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-xs font-semibold text-gray-600">Feldtyp</span>
              <select
                disabled={protectedField}
                value={field.type}
                onChange={(event) => onChange({ type: event.currentTarget.value as ProjectFormFieldType })}
                className={inputClass}
              >
                {typeGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.types.map((type) => <option key={type} value={type}>{getProjectFormFieldTypeLabel(type)}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-gray-600">Pflichtfeld</span>
              <span className="mt-1 flex h-[42px] items-center gap-3 rounded-lg border border-gray-300 px-3 text-sm font-medium">
                <input type="checkbox" checked={field.required} onChange={(event) => onChange({ required: event.currentTarget.checked })} />
                Muss ausgefüllt werden
              </span>
            </label>
          </div>
          <div>
            <span className="text-xs font-semibold text-gray-600">Breite im Formular</span>
            <div className="mt-1 grid grid-cols-6 overflow-hidden rounded-lg border border-gray-300">
              {[1, 2, 3, 4, 5, 6].map((width) => (
                <button key={width} type="button" onClick={() => onChange({ width })} className={`border-r px-2 py-2.5 text-sm font-semibold last:border-r-0 ${field.width === width ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}>{width}</button>
              ))}
            </div>
          </div>
          {(field.type === "select" || field.type === "masterdata") ? (
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Auswahloptionen</span>
              <textarea
                rows={5}
                value={field.options.join("\n")}
                onChange={(event) => onChange({ options: event.currentTarget.value.split(/\n|,/).map((value) => value.trim()).filter(Boolean) })}
                className={inputClass}
                placeholder="Eine Option pro Zeile"
              />
            </label>
          ) : null}
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Beschreibung / Hinweis</span>
            <textarea rows={3} value={field.description} onChange={(event) => onChange({ description: event.currentTarget.value })} className={inputClass} />
          </label>
          {protectedField ? <p className="rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-950">Dieses Systemfeld kann beschriftet, gestaltet und verschoben werden. Technischer Typ und Zuordnung bleiben geschützt.</p> : null}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white">Übernehmen</button>
          </div>
        </div>
      </div>
    </div>
  );
  */
}
