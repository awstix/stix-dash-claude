"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FreeTextCombobox } from "@/components/FreeTextCombobox";
import { saveWorkshopFormSubmission } from "../workshop/form-actions";
import { WorkshopFields } from "../workshop/WorkshopFormCenter";
import type { WorkshopFormTemplateItem } from "../workshop/workshopFormTypes";

type Vehicle = {
  id: string;
  licensePlate: string | null;
  vehicleNumber: string;
  vehicleType: string;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 placeholder:text-gray-500 outline-none focus:border-gray-900";

export function InventoryWorkshopFormDialog({
  defaultVehicleId,
  inventoryItemId,
  itemLabel,
  personnel,
  repairOrderDescription,
  repairOrderForm,
  repairOrderTitle,
  templates,
  vehicles,
}: {
  defaultVehicleId?: string;
  inventoryItemId: string;
  itemLabel: string;
  personnel: { id: string; name: string }[];
  repairOrderDescription: string;
  repairOrderForm: ReactNode;
  repairOrderTitle: string;
  templates: WorkshopFormTemplateItem[];
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<"select" | "repair" | string>(
    "select",
  );

  const activeTemplate =
    activeMode !== "select" && activeMode !== "repair"
      ? templates.find((template) => template.id === activeMode) ?? null
      : null;

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    setActiveMode("select");
  }

  function submit(formData: FormData) {
    if (!activeTemplate) return;

    const values: Record<string, boolean | string> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("value:")) values[key.slice(6)] = String(value);
    }

    for (const element of Array.from(formRef.current?.elements ?? [])) {
      if (
        element instanceof HTMLInputElement &&
        element.name.startsWith("value:") &&
        element.type === "checkbox"
      ) {
        values[element.name.slice(6)] = element.checked;
      }
    }

    startTransition(async () => {
      try {
        await saveWorkshopFormSubmission({
          createdByName: String(formData.get("createdByName") ?? ""),
          formDate: String(formData.get("formDate") ?? ""),
          inventoryItemId,
          priority: String(formData.get("priority") ?? ""),
          templateId: activeTemplate.id,
          title: String(formData.get("title") ?? ""),
          values,
          vehicleId: String(formData.get("vehicleId") ?? ""),
        });
        close();
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Werkstattformular konnte nicht gespeichert werden.",
        );
      }
    });
  }

  const dialog = open ? (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/45 p-4"
      onMouseDown={(event) => {
        if (
          event.target instanceof Node &&
          dialogRef.current &&
          !dialogRef.current.contains(event.target)
        ) {
          close();
        }
      }}
    >
      <div
        aria-label="Werkstattformular aus Inventar erstellen"
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white text-gray-950 shadow-2xl"
        ref={dialogRef}
        role="dialog"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-700">
              Defekt melden / Auftrag öffnen
            </p>
            <h2 className="mt-1 text-xl font-semibold text-gray-900">
              {activeMode === "select"
                ? "Werkstattformular auswählen"
                : activeMode === "repair"
                  ? repairOrderTitle
                  : activeTemplate?.name}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{itemLabel}</p>
          </div>
          <button
            aria-label="Fenster schließen"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-xl text-gray-700 hover:bg-gray-50"
            onClick={close}
            type="button"
          >
            <ActionIcon name="close" className="h-4 w-4" />
          </button>
        </div>

        {activeMode === "select" ? (
          <div className="p-6">
            <p className="text-sm text-gray-600">
              Die Liste kommt direkt aus den Werkstatt-Formularvorlagen. Neue
              Vorlagen erscheinen hier automatisch, gelöschte verschwinden
              automatisch.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <button
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-left transition hover:border-red-700 hover:bg-red-100"
                onClick={() => setActiveMode("repair")}
                type="button"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  Reparatur
                </span>
                <span className="mt-1 block font-semibold text-gray-950">
                  {repairOrderTitle}
                </span>
                <span className="mt-1 block text-sm text-gray-600">
                  {repairOrderDescription}
                </span>
              </button>
              {templates.map((template) => (
                <button
                  className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-gray-900 hover:bg-gray-50"
                  key={template.id}
                  onClick={() => setActiveMode(template.id)}
                  type="button"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {template.category ?? "Formular"}
                  </span>
                  <span className="mt-1 block font-semibold text-gray-900">
                    {template.name}
                  </span>
                  {template.description ? (
                    <span className="mt-1 block text-sm text-gray-600">
                      {template.description}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : activeMode === "repair" ? (
          <div
            className="px-6 pb-6"
            onSubmit={() => {
              window.setTimeout(() => close(), 0);
            }}
          >
            <button
              className="my-4 text-sm font-semibold text-gray-600 hover:text-gray-950"
              onClick={() => setActiveMode("select")}
              type="button"
            >
              ← Andere Vorlage wählen
            </button>
            {repairOrderForm}
          </div>
        ) : activeTemplate ? (
          <form action={submit} className="p-6" ref={formRef}>
            <button
              className="mb-4 text-sm font-semibold text-gray-600 hover:text-gray-950"
              onClick={() => setActiveMode("select")}
              type="button"
            >
              ← Andere Vorlage wählen
            </button>
            <div className="grid gap-4 md:grid-cols-4">
              <label className="text-sm font-medium text-gray-800 md:col-span-2">
                Titel
                <input
                  className={inputClass}
                  defaultValue={`${activeTemplate.name}: ${itemLabel}`}
                  name="title"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                Gemeldet am
                <input
                  className={inputClass}
                  defaultValue={today()}
                  name="formDate"
                  type="date"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                Priorität
                <select
                  className={inputClass}
                  defaultValue="HIGH"
                  name="priority"
                >
                  <option value="LOW">Niedrig</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Hoch</option>
                  <option value="URGENT">Dringend</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-800">
                Ausgefüllt von
                <FreeTextCombobox
                  className={inputClass}
                  name="createdByName"
                  options={personnel.map((person) => ({
                    id: person.id,
                    label: person.name,
                  }))}
                  suggestionsId="inventory-workshop-personnel"
                />
              </label>
              <label className="text-sm font-medium text-gray-800 md:col-span-3">
                Fahrzeug / Maschine
                <select
                  className={inputClass}
                  defaultValue={defaultVehicleId ?? ""}
                  name="vehicleId"
                >
                  <option value="">Ohne Zuordnung</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {[
                        vehicle.vehicleNumber,
                        vehicle.licensePlate,
                        vehicle.vehicleType,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 border-t border-gray-200 pt-6">
              <WorkshopFields
                fields={activeTemplate.fields}
                kind={activeTemplate.kind}
                personnel={personnel}
                values={{}}
              />
            </div>
            <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 flex justify-end gap-3 border-t border-gray-200 bg-white px-6 py-4">
              <button
                className="rounded-xl border border-gray-300 px-4 py-2 font-semibold"
                onClick={close}
                type="button"
              >
                Abbrechen
              </button>
              <button
                className="rounded-xl bg-gray-900 px-5 py-2 font-semibold text-white disabled:opacity-50"
                disabled={isPending}
              >
                {isPending ? "Speichert…" : "Formular speichern"}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
        onClick={() => setOpen(true)}
        type="button"
      >
        Defekt melden / Auftrag öffnen
      </button>
      {dialog ? createPortal(dialog, document.body) : null}
    </>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
