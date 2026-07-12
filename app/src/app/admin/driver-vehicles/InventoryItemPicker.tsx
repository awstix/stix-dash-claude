"use client";

import { useMemo, useState } from "react";

type InventoryItemOption = {
  id: string;
  objectNumber: string | null;
  inventoryNumber: string | null;
  stixId: string | null;
  name: string;
  manufacturer: string | null;
  model: string | null;
  licensePlate: string | null;
  category?: {
    id?: string;
    name: string;
    parentCategory?: {
      id?: string;
      name: string;
    } | null;
  } | null;
  vehicle?: {
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
    isActive?: boolean;
  } | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getCategoryId(item: InventoryItemOption) {
  return item.category?.id ?? "without-category";
}

function getCategoryLabel(item: InventoryItemOption) {
  if (!item.category) {
    return "Ohne Kategorie";
  }

  return item.category.parentCategory
    ? `${item.category.parentCategory.name} / ${item.category.name}`
    : item.category.name;
}

function getCategorySortLabel(item: InventoryItemOption) {
  if (!item.category) {
    return "zzzz Ohne Kategorie";
  }

  return item.category.parentCategory
    ? `${item.category.parentCategory.name} ${item.category.name}`
    : item.category.name;
}

function getInventoryItemLabel(item: InventoryItemOption) {
  const categoryLabel = item.category?.parentCategory
    ? `${item.category.parentCategory.name} / ${item.category.name}`
    : item.category?.name;

  return [
    item.objectNumber,
    item.inventoryNumber,
    item.stixId,
    item.licensePlate ?? item.vehicle?.licensePlate,
    item.manufacturer,
    item.model,
    item.name,
    categoryLabel,
    item.vehicle?.isActive === false ? "inaktiv" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function InventoryItemPicker({
  formId,
  name,
  label,
  options,
  assignedInventoryItemIds,
  assignedInventoryItemInfoEntries,
  currentInventoryItemId,
  defaultValue,
  required = false,
  compact = false,
  className = "",
}: {
  formId?: string;
  name: string;
  label: string;
  options: InventoryItemOption[];
  assignedInventoryItemIds: string[];
  assignedInventoryItemInfoEntries: [string, string][];
  currentInventoryItemId?: string;
  defaultValue: string;
  required?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const assignedSet = useMemo(
    () => new Set(assignedInventoryItemIds),
    [assignedInventoryItemIds],
  );
  const assignedInfo = useMemo(
    () => new Map(assignedInventoryItemInfoEntries),
    [assignedInventoryItemInfoEntries],
  );
  const defaultItem = options.find((item) => item.id === defaultValue);
  const [categoryId, setCategoryId] = useState(
    defaultItem ? getCategoryId(defaultItem) : "",
  );

  const categories = useMemo(() => {
    const byId = new Map<
      string,
      {
        id: string;
        label: string;
        sortLabel: string;
        isSubcategory: boolean;
      }
    >();

    for (const item of options) {
      const id = getCategoryId(item);

      byId.set(id, {
        id,
        label: getCategoryLabel(item),
        sortLabel: getCategorySortLabel(item),
        isSubcategory: Boolean(item.category?.parentCategory),
      });
    }

    return Array.from(byId.values()).sort((a, b) => {
      const sortCompare = a.sortLabel.localeCompare(b.sortLabel, "de-DE", {
        numeric: true,
        sensitivity: "base",
      });

      if (sortCompare !== 0) return sortCompare;
      if (a.isSubcategory && !b.isSubcategory) return 1;
      if (!a.isSubcategory && b.isSubcategory) return -1;

      return a.label.localeCompare(b.label, "de-DE");
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    const source = categoryId
      ? options.filter((item) => getCategoryId(item) === categoryId)
      : options;

    return source
      .sort((a, b) =>
        getInventoryItemLabel(a).localeCompare(getInventoryItemLabel(b), "de-DE", {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [categoryId, options]);

  const selectClass = compact
    ? "w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-gray-900"
    : "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900";

  const objectSelect = (
    <select
      form={formId}
      name={name}
      required={required}
      defaultValue={defaultValue}
      className={selectClass}
    >
      <option value="" disabled>
        {categoryId
          ? "Inventarobjekt wählen"
          : "Alle Kategorien – Inventarobjekt wählen"}
      </option>

      {filteredOptions.map((item) => {
        const assigned =
          assignedSet.has(item.id) && item.id !== currentInventoryItemId;
        const assignedTo = assignedInfo.get(item.id);

        return (
          <option key={item.id} value={item.id}>
            {assigned
              ? `⚠ vergeben${assignedTo ? ` an ${assignedTo}` : ""} · `
              : ""}
            {getInventoryItemLabel(item)}
          </option>
        );
      })}
    </select>
  );

  const content = (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <select
        form={formId}
        value={categoryId}
        onChange={(event) => setCategoryId(event.target.value)}
        className={selectClass}
      >
        <option value="">Kategorie / Unterkategorie wählen</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.isSubcategory ? "↳ " : ""}
            {category.label}
          </option>
        ))}
      </select>

      {objectSelect}

      {categoryId && filteredOptions.length === 0 ? (
        <p className="text-xs text-amber-700">
          In dieser Kategorie ist kein wählbares Inventarobjekt vorhanden.
        </p>
      ) : null}
    </div>
  );

  if (!isNonEmptyString(label)) return content;

  return (
    <label className={`text-sm font-medium text-gray-800 ${className}`}>
      {label}
      {content}
    </label>
  );
}
