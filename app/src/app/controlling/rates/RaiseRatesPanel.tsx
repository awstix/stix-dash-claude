"use client";

import { useMemo, useState } from "react";
import { raiseRates } from "./actions";

type RateTargetType = "EMPLOYEE_GROUP" | "INVENTORY_CATEGORY" | "INVENTORY_ITEM";
type RateFieldName = "normal" | "idle" | "both";
type RaiseMode = "percent" | "euro";

type EmployeeGroupRate = {
  id: string;
  internalRateCents: number;
  name: string;
  realRateCents: number;
  validFrom: Date | string | null;
};

type InventoryCategoryRate = {
  billingRateCents: number | null;
  id: string;
  idleBillingRateCents: number | null;
  name: string;
  parentCategoryId?: string | null;
  parentCategory: {
    name: string;
  } | null;
};

type InventoryItemRate = {
  billingRateCents: number | null;
  category: {
    id: string;
    name: string;
    parentCategory: {
      id: string;
      name: string;
    } | null;
    parentCategoryId: string | null;
  } | null;
  id: string;
  idleBillingRateCents: number | null;
  name: string;
  objectNumber: string | null;
};

export function RaiseRatesPanel({
  categories,
  employeeGroupRates,
  items,
  rateSetId,
  year,
}: {
  categories: InventoryCategoryRate[];
  employeeGroupRates: EmployeeGroupRate[];
  items: InventoryItemRate[];
  rateSetId: string;
  year: number;
}) {
  const [targetType, setTargetType] = useState<RateTargetType>("EMPLOYEE_GROUP");
  const [fieldName, setFieldName] = useState<RateFieldName>("normal");
  const [mode, setMode] = useState<RaiseMode>("percent");
  const [amount, setAmount] = useState("");
  const [categoryFilterId, setCategoryFilterId] = useState("");
  const [subcategoryFilterId, setSubcategoryFilterId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const rootCategories = useMemo(
    () => categories.filter((category) => !category.parentCategoryId),
    [categories],
  );
  const subcategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.parentCategoryId &&
          (!categoryFilterId || category.parentCategoryId === categoryFilterId),
      ),
    [categories, categoryFilterId],
  );

  const rows = useMemo(() => {
    if (targetType === "EMPLOYEE_GROUP") {
      return employeeGroupRates.map((rate) => ({
        id: rate.id,
        label: rate.name,
        meta: rate.validFrom
          ? `Jahr ${new Date(rate.validFrom).getUTCFullYear()}`
          : "ohne Jahr",
        normalCents: rate.realRateCents,
        normalLabel: "EK real",
        idleCents: rate.internalRateCents,
        idleLabel: "Interner Satz",
      }));
    }

    if (targetType === "INVENTORY_CATEGORY") {
      return categories.map((category) => ({
        id: category.id,
        label: category.name,
        meta: categoryMeta(category, categories, items),
        normalCents: categoryRateRange(category, categories, items, "normal"),
        normalLabel: "Normal",
        idleCents: categoryRateRange(category, categories, items, "idle"),
        idleLabel: "Stillstand",
      }));
    }

    return filteredItemsForObjectSelection(
      items,
      categories,
      categoryFilterId,
      subcategoryFilterId,
    ).map((item) => ({
      id: item.id,
      label: item.objectNumber ? `${item.objectNumber} · ${item.name}` : item.name,
      meta: itemCategoryLabel(item),
      normalCents: item.billingRateCents,
      normalLabel: "Normal",
      idleCents: item.idleBillingRateCents,
      idleLabel: "Stillstand",
    }));
  }, [
    categories,
    categoryFilterId,
    employeeGroupRates,
    items,
    subcategoryFilterId,
    targetType,
  ]);

  const selectedSet = new Set(selectedIds);

  function changeTargetType(value: RateTargetType) {
    setTargetType(value);
    setSelectedIds([]);
    setCategoryFilterId("");
    setSubcategoryFilterId("");
  }

  function changeCategoryFilter(id: string) {
    setCategoryFilterId(id);
    setSubcategoryFilterId("");
    setSelectedIds([]);
  }

  function changeSubcategoryFilter(id: string) {
    setSubcategoryFilterId(id);
    setSelectedIds([]);
  }

  function toggleId(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  function toggleAll() {
    setSelectedIds((current) =>
      current.length === rows.length ? [] : rows.map((row) => row.id),
    );
  }

  return (
    <details className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">
              Sätze gesammelt anheben
            </h2>
            <p className="mt-1 text-sm text-gray-700">
              Auswahl treffen, aktuelle Sätze prüfen und neue Sätze vor dem Speichern sehen.
              Kategorien dienen als Filter; erhöht werden die zugehörigen Objekte.
            </p>
          </div>
          <Chevron />
        </div>
      </summary>

      <form action={raiseRates} className="mt-4 space-y-4">
        <input name="rateSetId" type="hidden" value={rateSetId} />
        <input name="year" type="hidden" value={year} />
        <input name="targetType" type="hidden" value={targetType} />
        <input name="fieldName" type="hidden" value={fieldName} />
        <input name="mode" type="hidden" value={mode} />
        {selectedIds.map((id) => (
          <input key={id} name="targetIds" type="hidden" value={id} />
        ))}

        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr_1fr]">
          <Field label="Bereich">
            <select
              className={inputClassName}
              onChange={(event) => changeTargetType(event.target.value as RateTargetType)}
              value={targetType}
            >
              <option value="EMPLOYEE_GROUP">Mitarbeitergruppen</option>
              <option value="INVENTORY_CATEGORY">Inventarkategorien</option>
              <option value="INVENTORY_ITEM">Inventarobjekte</option>
            </select>
          </Field>
          <Field label="Satz">
            <select
              className={inputClassName}
              onChange={(event) => setFieldName(event.target.value as RateFieldName)}
              value={fieldName}
            >
              <option value="normal">Normal</option>
              <option value="idle">Stillstand / intern</option>
              <option value="both">Normal und Stillstand</option>
            </select>
          </Field>
          <Field label="Anhebung als">
            <select
              className={inputClassName}
              onChange={(event) => setMode(event.target.value as RaiseMode)}
              value={mode}
            >
              <option value="percent">Prozent</option>
              <option value="euro">Euro</option>
            </select>
          </Field>
          <Field label="Anhebung">
            <input
              className={inputClassName}
              name="amount"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="z. B. 3,5"
              value={amount}
            />
          </Field>
        </div>

        <Field label="Grund / Notiz">
          <input
            className={inputClassName}
            name="reason"
            placeholder="z. B. Satz 2027"
          />
        </Field>

        {targetType === "INVENTORY_ITEM" ? (
          <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 lg:grid-cols-2">
            <Field label="Kategorie">
              <select
                className={inputClassName}
                onChange={(event) => changeCategoryFilter(event.target.value)}
                value={categoryFilterId}
              >
                <option value="">Alle Kategorien</option>
                {rootCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unterkategorie">
              <select
                className={inputClassName}
                onChange={(event) => changeSubcategoryFilter(event.target.value)}
                value={subcategoryFilterId}
              >
                <option value="">
                  {categoryFilterId ? "Alle Unterkategorien" : "Erst Kategorie wählen"}
                </option>
                {subcategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}

        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-100 px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-gray-950">
                Auswahl und Vorschau
              </p>
              <p className="text-xs font-medium text-gray-800">
                {selectedIds.length} von {rows.length} ausgewählt
              </p>
            </div>
            <button
              className={smallButtonClassName}
              onClick={toggleAll}
              type="button"
            >
              {selectedIds.length === rows.length ? "Alle abwählen" : "Alle wählen"}
            </button>
          </div>

          <div className="max-h-[520px] overflow-auto">
            <table className="w-full min-w-[860px] text-left text-sm text-gray-900">
              <thead className="sticky top-0 z-10 bg-gray-100 text-xs uppercase tracking-wide text-gray-950">
                <tr>
                  <th className="px-3 py-2">Auswahl</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Zuordnung</th>
                  <th className="px-3 py-2">Aktuell Normal</th>
                  <th className="px-3 py-2">Neu Normal</th>
                  <th className="px-3 py-2">Aktuell Stillstand</th>
                  <th className="px-3 py-2">Neu Stillstand</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-t border-gray-100" key={row.id}>
                    <td className="px-3 py-2">
                      <input
                        checked={selectedSet.has(row.id)}
                        className="h-4 w-4 accent-gray-950"
                        onChange={() => toggleId(row.id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-950">
                      {row.label}
                    </td>
                    <td className="px-3 py-2 text-gray-900">{row.meta}</td>
                    <td className="px-3 py-2">
                      {row.normalLabel}: {formatRateValue(row.normalCents)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-950">
                      {fieldName === "normal" || fieldName === "both"
                        ? formatRateValue(raisedValue(row.normalCents, amount, mode))
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.idleLabel}: {formatRateValue(row.idleCents)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-950">
                      {fieldName === "idle" || fieldName === "both"
                        ? formatRateValue(raisedValue(row.idleCents, amount, mode))
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <button className={primaryButtonClassName} type="submit">
          Ausgewählte Sätze anheben
        </button>
      </form>
    </details>
  );
}

function raisedValue(
  cents: number | null | RateRange,
  amountText: string,
  mode: RaiseMode,
): number | RateRange {
  const amount = parseGermanNumber(amountText);

  if (isRateRange(cents)) {
    return {
      max: raisedValue(cents.max, amountText, mode) as number,
      min: raisedValue(cents.min, amountText, mode) as number,
    };
  }

  const current = cents ?? 0;

  if (amount === null) return current;

  if (mode === "percent") {
    return Math.round(current * (1 + amount / 100));
  }

  return Math.round(current + amount * 100);
}

type RateRange = {
  max: number;
  min: number;
};

function isRateRange(value: number | null | RateRange): value is RateRange {
  return Boolean(value && typeof value === "object" && "min" in value && "max" in value);
}

function formatRateValue(value: number | null | RateRange) {
  if (isRateRange(value)) {
    if (value.min === value.max) return formatMoney(value.min);
    return `${formatMoney(value.min)} – ${formatMoney(value.max)}`;
  }

  return formatMoney(value);
}

function categoryMeta(
  category: InventoryCategoryRate,
  categories: InventoryCategoryRate[],
  items: InventoryItemRate[],
) {
  const affectedItems = affectedItemsForCategory(category, categories, items);
  const base = category.parentCategory
    ? `Unterkategorie von ${category.parentCategory.name}`
    : "Überkategorie inkl. Unterkategorien";

  return `${base} · ${affectedItems.length} Objekte`;
}

function categoryRateRange(
  category: InventoryCategoryRate,
  categories: InventoryCategoryRate[],
  items: InventoryItemRate[],
  field: "idle" | "normal",
) {
  const values = affectedItemsForCategory(category, categories, items)
    .map((item) =>
      field === "idle" ? item.idleBillingRateCents : item.billingRateCents,
    )
    .map((value) => value ?? 0);

  if (values.length === 0) return null;

  return {
    max: Math.max(...values),
    min: Math.min(...values),
  };
}

function affectedItemsForCategory(
  category: InventoryCategoryRate,
  categories: InventoryCategoryRate[],
  items: InventoryItemRate[],
) {
  const categoryIds = new Set([category.id]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const candidate of categories) {
      if (
        candidate.parentCategoryId &&
        categoryIds.has(candidate.parentCategoryId) &&
        !categoryIds.has(candidate.id)
      ) {
        categoryIds.add(candidate.id);
        changed = true;
      }
    }
  }

  return items.filter((item) => item.category?.id && categoryIds.has(item.category.id));
}

function filteredItemsForObjectSelection(
  items: InventoryItemRate[],
  categories: InventoryCategoryRate[],
  categoryFilterId: string,
  subcategoryFilterId: string,
) {
  if (subcategoryFilterId) {
    return items.filter((item) => item.category?.id === subcategoryFilterId);
  }

  if (!categoryFilterId) return items;

  const categoryIds = new Set(
    categories
      .filter(
        (category) =>
          category.id === categoryFilterId ||
          category.parentCategoryId === categoryFilterId,
      )
      .map((category) => category.id),
  );

  return items.filter((item) => item.category?.id && categoryIds.has(item.category.id));
}

function itemCategoryLabel(item: InventoryItemRate) {
  if (!item.category) return "ohne Kategorie";

  if (item.category.parentCategory) {
    return `${item.category.parentCategory.name} · ${item.category.name}`;
  }

  return item.category.name;
}

function parseGermanNumber(value: string) {
  const normalized = value
    .trim()
    .replace(/€/g, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!normalized) return null;
  const parsed = Number(normalized);

  return Number.isNaN(parsed) ? null : parsed;
}

function formatMoney(cents?: number | null) {
  if (!cents) return "0,00 €";

  return new Intl.NumberFormat("de-DE", {
    currency: "EUR",
    minimumFractionDigits: 2,
    style: "currency",
  }).format(cents / 100);
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block text-sm font-semibold text-gray-800">
      {label}
      {children}
    </label>
  );
}

function Chevron() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-950 transition-transform group-open:rotate-180"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
        viewBox="0 0 24 24"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
}

const inputClassName =
  "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900";
const smallButtonClassName =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50";
const primaryButtonClassName =
  "rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700";
