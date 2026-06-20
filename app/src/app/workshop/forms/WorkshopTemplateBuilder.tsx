"use client";

import { DragEvent, FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getProjectFormPresetOptions,
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

const typeGroups: Array<{ label: string; types: ProjectFormFieldType[] }> = [
  { label: "Eingaben", types: ["text", "textarea", "number", "date", "time"] },
  { label: "Auswahl", types: ["select", "checkbox", "masterdata", "trafficlight", "grade"] },
  { label: "Medien und Nachweise", types: ["photo", "signature", "qrcode", "barcode", "chart"] },
  { label: "Aufbau und Logik", types: ["companydata", "divider", "subform", "formula"] },
];
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
    <div
      className={`group rounded-xl border bg-white p-3 shadow-sm transition ${
        isDragged
          ? "scale-[0.98] border-gray-400 opacity-45"
          : isDragTarget
            ? "border-blue-500 ring-2 ring-blue-200"
            : "border-gray-200 hover:border-gray-400"
      }`}
      style={{ gridColumn: `span ${Math.max(1, Math.min(6, field.width))} / span ${Math.max(1, Math.min(6, field.width))}` }}
      onDragEnter={onDragOver}
      onDragOver={onDragOver}
    >
      <button className="block w-full text-left" onClick={onEdit} type="button">
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
          <WorkshopFieldMock field={field} />
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
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
            onClick={onEdit}
            title="Element bearbeiten"
            type="button"
          >
            <ActionIcon name="edit" className="h-3.5 w-3.5" />
          </button>
          {onDelete ? (
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-700"
              onClick={onDelete}
              title="Element löschen"
              type="button"
            >
              <ActionIcon name="delete" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function WorkshopFieldMock({ field }: { field: ProjectFormFieldDefinition }) {
  if (field.type === "companydata") {
    return (
      <span className="grid grid-cols-[64px_1fr] items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <span className="flex h-12 items-center justify-center rounded bg-white text-xs font-black text-gray-700">LOGO</span>
        <span>
          <span className="block text-xs font-semibold text-gray-700">Firmenname und Anschrift</span>
          <span className="mt-1 block text-[10px] text-gray-400">Kontakt · Website · Social Media</span>
        </span>
      </span>
    );
  }
  if (field.type === "divider") return <span className="block border-t-2 border-gray-300" />;
  if (field.type === "checkbox") {
    return <span className="flex items-center gap-2 text-xs text-gray-500"><span className="h-4 w-4 rounded border" /> Ja / bestätigt</span>;
  }
  if (field.type === "textarea" || field.type === "chart" || field.type === "subform") {
    return <span className="block h-14 rounded-lg border border-gray-300 bg-gray-50" />;
  }
  if (field.type === "photo" || field.type === "signature") {
    return <span className="flex h-14 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-xs font-semibold text-gray-400">{getProjectFormFieldTypeLabel(field.type)}</span>;
  }
  if (field.type === "select" || field.type === "masterdata" || field.type === "trafficlight" || field.type === "grade") {
    const options =
      field.options.length > 0
        ? field.options
        : getProjectFormPresetOptions(field.type);
    return <span className="flex h-9 items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 text-xs text-gray-400">{options[0] || "Bitte wählen"} <span>⌄</span></span>;
  }
  return <span className="flex h-9 items-center rounded-lg border border-gray-300 bg-gray-50 px-3 text-xs text-gray-400">{getProjectFormFieldTypeLabel(field.type)}</span>;
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
}
