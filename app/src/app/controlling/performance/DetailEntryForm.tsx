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

const costTypes = ["Lohn", "Material", "Geräte", "Nachunternehmer", "Sonstiges"];
const units = ["h", "Stk.", "m", "m²", "m³", "t", "pauschal", "€"];
const entryStatuses = ["geschätzt", "geprüft", "gebucht", "offen", "erledigt"];

const inputClassName =
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-gray-900";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-gray-700";

export function DetailEntryForm({
  action,
  equipmentOptions,
  hourEntryOptions,
  projectId,
  reportId,
}: {
  action: (formData: FormData) => Promise<void>;
  equipmentOptions: EquipmentOption[];
  hourEntryOptions: HourEntryOption[];
  projectId: string;
  reportId: string;
}) {
  const [costType, setCostType] = useState(costTypes[0]);
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState(units[0]);
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [status, setStatus] = useState(entryStatuses[0]);
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

  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-2">
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
                        key={option.id}
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
          defaultValue={formatInputDate(new Date())}
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
        <input className={inputClassName} name="notes" />
      </Field>
      <button className={primaryButtonClassName} type="submit">
        Position hinzufügen
      </button>
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

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
