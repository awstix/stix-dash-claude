"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import {
  ProjectFileDropInput,
  ProjectPhotoNoteFields,
} from "./ProjectFileDropInput";
import { uploadPhotosDirect } from "./uploadPhotosDirect";

async function getCurrentGpsPosition() {
  if (!navigator.geolocation) return null;

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 5_000,
      });
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude,
    };
  } catch {
    return null;
  }
}

export function ProjectInlinePhotoUpload({
  projectId,
  projectLabel,
}: {
  projectId: string;
  projectLabel: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [pickerFiles, setPickerFiles] = useState<File[]>([]);
  const [cameraFiles, setCameraFiles] = useState<File[]>([]);
  const [cameraGps, setCameraGps] = useState<{ latitude: number; longitude: number; altitude: number | null } | null>(
    null,
  );
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const selectedFiles = [...pickerFiles, ...cameraFiles];

  async function handleCameraCapture(event: FormEvent<HTMLInputElement>) {
    const files = event.currentTarget.files;
    if (!files || files.length === 0) return;
    setCameraFiles((current) => [...current, ...Array.from(files)]);
    const position = await getCurrentGpsPosition();
    if (position) setCameraGps(position);
    event.currentTarget.value = "";
  }

  // pickerFiles/cameraFiles state is the single source of truth for what
  // actually gets uploaded (not the native file input's own FileList), so
  // removing an already-selected/captured photo before upload just means
  // dropping it from state here - no DOM FileList surgery needed.
  function removeSelectedFile(index: number) {
    if (index < pickerFiles.length) {
      setPickerFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    } else {
      const cameraIndex = index - pickerFiles.length;
      setCameraFiles((current) => current.filter((_, fileIndex) => fileIndex !== cameraIndex));
    }
  }

  function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedFiles.length === 0) {
      alert("Bitte mindestens ein Foto auswählen oder mit der Kamera aufnehmen.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const notes = String(formData.get("notes") ?? "");
    const photoNotes = formData.getAll("photoNotes").map((value) => String(value));
    const takeMetadata = formData.get("takeMetadata") === "on";
    const compressPhotos = formData.get("compressPhotos") === "on";
    const availableForDailyReports =
      formData.get("availableForDailyReports") === "on";

    startTransition(async () => {
      try {
        setUploadProgress({ done: 0, total: selectedFiles.length });
        // Jedes Foto wird direkt vom Browser in den Cloud-Speicher
        // hochgeladen (nicht über diesen Server) - so gibt es kein
        // Größenlimit mehr, auch nicht für einzelne große Originalfotos.
        await uploadPhotosDirect({
          files: selectedFiles,
          projectId,
          notes,
          photoNotes,
          availableForDailyReports,
          takeMetadata,
          compressPhotos,
          cameraGps,
          onProgress: (done, total) => setUploadProgress({ done, total }),
        });
        formRef.current?.reset();
        setPickerFiles([]);
        setCameraFiles([]);
        setCameraGps(null);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Fotos konnten nicht hochgeladen werden.",
        );
      } finally {
        setUploadProgress(null);
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
            {isPending
              ? uploadProgress
                ? `Lädt hoch... (${uploadProgress.done}/${uploadProgress.total})`
                : "Lädt hoch..."
              : "Hochladen"}
          </button>
        </div>

        <input
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleCameraCapture}
          ref={cameraInputRef}
          type="file"
        />
        <div className="grid grid-cols-2 items-stretch gap-3">
          <ProjectFileDropInput
            accept="image/*"
            emptyLabel="Fotos auswählen oder ablegen"
            multiple
            name="photos"
            onFilesSelected={setPickerFiles}
            selectedLabel="Drag & Drop oder Klick zum Auswählen"
          />
          <button
            className="flex h-full min-h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-center transition hover:bg-gray-50"
            onClick={() => cameraInputRef.current?.click()}
            type="button"
          >
            <ActionIcon name="camera" className="h-5 w-5 text-gray-700" />
            <span className="text-sm font-semibold text-gray-900">
              Kamera{cameraFiles.length > 0 ? ` (${cameraFiles.length})` : ""}
            </span>
            <span className="text-xs font-medium text-gray-500">Direkt Foto aufnehmen</span>
          </button>
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

        <ProjectPhotoNoteFields files={selectedFiles} onRemove={removeSelectedFile} />

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
