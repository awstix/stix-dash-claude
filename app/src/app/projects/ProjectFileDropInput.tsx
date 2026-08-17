"use client";

import { DragEvent, InputHTMLAttributes, useEffect, useRef, useState } from "react";
import Image from "next/image";

type ProjectFileDropInputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "accept" | "disabled" | "multiple" | "name" | "required"
> & {
  compact?: boolean;
  emptyLabel: string;
  onFilesSelected?: (files: File[]) => void;
  selectedLabel: string;
};

export function ProjectFileDropInput({
  accept,
  compact = false,
  disabled,
  emptyLabel,
  multiple,
  name,
  onFilesSelected,
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
      onFilesSelected?.([]);
      return;
    }

    onFilesSelected?.(Array.from(files));
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

export function ProjectPhotoNoteFields({
  files,
  onRemove,
  tone = "white",
}: {
  files: File[];
  onRemove?: (index: number) => void;
  tone?: "gray" | "white";
}) {
  if (files.length === 0) return null;

  return (
    <div>
      <div className="text-sm font-semibold text-gray-800">
        Eigene Notiz je Foto
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        {files.map((file, index) => (
          <ProjectPhotoNoteField
            file={file}
            index={index}
            key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
            onRemove={onRemove}
            tone={tone}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectPhotoNoteField({
  file,
  index,
  onRemove,
  tone,
}: {
  file: File;
  index: number;
  onRemove?: (index: number) => void;
  tone: "gray" | "white";
}) {
  const [previewUrl] = useState(() => URL.createObjectURL(file));

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <div
      className={`relative grid grid-cols-[88px_1fr] gap-3 rounded-lg border border-gray-200 p-3 text-xs font-semibold text-gray-800 ${
        tone === "gray" ? "bg-gray-50" : "bg-white"
      }`}
    >
      {onRemove ? (
        <button
          aria-label={`${file.name} entfernen`}
          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 shadow-sm hover:bg-red-50 hover:text-red-700"
          onClick={() => onRemove(index)}
          title="Aus Auswahl entfernen"
          type="button"
        >
          ×
        </button>
      ) : null}
      <span className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
        <Image
          alt={`Vorschau ${file.name}`}
          className="object-cover"
          fill
          sizes="88px"
          src={previewUrl}
          unoptimized
        />
      </span>
      <label className="min-w-0">
        <span className="block truncate" title={file.name}>
          {index + 1}. {file.name}
        </span>
        <textarea
          className="mt-2 min-h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none focus:border-gray-900"
          name="photoNotes"
          placeholder="Notiz nur für dieses Foto"
        />
      </label>
    </div>
  );
}
