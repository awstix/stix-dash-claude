"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadProjectPhotos } from "./actions";
import {
  ProjectFileDropInput,
  ProjectPhotoNoteFields,
} from "./ProjectFileDropInput";

export function ProjectInlinePhotoUpload({
  projectId,
  projectLabel,
}: {
  projectId: string;
  projectLabel: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await uploadProjectPhotos(formData);
        formRef.current?.reset();
        setSelectedFiles([]);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Fotos konnten nicht hochgeladen werden.",
        );
      }
    });
  }

  return (
    <form
      className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3"
      encType="multipart/form-data"
      onSubmit={uploadPhotos}
      ref={formRef}
    >
      <input name="projectId" type="hidden" value={projectId} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-500">
              Foto hochladen
            </div>
            <div className="mt-1 w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              {projectLabel}
            </div>
          </div>

          <button
            className="w-fit rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Lädt hoch..." : "Hochladen"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr]">
          <label className="text-sm font-semibold text-gray-800">
            Fotos
            <ProjectFileDropInput
              accept="image/*"
              emptyLabel="Fotos auswählen oder ablegen"
              multiple
              name="photos"
              onFilesSelected={setSelectedFiles}
              required
              selectedLabel="Drag & Drop oder Klick zum Auswählen"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <label className="text-sm font-semibold text-gray-800">
            Gemeinsame Notiz als Vorgabe
            <textarea
              className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              name="notes"
              placeholder="Optional für alle Fotos ohne eigene Notiz"
            />
          </label>
        </div>

        <ProjectPhotoNoteFields files={selectedFiles} />

        <div className="flex flex-wrap gap-3">
          <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800">
            <input
              className="mt-0.5 h-4 w-4"
              name="compressPhotos"
              type="checkbox"
            />
            <span>
              Dateigröße reduzieren
              <span className="block font-medium text-gray-500">
                EXIF und GPS bleiben erhalten.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800">
            <input
              className="h-4 w-4"
              defaultChecked
              name="takeMetadata"
              type="checkbox"
            />
            Metadaten übernehmen
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800">
            <input
              className="h-4 w-4"
              defaultChecked
              name="availableForDailyReports"
              type="checkbox"
            />
            Bautagesbericht
          </label>
        </div>
      </div>
    </form>
  );
}
