"use client";

import { useState } from "react";

type EquipmentOption = {
  id: string;
  category: string;
  label: string;
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
  notes: string;
  quantity: string;
  status: string;
  unit: string;
  unitPrice: string;
  utilizationPercent: string;
};

const costTypes = ["Lohn", "Material", "Geräte", "Nachunternehmer", "Sonstiges"];
const units = ["h", "Stk.", "m", "m²", "m³", "t", "pauschal", "€"];
const entryStatuses = ["geschätzt", "geprüft", "gebucht", "offen", "erledigt"];

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
  projectId,
  reportId,
  updateAction,
}: {
  action: (formData: FormData) => Promise<void>;
  cancelHref?: string;
  editingEntry?: DetailEntryEditValues | null;
  equipmentOptions: EquipmentOption[];
  hourEntryOptions: HourEntryOption[];
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
  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [showEquipmentList, setShowEquipmentList] = useState(false);

  const normalizedSearch = normalizeSearchText(equipmentSearch);
  const filteredEquipmentOptions = normalizedSearch
    ? equipmentOptions.filter((option) =>
        normalizeSearchText(`${option.category} ${option.label}`).includes(
          normalizedSearch,
        ),
      )
    : equipmentOptions;

  const equipmentGroups: { category: string; items: EquipmentOption[] }[] = [];
  for (const option of filteredEquipmentOptions) {
    const currentGroup = equipmentGroups[equipmentGroups.length - 1];
    if (currentGroup && currentGroup.category === option.category) {
      currentGroup.items.push(option);
    } else {
      equipmentGroups.push({ category: option.category, items: [option] });
    }
  }

  function handleEquipmentSelect(id: string) {
    const option = equipmentOptions.find((item) => item.id === id);
    if (!option) return;

    setDescription(option.label);
    setCostType("Geräte");
    setUnit("h");
    setUnitPrice(option.unitPrice);
    setEquipmentSearch(`${option.category} · ${option.label}`);
    setShowEquipmentList(false);
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
          label="Gerät/Material aus Inventar suchen (füllt Beschreibung, Kostenart, Einheit & Satz)"
        >
          <input
            autoComplete="off"
            className={inputClassName}
            onBlur={() => {
              window.setTimeout(() => setShowEquipmentList(false), 150);
            }}
            onChange={(event) => {
              setEquipmentSearch(event.target.value);
              setShowEquipmentList(true);
            }}
            onFocus={() => setShowEquipmentList(true)}
            placeholder="z.B. Stampfer, Sand, Walze ..."
            value={equipmentSearch}
          />
          {showEquipmentList ? (
            <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-gray-300 bg-white shadow-lg">
              {equipmentGroups.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  Keine Treffer im Inventar.
                </div>
              ) : (
                equipmentGroups.map((group) => (
                  <div key={group.category}>
                    <div className="sticky top-0 bg-gray-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                      {group.category}
                    </div>
                    {group.items.map((option) => (
                      <button
                        className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-50"
                        key={`${group.category}-${option.id}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleEquipmentSelect(option.id)}
                        type="button"
                      >
                        {option.label}
                        {option.unitPrice ? ` · ${option.unitPrice} €` : ""}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          ) : null}
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

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
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
