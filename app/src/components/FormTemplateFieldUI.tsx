"use client";

import { ActionIcon } from "./ActionIcon";
import type { DragEvent } from "react";
import {
  getProjectFormFieldTypeLabel,
  getProjectFormPresetOptions,
  type ProjectFormFieldType,
} from "@/app/projects/projectFormTypes";

export type FormTemplateUiField = {
  description: string;
  label: string;
  options: string[];
  required: boolean;
  type: ProjectFormFieldType;
  width: number;
};

export const formTemplateFieldTypeGroups: Array<{
  label: string;
  types: ProjectFormFieldType[];
}> = [
  { label: "Eingaben", types: ["text", "textarea", "number", "date", "time"] },
  { label: "Auswahl", types: ["select", "checkbox", "masterdata", "trafficlight", "grade"] },
  { label: "Medien und Nachweise", types: ["photo", "signature", "qrcode", "barcode", "chart"] },
  { label: "Aufbau und Logik", types: ["companydata", "divider", "subform", "formula"] },
];

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 outline-none focus:border-gray-900";

export function FormTemplateFieldMock({ field }: { field: FormTemplateUiField }) {
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
  if (field.type === "checkbox") return <span className="flex items-center gap-2 text-xs text-gray-500"><span className="h-4 w-4 rounded border" /> Ja / bestätigt</span>;
  if (field.type === "textarea" || field.type === "chart" || field.type === "subform") return <span className="block h-14 rounded-lg border border-gray-300 bg-gray-50" />;
  if (field.type === "photo" || field.type === "signature") return <span className="flex h-14 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-xs font-semibold text-gray-400">{getProjectFormFieldTypeLabel(field.type)}</span>;
  if (["select", "masterdata", "trafficlight", "grade"].includes(field.type)) {
    const options = field.options.length > 0 ? field.options : getProjectFormPresetOptions(field.type);
    return <span className="flex h-9 items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 text-xs text-gray-400">{options[0] || "Bitte wählen"} <span>⌄</span></span>;
  }
  if (field.type === "qrcode" || field.type === "barcode") return <span className="flex h-12 items-center justify-center rounded-lg border bg-gray-50 font-mono text-xs tracking-widest text-gray-400">{field.type === "qrcode" ? "▦ QR-CODE" : "|||| BARCODE ||||"}</span>;
  if (field.type === "formula") return <span className="flex h-9 items-center rounded-lg border bg-gray-100 px-3 font-mono text-xs text-gray-500">= Berechneter Wert</span>;
  return <span className="flex h-9 items-center rounded-lg border border-gray-300 bg-gray-50 px-3 text-xs text-gray-400">{getProjectFormFieldTypeLabel(field.type)}</span>;
}

export function FormTemplateFieldPreview({
  field,
  isDragged,
  isDragTarget,
  moveBackward,
  moveForward,
  onDelete,
  onDragEnd,
  onDragOver,
  onDragStart,
  onEdit,
}: {
  field: FormTemplateUiField;
  isDragged: boolean;
  isDragTarget: boolean;
  moveBackward?: () => void;
  moveForward?: () => void;
  onDelete?: () => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onEdit: () => void;
}) {
  const width = Math.max(1, Math.min(6, field.width));
  return (
    <div
      className={`group rounded-xl border bg-white p-3 shadow-sm transition ${
        isDragged
          ? "scale-[0.98] border-gray-400 opacity-45"
          : isDragTarget
            ? "border-blue-500 ring-2 ring-blue-200"
            : "border-gray-200 hover:border-gray-400"
      }`}
      style={{ gridColumn: `span ${width} / span ${width}` }}
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
            {width}/6
          </span>
        </span>
        {field.description ? (
          <span className="mt-1 block text-[11px] text-gray-500">
            {field.description}
          </span>
        ) : null}
        <span className="mt-2 block">
          <FormTemplateFieldMock field={field} />
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
          {moveBackward ? (
            <button type="button" onClick={moveBackward} className="h-7 w-7 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50" title="Element nach vorne">←</button>
          ) : null}
          {moveForward ? (
            <button type="button" onClick={moveForward} className="h-7 w-7 rounded-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50" title="Element nach hinten">→</button>
          ) : null}
          <button type="button" onClick={onEdit} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50" title="Element bearbeiten">
            <ActionIcon name="edit" className="h-3.5 w-3.5" />
          </button>
          {onDelete ? (
            <button type="button" onClick={onDelete} className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-700" title="Element löschen">
              <ActionIcon name="delete" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

export function FormTemplateFieldEditor({
  field,
  onChange,
  onClose,
  protectedType = false,
}: {
  field: FormTemplateUiField;
  onChange: (patch: Partial<FormTemplateUiField>) => void;
  onClose: () => void;
  protectedType?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center bg-gray-950/45 sm:items-center sm:p-5">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Formularelement bearbeiten</h3>
            <p className="text-xs text-gray-500">Inhalt, Darstellung und Breite festlegen.</p>
          </div>
          <button onClick={onClose} type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-600">
            <ActionIcon name="close" />
          </button>
        </div>
        <div className="space-y-5 p-5 text-gray-950">
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Beschriftung *</span>
            <input autoFocus value={field.label} onChange={(event) => onChange({ label: event.currentTarget.value })} className={inputClass} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="text-xs font-semibold text-gray-600">Feldtyp</span>
              <select disabled={protectedType} value={field.type} onChange={(event) => onChange({ type: event.currentTarget.value as ProjectFormFieldType })} className={inputClass}>
                {formTemplateFieldTypeGroups.map((group) => (
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
            <p className="mt-1 text-[11px] text-gray-500">1 = schmal, 3 = halbe Zeile, 6 = ganze Zeile.</p>
          </div>
          {(field.type === "select" || field.type === "masterdata") ? (
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Auswahloptionen</span>
              <textarea rows={5} value={field.options.join("\n")} onChange={(event) => onChange({ options: event.currentTarget.value.split(/\n|,/).map((value) => value.trim()).filter(Boolean) })} className={inputClass} placeholder="Eine Option pro Zeile" />
            </label>
          ) : null}
          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Beschreibung / Hinweis</span>
            <textarea rows={3} value={field.description} onChange={(event) => onChange({ description: event.currentTarget.value })} className={inputClass} />
          </label>
          {protectedType ? <p className="rounded-lg bg-amber-50 p-3 text-xs font-medium text-amber-950">Technischer Feldtyp und Zuordnung bleiben geschützt.</p> : null}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-semibold text-white">Übernehmen</button>
          </div>
        </div>
      </div>
    </div>
  );
}
