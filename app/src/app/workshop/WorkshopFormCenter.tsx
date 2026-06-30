"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveWorkshopFormSubmission } from "./form-actions";
import type { WorkshopFormTemplateItem } from "./workshopFormTypes";
import {
  getProjectFormPresetOptions,
  type ProjectFormFieldDefinition,
} from "@/app/projects/projectFormTypes";
import { FreeTextCombobox } from "@/components/FreeTextCombobox";

type Vehicle = {
  id: string;
  licensePlate: string | null;
  vehicleNumber: string;
  vehicleType: string;
};

type Submission = {
  completedAt: string;
  completedByName: string | null;
  createdByName: string | null;
  fields: ProjectFormFieldDefinition[];
  formDate: string;
  id: string;
  inventoryItemId: string;
  priority: string;
  templateId: string;
  templateKind: WorkshopFormTemplateItem["kind"];
  templateName: string;
  title: string;
  values: Record<string, boolean | string>;
  vehicleId: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 placeholder:text-gray-500 outline-none focus:border-gray-900";

export function WorkshopFormCenter({
  initialEditingId,
  personnel,
  repairOrderDescription,
  repairOrderForm,
  repairOrderTitle,
  submissions,
  templates,
  vehicles,
}: {
  initialEditingId?: string;
  personnel: { id: string; name: string }[];
  repairOrderDescription: string;
  repairOrderForm: ReactNode;
  repairOrderTitle: string;
  submissions: Submission[];
  templates: WorkshopFormTemplateItem[];
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(
    initialEditingId ?? null,
  );
  const [showRepairOrder, setShowRepairOrder] = useState(false);
  const editing = submissions.find((item) => item.id === editingId) ?? null;
  const activeTemplate =
    templates.find((item) => item.id === (editing?.templateId ?? activeTemplateId)) ?? null;

  function close() {
    setActiveTemplateId(null);
    setEditingId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("editForm")) {
      url.searchParams.delete("editForm");
      window.history.replaceState({}, "", url);
    }
  }

  function submit(formData: FormData) {
    if (!activeTemplate) return;
    const values: Record<string, boolean | string> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("value:")) values[key.slice(6)] = String(value);
    }
    for (const input of Array.from(
      (document.getElementById("workshop-form-dialog") as HTMLFormElement | null)?.elements ?? [],
    )) {
      if (input instanceof HTMLInputElement && input.name.startsWith("value:") && input.type === "checkbox") {
        values[input.name.slice(6)] = input.checked;
      }
    }

    startTransition(async () => {
      try {
        await saveWorkshopFormSubmission({
          completedAt: String(formData.get("completedAt") ?? ""),
          completedByName: String(formData.get("completedByName") ?? ""),
          createdByName: String(formData.get("createdByName") ?? ""),
          formDate: String(formData.get("formDate") ?? ""),
          id: editing?.id,
          inventoryItemId: editing?.inventoryItemId ?? "",
          priority: String(formData.get("priority") ?? ""),
          templateId: activeTemplate.id,
          title: String(formData.get("title") ?? ""),
          values,
          vehicleId: String(formData.get("vehicleId") ?? ""),
        });
        close();
        router.refresh();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Formular konnte nicht gespeichert werden.");
      }
    });
  }

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Werkstattaufträge</h2>
          <p className="mt-1 text-sm text-gray-600">
            Auftragstyp auswählen und direkt im Dialog erfassen.
          </p>
        </div>
        <Link
          href="/workshop/forms"
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Formularvorlagen verwalten
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setShowRepairOrder(true)}
          className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-gray-900 hover:bg-gray-50"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Reparatur
          </span>
          <span className="mt-1 block font-semibold text-gray-900">
            {repairOrderTitle}
          </span>
          <span className="mt-1 block text-sm text-gray-600">
            {repairOrderDescription}
          </span>
        </button>
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

      {showRepairOrder ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 text-gray-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div>
                <h2 className="text-xl font-semibold">{repairOrderTitle}</h2>
                <p className="text-sm text-gray-500">Neuen Werkstattauftrag erfassen</p>
              </div>
              <button type="button" onClick={() => setShowRepairOrder(false)} className="text-3xl leading-none text-gray-500">×</button>
            </div>
            {repairOrderForm}
          </div>
        </div>
      ) : null}

      {activeTemplate ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/45 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white text-gray-950 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{activeTemplate.name}</h2>
                <p className="text-sm text-gray-500">Werkstattformular ausfüllen</p>
              </div>
              <button type="button" onClick={close} className="text-3xl leading-none text-gray-500">×</button>
            </div>
            <form id="workshop-form-dialog" action={submit} className="p-6 text-gray-950">
              <div className="grid gap-4 md:grid-cols-4">
                <label className="text-sm font-medium text-gray-800 md:col-span-2">
                  Titel
                  <input name="title" defaultValue={editing?.title ?? activeTemplate.name} className={inputClass} />
                </label>
                <label className="text-sm font-medium text-gray-800">
                  Gemeldet am
                  <input type="date" name="formDate" defaultValue={editing?.formDate || today()} className={inputClass} />
                </label>
                <label className="text-sm font-medium text-gray-800">
                  Priorität
                  <select name="priority" defaultValue={editing?.priority ?? "NORMAL"} className={inputClass}>
                    <option value="LOW">Niedrig</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">Hoch</option>
                    <option value="URGENT">Dringend</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-800">
                  Ausgefüllt von
                  <FreeTextCombobox
                    name="createdByName"
                    defaultValue={editing?.createdByName ?? ""}
                    className={inputClass}
                    options={personnel.map((person) => ({
                      id: person.id,
                      label: person.name,
                    }))}
                    suggestionsId="workshop-form-personnel"
                  />
                </label>
                <label className="text-sm font-medium text-gray-800 md:col-span-3">
                  Fahrzeug / Maschine
                  <select name="vehicleId" defaultValue={editing?.vehicleId ?? ""} className={inputClass}>
                    <option value="">Ohne Zuordnung</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {[vehicle.vehicleNumber, vehicle.licensePlate, vehicle.vehicleType].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-6 border-t border-gray-200 pt-6">
                <WorkshopFields
                  kind={activeTemplate.kind}
                  fields={activeTemplate.fields}
                  personnel={personnel}
                  values={editing?.values ?? {}}
                />
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
                      options={personnel.map((person) => ({
                        id: person.id,
                        label: person.name,
                      }))}
                      suggestionsId="workshop-form-completed-by"
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

export function WorkshopFields({
  fields,
  kind,
  personnel,
  values,
}: {
  fields: ProjectFormFieldDefinition[];
  kind: WorkshopFormTemplateItem["kind"];
  personnel: { id: string; name: string }[];
  values: Record<string, boolean | string>;
}) {
  if (kind === "TIRE_ORDER") {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Text name="licensePlate" label="Kennzeichen" values={values} />
          <Text name="km" label="Kilometerstand" values={values} type="number" />
          <Text name="inspectionDate" label="Gemeldet am" values={values} type="date" />
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[120px_repeat(4,1fr)] bg-gray-50 px-4 py-3 text-sm font-semibold">
              <span>Achse</span><span>Links außen</span><span>Links innen</span><span>Rechts innen</span><span>Rechts außen</span>
            </div>
            {Array.from({ length: 6 }, (_, axle) => (
              <div key={axle} className="grid grid-cols-[120px_repeat(4,1fr)] items-center border-t border-gray-100 px-4 py-3">
                <span className="font-semibold">{axle + 1}. Achse</span>
                {["la", "li", "ri", "ra"].map((position) => (
                  <label key={position} className="flex justify-center">
                    {axle === 0 && (position === "li" || position === "ri") ? (
                      <span className="text-gray-300">–</span>
                    ) : (
                      <input type="checkbox" name={`value:axle${axle + 1}_${position}`} defaultChecked={values[`axle${axle + 1}_${position}`] === true} className="h-5 w-5" />
                    )}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
        <Text name="notes" label="Notizen" values={values} textarea />
        <SignaturePad name="mechanicSignature" label="Unterschrift Erledigt / Freigabe" value={String(values.mechanicSignature ?? "")} />
      </div>
    );
  }

  if (kind === "VEHICLE_ORDER" || kind === "MACHINE_ORDER") {
    const machine = kind === "MACHINE_ORDER";
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex gap-6 md:col-span-2">
          <Check name="internal" label="Intern" values={values} />
          <Check name="external" label="Extern" values={values} />
          <Check name="deliveryRequired" label="Liefertermin" values={values} />
        </div>
        <Text name="company" label="Externe Firma" values={values} />
        <Text name="deliveryDate" label="Liefertermin" values={values} type="date" />
        <Text name={machine ? "serialNumber" : "vin"} label={machine ? "Seriennummer" : "Fahrgestellnummer"} values={values} />
        <Text name={machine ? "internalNumber" : "licensePlate"} label={machine ? "Interne Nummer" : "Kennzeichen"} values={values} />
        <Text name="driver" label="Fahrer" values={values} />
        <Text name={machine ? "operatingHours" : "km"} label={machine ? "Betriebsstunden" : "Kilometerstand"} values={values} type="number" />
        <div className="md:col-span-2"><Text name="information" label="Informationen / Arbeitsauftrag" values={values} textarea /></div>
        <div className="space-y-3 md:col-span-2">
        {[
          ["cleaned", "Gereinigt"],
          ["lubricated", "Abgeschmiert"],
          ["accepted", "Angenommen"],
          ["finalInspection", "Endkontrolle"],
        ].map(([key, label]) => (
          <ControlRow
            key={key}
            checkName={key}
            label={label}
            personnel={personnel}
            values={values}
          />
        ))}
        </div>
        <Text name="signatureCompany" label="Firma" values={values} />
        <div className="md:col-span-2">
          <SignaturePad name="signatureDataUrl" label="Unterschrift" value={String(values.signatureDataUrl ?? "")} />
        </div>
      </div>
    );
  }

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
                ).map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          ) : field.type === "signature" ? (
            <SignaturePad
              name={field.id}
              label={field.label}
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

function ControlRow({
  checkName,
  label,
  personnel,
  values,
}: {
  checkName: string;
  label: string;
  personnel: { id: string; name: string }[];
  values: Record<string, boolean | string>;
}) {
  return (
    <div className="grid items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:grid-cols-[170px_auto_1fr]">
      <Check name={checkName} label={label} values={values} />
      <span className="text-sm font-medium text-gray-600">durch</span>
      <FreeTextCombobox
        name={`value:${checkName}By`}
        defaultValue={String(values[`${checkName}By`] ?? "")}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950"
        options={personnel.map((person) => ({
          id: person.id,
          label: person.name,
        }))}
        suggestionsId={`personnel-${checkName}By`}
      />
    </div>
  );
}

function SignaturePad({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [signature, setSignature] = useState(value);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!signature) return;
    const image = new window.Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = signature;
  }, [signature]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    lastPointRef.current = point(event);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const next = point(event);
    const previous = lastPointRef.current;
    if (!canvas || !context || !next || !previous) return;
    context.strokeStyle = "#111827";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    lastPointRef.current = next;
  }

  function finish() {
    const canvas = canvasRef.current;
    if (!canvas || !drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    setSignature(canvas.toDataURL("image/png"));
  }

  function clear() {
    setSignature("");
  }

  return (
    <div>
      <input type="hidden" name={`value:${name}`} value={signature} />
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <button type="button" onClick={clear} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800">
          Zurücksetzen
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={720}
        height={220}
        className="block h-32 w-full touch-none rounded-xl border border-gray-300 bg-white shadow-inner"
        onPointerCancel={finish}
        onPointerDown={start}
        onPointerLeave={finish}
        onPointerMove={draw}
        onPointerUp={finish}
      />
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
  type?: string;
  values: Record<string, boolean | string>;
}) {
  return (
    <label className="block text-sm font-medium text-gray-800">
      {label}
      {textarea ? (
        <textarea name={`value:${name}`} defaultValue={String(values[name] ?? "")} required={required} rows={5} className={inputClass} />
      ) : (
        <input name={`value:${name}`} type={type} defaultValue={String(values[name] ?? "")} required={required} className={inputClass} />
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

function today() {
  return new Date().toISOString().slice(0, 10);
}
