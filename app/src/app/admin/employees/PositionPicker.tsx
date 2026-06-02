"use client";

import { useState } from "react";

type PositionOption = {
  value: string;
  label: string;
};

export function PositionPicker({
  options,
  defaultValues = [],
  defaultIsLeadership = false,
}: {
  options: PositionOption[];
  defaultValues?: string[];
  defaultIsLeadership?: boolean;
}) {
  const [selectedValues, setSelectedValues] = useState(defaultValues);
  const [draggedValue, setDraggedValue] = useState<string | null>(null);

  const selectedOptions = selectedValues
    .map((value) => options.find((option) => option.value === value))
    .filter((option): option is PositionOption => Boolean(option));

  const availableOptions = options.filter(
    (option) => !selectedValues.includes(option.value)
  );

  function addPosition(value: string) {
    if (!value || selectedValues.includes(value)) {
      return;
    }

    setSelectedValues((values) => [...values, value]);
  }

  function removePosition(value: string) {
    setSelectedValues((values) => values.filter((item) => item !== value));
  }

  function movePosition(value: string, direction: -1 | 1) {
    setSelectedValues((values) => {
      const index = values.indexOf(value);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= values.length) {
        return values;
      }

      const nextValues = [...values];
      const currentValue = nextValues[index];

      nextValues[index] = nextValues[nextIndex];
      nextValues[nextIndex] = currentValue;

      return nextValues;
    });
  }

  function dropPosition(targetValue: string) {
    if (!draggedValue || draggedValue === targetValue) {
      return;
    }

    setSelectedValues((values) => {
      const withoutDragged = values.filter((value) => value !== draggedValue);
      const targetIndex = withoutDragged.indexOf(targetValue);

      if (targetIndex < 0) {
        return values;
      }

      const nextValues = [...withoutDragged];
      nextValues.splice(targetIndex, 0, draggedValue);

      return nextValues;
    });

    setDraggedValue(null);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            Berufsbezeichnung / Mitarbeitergruppen
          </div>

          <p className="mt-1 text-xs text-gray-500">
            Mehrere Gruppen möglich. Die erste Gruppe gilt als Hauptrolle.
            Reihenfolge per Drag & Drop oder Pfeile ändern.
          </p>
        </div>

        <label className="flex shrink-0 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800">
          <input
            name="isLeadership"
            type="checkbox"
            defaultChecked={defaultIsLeadership}
            className="h-4 w-4"
          />
          Leitung
        </label>
      </div>

      <div className="mt-4">
        <select
          defaultValue=""
          onChange={(event) => {
            addPosition(event.target.value);
            event.currentTarget.value = "";
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
        >
          <option value="">Berufsgruppe hinzufügen</option>

          {availableOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 space-y-2">
        {selectedOptions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-3 text-sm text-gray-500">
            Noch keine Berufsgruppe gewählt.
          </div>
        ) : (
          selectedOptions.map((option, index) => (
            <div
              key={option.value}
              draggable
              onDragStart={() => setDraggedValue(option.value)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => dropPosition(option.value)}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
            >
              <input type="hidden" name="positionValues" value={option.value} />

              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {index + 1}. {option.label}
                </div>

                {option.value === "lkw_fahrer_in" ? (
                  <div className="mt-1 text-xs font-medium text-blue-700">
                    Erstellt/aktualisiert automatisch LKW-Fahrer.
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => movePosition(option.value, -1)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  ↑
                </button>

                <button
                  type="button"
                  onClick={() => movePosition(option.value, 1)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  ↓
                </button>

                <button
                  type="button"
                  onClick={() => removePosition(option.value)}
                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  X
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}