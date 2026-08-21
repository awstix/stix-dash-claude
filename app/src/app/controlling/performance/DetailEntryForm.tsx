"use client";

import { useState } from "react";
import { CategoryDrillDownSelect } from "@/components/CategoryDrillDownSelect";

type EquipmentOption = {
  id: string;
  category: string;
  costType: string;
  label: string;
  parentCategory: string;
  unit: string;
  unitPrice: string;
};

type HourEntryOption = {
  id: string;
  label: string;
  totalHours: string;
};

export type DetailEntryEditValues = {
  id: string;
  costType: string;
  description: string;
  entryDate: string;
  isReleased: boolean;
  notes: string;
  quantity: string;
  status: string;
  unit: string;
  unitPrice: string;
  utilizationPercent: string;
};

const costTypes = ["Lohn", "Material", "Geräte", "Nachunternehmer", "Sonstiges"];
// Muss jede im Inventar tatsächlich vorkommende stockUnit als exakt
// passende Option enthalten - sonst zeigt der Browser bei einer Auswahl
// aus dem Objekt-Picker (unit kommt 1:1 aus InventoryItem.stockUnit) die
// erste Option ("h") an, weil kein <option> zum Wert passt, obwohl
// intern der richtige Wert gesetzt ist. "to"/"Stück"/"m2"/"m3" sind die
// im Inventar tatsächlich verwendeten Schreibweisen (nicht "t"/"m²"/"m³").
const units = [
  "h",
  "Stk.",
  "Stück",
  "m",
  "m2",
  "m²",
  "m3",
  "m³",
  "t",
  "to",
  "l",
  "pauschal",
  "€",
];
const entryStatuses = ["geschätzt", "geprüft", "tatsächlich verbaut", "gebucht", "offen", "erledigt"];

const inputClassName =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-gray-900";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-700";

