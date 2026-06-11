"use client";

import { DragEvent, InputHTMLAttributes, useEffect, useRef, useState } from "react";

type ProjectFileDropInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "accept" | "disabled" | "multiple" | "name" | "required"
> & {
  compact?: boolean;
  emptyLabel: string;
  selectedLabel: string;
};

export function ProjectFileDropInput({
  accept,
  compact = false,
  disabled,
  emptyLabel,
  multiple,
  name,
  required,
  selectedLabel,
}: ProjectFileDropInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectionText, setSelectionText] = useState("");

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;

    if (!form) return;

    function clearSelection() {
      setSelectionText("");
    }

    form.addEventListener("reset", clearSelection);
    return () => form.removeEventListener("reset", clearSelection);
  }, []);

  function updateSelection(files: FileList | null) {
    if (!files || files.length === 0) {
      setSelectionText("");
      return;
    }

    setSelectionText(
      files.length === 1
        ? files[0]?.name ?? selectedLabel
        : `${files.length} Dateien ausgewählt`,
    );
  }

  function dropFiles(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);

    if (disabled || !inputRef.current) return;

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    inputRef.current.files = files;
    updateSelection(files);
    inputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <label
      className={`mt-1 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 text-center transition ${
        compact ? "min-h-10 py-2" : "min-h-28 py-4"
      } ${
        dragActive
          ? "border-gray-900 bg-white"
          : "border-gray-300 bg-white hover:bg-gray-50"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragActive(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={dropFiles}
    >
      <input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        multiple={multiple}
        name={name}
        onChange={(event) => updateSelection(event.currentTarget.files)}
        ref={inputRef}
        required={required}
        type="file"
      />
      <span
        className={
          compact
            ? "max-w-full truncate text-xs font-semibold text-gray-900"
            : "text-sm font-semibold text-gray-900"
        }
      >
        {selectionText || emptyLabel}
      </span>
      <span
        className={
          compact
            ? "max-w-full truncate text-[11px] font-medium text-gray-500"
            : "mt-1 text-xs font-medium text-gray-500"
        }
      >
        {selectionText ? "Bereit zum Hochladen" : selectedLabel}
      </span>
    </label>
  );
}
