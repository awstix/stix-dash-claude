"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import {
  ProjectFileDropInput,
  ProjectPhotoNoteFields,
} from "./ProjectFileDropInput";
import {
  ProjectPhotoGallery,
  type ProjectPhotoGalleryItem,
} from "./ProjectPhotoGallery";
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

export type ProjectPhotoProjectOption = {
  id: string;
  label: string;
};

export type ProjectPhotoListItem = {
  availableForDailyReports: boolean;
  cameraMake: string | null;
  cameraModel: string | null;
  cameraAperture: string | null;
  cameraExposureTime: string | null;
  cameraFocalLength: string | null;
  cameraIso: number | null;
  capturedAt: string | null;
  fileSizeBytes: number;
  gpsAddressLabel: string | null;
  gpsCity: string | null;
  gpsCountry: string | null;
  gpsHouseNumber: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsHeading: number | null;
  gpsAltitude: number | null;
  gpsPostcode: string | null;
  gpsReverseGeocodedAt: string | null;
  gpsStreet: string | null;
  id: string;
  imageHeight: number | null;
  imageWidth: number | null;
  metadataTaken: boolean;
  notes: string | null;
  originalFileName: string | null;
  projectId: string;
  projectName: string;
  projectNumber: string;
  publicUrl: string;
  uploadedByName: string | null;
  uploadedByUserId: string | null;
  uploadedAt: string;
};