export function DetailEntryForm({
  action,
  cancelHref,
  editingEntry,
  equipmentOptions,
  hourEntryOptions,
  onCancel,
  projectId,
  reportId,
  updateAction,
}: {
  action: (formData: FormData) => Promise<void>;
  cancelHref?: string;
  editingEntry?: DetailEntryEditValues | null;
  equipmentOptions: EquipmentOption[];
  hourEntryOptions: HourEntryOption[];
  onCancel?: () => void;
  projectId: string;
  reportId: string;
  updateAction: (formData: FormData) => Promise<void>;
}) {
  const [costType, setCostType] = useState(editingEntry?.costType ?? costTypes[0]);
  const [description, setDescription] = useState(editingEntry?.description ?? "");
  const [unit, setUnit] = useState(editingEntry?.unit ?? units[0]);
  const [quantity, setQuantity] = useState(editingEntry?.quantity ?? "");
  const [unitPrice, setUnitPrice] = useState(editingEntry?.unitPrice ?? "");
  const [utilizationPercent, setUtilizationPercent] = useState(
    editingEntry?.utilizationPercent ?? "100",
  );
  const [status, setStatus] = useState(editingEntry?.status ?? entryStatuses[0]);
  const [isReleased, setIsReleased] = useState(editingEntry?.isReleased ?? false);

  function handleEquipmentSelect(option: EquipmentOption) {
    setDescription(option.label);
    setCostType(option.costType);
    setUnit(option.unit);
    setUnitPrice(option.unitPrice);
  }

  function handleHourEntrySelect(id: string) {
    const option = hourEntryOptions.find((item) => item.id === id);
    if (!option) return;

    setQuantity(option.totalHours);
    setUnit("h");
  }

  const previewAmount =
    (parseGermanNumber(quantity) * parseGermanNumber(unitPrice) * parseGermanNumber(utilizationPercent)) /
    100;

  return (
    <form
      action={editingEntry ? updateAction : action}
      className="mt-4 grid gap-3 md:grid-cols-2"
    >
      {editingEntry ? (
        <input name="id" type="hidden" value={editingEntry.id} />
      ) : null}
      <input name="reportId" type="hidden" value={reportId} />
      <input name="projectId" type="hidden" value={projectId} />

      {equipmentOptions.length > 0 ? (
        <Field
          className="relative md:col-span-2"
          label="Gerät/Material aus Inventar wählen (füllt Beschreibung, Kostenart, Einheit & Satz)"
        >
          <CategoryDrillDownSelect
            items={equipmentOptions}
            onSelect={handleEquipmentSelect}
            placeholder="Überkategorie wählen oder direkt suchen ..."
          />
        </Field>
      ) : null}

      <Field label="Datum">
        <input
          className={inputClassName}
          defaultValue={editingEntry?.entryDate ?? formatInputDate(new Date())}
          name="entryDate"
          type="date"
        />
      </Field>
      <Field label="Kostenart">
        <select
          className={inputClassName}
          name="costType"
          onChange={(event) => setCostType(event.target.value)}
          value={costType}
        >
          {costTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Field>
      <Field className="md:col-span-2" label="Beschreibung">
        <input
          className={inputClassName}
          name="description"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </Field>
      <Field label="Menge">
        <input
          className={inputClassName}
          name="quantity"
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="0,00"
          value={quantity}
        />
        {unit === "h" ? (
          <span className="mt-1 block text-xs font-normal text-gray-500">
            Geräte- und Maschinenzeiten bitte abzüglich Pausen eintragen.
          </span>
        ) : null}
      </Field>
      {hourEntryOptions.length > 0 ? (
        <Field label="... oder Stunden übernehmen von">
          <select
            className={inputClassName}
            defaultValue=""
            onChange={(event) => handleHourEntrySelect(event.target.value)}
          >
            <option value="">Nicht übernehmen</option>
            {hourEntryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <Field label="Einheit">
        <select
          className={inputClassName}
          name="unit"
          onChange={(event) => setUnit(event.target.value)}
          value={unit}
        >
          {units.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Field>
      <Field label="EP netto €">
        <input
          className={inputClassName}
          name="unitPrice"
          onChange={(event) => setUnitPrice(event.target.value)}
          placeholder="0,00"
          value={unitPrice}
        />
      </Field>
      <Field label="Anteil % (für Gesamtkosten, z.B. bei Teilauslastung)">
        <input
          className={inputClassName}
          name="utilizationPercent"
          onChange={(event) => setUtilizationPercent(event.target.value)}
          placeholder="100"
          value={utilizationPercent}
        />
      </Field>
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        Betrag: <strong>{formatMoneyPreview(previewAmount)} €</strong>
        {utilizationPercent && utilizationPercent !== "100" ? (
          <span>
            {" "}
            (Menge {quantity || 0} × Satz {unitPrice || 0} × {utilizationPercent}%)
          </span>
        ) : null}
      </div>
      <Field label="Status">
        <select
          className={inputClassName}
          name="status"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          {entryStatuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Field>
      <label className="mt-1 flex items-center gap-2 self-end text-sm font-semibold text-gray-800">
        <input
          checked={isReleased}
          name="isReleased"
          onChange={(event) => setIsReleased(event.target.checked)}
          type="checkbox"
        />
        Freigegeben
      </label>
      <Field className="md:col-span-2" label="Bemerkung">
        <input
          className={inputClassName}
          defaultValue={editingEntry?.notes ?? ""}
          name="notes"
        />
      </Field>
      <div className="flex items-center gap-3 md:col-span-2">
        <button className={primaryButtonClassName} type="submit">
          {editingEntry ? "Änderungen speichern" : "Position hinzufügen"}
        </button>
        {editingEntry && cancelHref ? (
          <a
            className="text-sm font-semibold text-gray-600 hover:text-gray-900"
            href={cancelHref}
          >
            Abbrechen
          </a>
        ) : null}
        {editingEntry && !cancelHref && onCancel ? (
          <button
            className="text-sm font-semibold text-gray-600 hover:text-gray-900"
            onClick={onCancel}
            type="button"
          >
            Abbrechen
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  children,
  className = "",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`block text-sm font-semibold text-gray-700 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function parseGermanNumber(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyPreview(value: number) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