export function ProjectPhotoManager({
  initialProjectId,
  photos,
  projects,
}: {
  initialProjectId?: string;
  photos: ProjectPhotoListItem[];
  projects: ProjectPhotoProjectOption[];
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
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(
    () => new Set(),
  );
  const selectedInitialProjectId = projects.some(
    (project) => project.id === initialProjectId,
  )
    ? initialProjectId
    : "";
  // Controlled, and deliberately not reset alongside the rest of the form
  // after a successful upload (see uploadPhotos below) - lets someone
  // upload a whole photo series into the same project without reselecting
  // it before every single photo.
  const [selectedProjectId, setSelectedProjectId] = useState(
    selectedInitialProjectId ?? "",
  );
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId,
  );

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
    if (!selectedProjectId) {
      alert("Bitte ein Projekt auswählen.");
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
          projectId: selectedProjectId,
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

  const photosForReports = photos.filter(
    (photo) => photo.availableForDailyReports,
  ).length;
  const photosWithMetadata = photos.filter((photo) => photo.metadataTaken).length;
  const photoGroups = getPhotoGroups(photos);

  function toggleProjectCard(projectId: string) {
    setCollapsedProjectIds((current) => {
      const next = new Set(current);

      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }

      return next;
    });
  }

  function expandAllProjectCards() {
    setCollapsedProjectIds(new Set());
  }

  function collapseAllProjectCards() {
    setCollapsedProjectIds(new Set(photoGroups.map((group) => group.projectId)));
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Fotos gesamt" value={`${photos.length}`} />
        <SummaryCard
          label="Für Bautagesbericht"
          value={`${photosForReports}`}
        />
        <SummaryCard label="Mit Metadaten" value={`${photosWithMetadata}`} />
      </div>

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Fotos hochladen
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Bilder werden projektbezogen abgelegt und können für spätere
              Bautagesberichte freigegeben werden.
            </p>
            {selectedProject ? (
              <div className="mt-2 w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                Ausgewählt: {selectedProject.label}
              </div>
            ) : null}
          </div>
        </div>

        <form
          className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]"
          encType="multipart/form-data"
          onSubmit={uploadPhotos}
          ref={formRef}
        >
          <div className="grid grid-cols-1 gap-4">
            <label className="text-sm font-semibold text-gray-800">
              Projekt
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                disabled={projects.length === 0}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                name="projectId"
                required
                value={selectedProjectId}
              >
                <option value="">Projekt auswählen</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </select>
            </label>

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
          </div>

          <div className="grid grid-cols-1 gap-4">
            <label className="text-sm font-semibold text-gray-800">
              Gemeinsame Notiz als Vorgabe
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                name="notes"
                placeholder="Optional für alle Fotos ohne eigene Notiz"
              />
            </label>

            <ProjectPhotoNoteFields
              files={selectedFiles}
              onRemove={removeSelectedFile}
              tone="gray"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-semibold text-gray-800">
                <input
                  className="mt-1 h-4 w-4"
                  name="compressPhotos"
                  type="checkbox"
                />
                <span>
                  Dateigröße reduzieren
                  <span className="block text-xs font-medium text-gray-500">
                    Original bleibt Standard. Bei Komprimierung bleiben EXIF,
                    Aufnahmedatum und GPS erhalten.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-semibold text-gray-800">
                <input
                  className="mt-1 h-4 w-4"
                  defaultChecked
                  name="takeMetadata"
                  type="checkbox"
                />
                <span>
                  Metadaten übernehmen
                  <span className="block text-xs font-medium text-gray-500">
                    EXIF, Aufnahmedatum, Kamera, GPS soweit vorhanden.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm font-semibold text-gray-800">
                <input
                  className="mt-1 h-4 w-4"
                  defaultChecked
                  name="availableForDailyReports"
                  type="checkbox"
                />
                <span>
                  Bautagesbericht
                  <span className="block text-xs font-medium text-gray-500">
                    Foto später im Bericht auswählbar machen.
                  </span>
                </span>
              </label>
            </div>

            <button
              className="w-fit rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
              disabled={isPending || projects.length === 0}
              type="submit"
            >
              {isPending
                ? uploadProgress
                  ? `Lädt hoch... (${uploadProgress.done}/${uploadProgress.total})`
                  : "Lädt hoch..."
                : "Fotos hochladen"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Fotoliste</h2>
            <p className="mt-1 text-sm text-gray-600">
              Projektfotos je Baustelle mit Auswahl, Verschieben und Großansicht.
            </p>
          </div>
          {photoGroups.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                onClick={expandAllProjectCards}
                type="button"
              >
                Alle öffnen
              </button>
              <button
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                onClick={collapseAllProjectCards}
                type="button"
              >
                Alle zuklappen
              </button>
            </div>
          ) : null}
        </div>

        {photos.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm font-medium text-gray-500">
            Noch keine Fotos hochgeladen.
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4">
            {photoGroups.map((group) => (
              <ProjectPhotoProjectCard
                collapsed={collapsedProjectIds.has(group.projectId)}
                group={group}
                key={group.projectId}
                moveProjects={projects}
                onToggle={() => toggleProjectCard(group.projectId)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

type ProjectPhotoGroup = {
  photos: ProjectPhotoGalleryItem[];
  projectId: string;
  projectLabel: string;
};

function ProjectPhotoProjectCard({
  collapsed,
  group,
  moveProjects,
  onToggle,
}: {
  collapsed: boolean;
  group: ProjectPhotoGroup;
  moveProjects: ProjectPhotoProjectOption[];
  onToggle: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      <button
        className="flex w-full flex-col gap-2 bg-white px-4 py-3 text-left hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
        onClick={onToggle}
        type="button"
      >
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900">
            {group.projectLabel}
          </div>
          <div className="mt-1 text-xs font-semibold text-gray-500">
            {group.photos.length} Foto{group.photos.length === 1 ? "" : "s"}
          </div>
        </div>
        <span className="w-fit rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
          {collapsed ? "Öffnen" : "Zuklappen"}
        </span>
      </button>

      {collapsed ? null : (
        <div className="p-4">
          <ProjectPhotoGallery
            currentProjectId={group.projectId}
            moveProjects={moveProjects}
            photos={group.photos}
          />
        </div>
      )}
    </article>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function getPhotoGroups(photos: ProjectPhotoListItem[]): ProjectPhotoGroup[] {
  const groups = new Map<string, ProjectPhotoGroup>();

  for (const photo of photos) {
    const existingGroup = groups.get(photo.projectId);
    const galleryPhoto = toGalleryPhoto(photo);

    if (existingGroup) {
      existingGroup.photos.push(galleryPhoto);
    } else {
      groups.set(photo.projectId, {
        photos: [galleryPhoto],
        projectId: photo.projectId,
        projectLabel: `${photo.projectNumber} · ${photo.projectName}`,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.projectLabel.localeCompare(b.projectLabel, "de-DE"),
  );
}

function toGalleryPhoto(photo: ProjectPhotoListItem): ProjectPhotoGalleryItem {
  return {
    availableForDailyReports: photo.availableForDailyReports,
    cameraMake: photo.cameraMake,
    cameraModel: photo.cameraModel,
    cameraAperture: photo.cameraAperture,
    cameraExposureTime: photo.cameraExposureTime,
    cameraFocalLength: photo.cameraFocalLength,
    cameraIso: photo.cameraIso,
    capturedAt: photo.capturedAt,
    gpsAddressLabel: photo.gpsAddressLabel,
    gpsCity: photo.gpsCity,
    gpsCountry: photo.gpsCountry,
    gpsHouseNumber: photo.gpsHouseNumber,
    gpsLatitude: photo.gpsLatitude,
    gpsLongitude: photo.gpsLongitude,
    gpsHeading: photo.gpsHeading,
    gpsAltitude: photo.gpsAltitude,
    gpsPostcode: photo.gpsPostcode,
    gpsReverseGeocodedAt: photo.gpsReverseGeocodedAt,
    gpsStreet: photo.gpsStreet,
    id: photo.id,
    fileSizeBytes: photo.fileSizeBytes,
    imageHeight: photo.imageHeight,
    imageWidth: photo.imageWidth,
    metadataTaken: photo.metadataTaken,
    notes: photo.notes,
    originalFileName: photo.originalFileName,
    projectNumber: photo.projectNumber,
    publicUrl: photo.publicUrl,
    uploadedByName: photo.uploadedByName,
    uploadedByUserId: photo.uploadedByUserId,
    uploadedAt: photo.uploadedAt,
  };
}
