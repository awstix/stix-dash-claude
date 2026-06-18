"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  deleteProjectPhoto,
  deleteProjectPhotos,
  moveProjectPhotos,
  refreshProjectPhotoLocations,
  updateProjectPhoto,
} from "./actions";

export type ProjectPhotoGalleryItem = {
  availableForDailyReports: boolean;
  cameraMake: string | null;
  cameraModel: string | null;
  capturedAt: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAddressLabel: string | null;
  gpsStreet: string | null;
  gpsHouseNumber: string | null;
  gpsPostcode: string | null;
  gpsCity: string | null;
  gpsCountry: string | null;
  gpsReverseGeocodedAt: string | null;
  id: string;
  fileSizeBytes: number;
  imageHeight: number | null;
  imageWidth: number | null;
  metadataTaken: boolean;
  notes: string | null;
  originalFileName: string | null;
  publicUrl: string;
  uploadedByName: string | null;
  uploadedByUserId: string | null;
  uploadedAt: string;
};

export type ProjectPhotoMoveProject = {
  id: string;
  label: string;
};

type PhotoViewMode = "details" | "large" | "medium" | "small";

const photoViewModes: {
  label: string;
  value: PhotoViewMode;
}[] = [
  { label: "Details", value: "details" },
  { label: "Groß", value: "large" },
  { label: "Mittel", value: "medium" },
  { label: "Klein", value: "small" },
];

const photoGridClasses: Record<PhotoViewMode, string> = {
  details: "mt-4 grid grid-cols-1 gap-3",
  large: "mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3",
  medium: "mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5",
  small: "mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8",
};

export function ProjectPhotoGallery({
  currentProjectId,
  moveProjects,
  photos,
}: {
  currentProjectId: string;
  moveProjects: ProjectPhotoMoveProject[];
  photos: ProjectPhotoGalleryItem[];
}) {
  const router = useRouter();
  const [isPhotoActionPending, startPhotoActionTransition] = useTransition();
  const [moveTargetProjectId, setMoveTargetProjectId] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<PhotoViewMode>("details");
  const selectedPhoto =
    selectedIndex === null ? null : (photos[selectedIndex] ?? null);
  const hasMultiplePhotos = photos.length > 1;
  const visiblePhotoIds = new Set(photos.map((photo) => photo.id));
  const selectedPhotoIdList = Array.from(selectedPhotoIds).filter((photoId) =>
    visiblePhotoIds.has(photoId),
  );
  const selectedCount = selectedPhotoIdList.length;
  const allPhotosSelected = photos.length > 0 && selectedCount === photos.length;
  const selectableMoveProjects = moveProjects.filter(
    (project) => project.id !== currentProjectId,
  );
  const hasPhotosMissingGpsAddress = photos.some(
    (photo) =>
      photo.gpsLatitude !== null &&
      photo.gpsLongitude !== null &&
      !photo.gpsAddressLabel,
  );

  useEffect(() => {
    if (!selectedPhoto) return;

    function handleGalleryKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedIndex(null);
      }

      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) =>
          current === null
            ? current
            : getPreviousPhotoIndex(current, photos.length),
        );
      }

      if (event.key === "ArrowRight") {
        setSelectedIndex((current) =>
          current === null ? current : getNextPhotoIndex(current, photos.length),
        );
      }
    }

    document.addEventListener("keydown", handleGalleryKey);
    return () => document.removeEventListener("keydown", handleGalleryKey);
  }, [photos.length, selectedPhoto]);

  if (photos.length === 0) {
    return (
      <p className="mt-4 text-sm text-gray-500">
        Noch keine Fotos für dieses Projekt hochgeladen.
      </p>
    );
  }

  function deleteSelectedPhoto(photo: ProjectPhotoGalleryItem) {
    const confirmed = window.confirm(
      "Foto wirklich löschen? Die Datei wird aus der Projektakte entfernt.",
    );

    if (!confirmed) return;

    startPhotoActionTransition(async () => {
      try {
        await deleteProjectPhoto(photo.id);
        setSelectedIndex(null);
        setSelectedPhotoIds((current) => {
          const next = new Set(current);
          next.delete(photo.id);
          return next;
        });
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Foto konnte nicht gelöscht werden.",
        );
      }
    });
  }

  function savePhotoNote(photo: ProjectPhotoGalleryItem, notes: string) {
    startPhotoActionTransition(async () => {
      try {
        await updateProjectPhoto({
          availableForDailyReports: photo.availableForDailyReports,
          id: photo.id,
          notes,
        });
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Notiz konnte nicht gespeichert werden.",
        );
      }
    });
  }

  function togglePhotoSelection(photoId: string, checked: boolean) {
    setSelectedPhotoIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(photoId);
      } else {
        next.delete(photoId);
      }

      return next;
    });
  }

  function selectAllPhotos(checked: boolean) {
    setSelectedPhotoIds(
      checked ? new Set(photos.map((photo) => photo.id)) : new Set(),
    );
  }

  function deleteSelectedPhotos() {
    if (selectedCount === 0) return;

    const confirmed = window.confirm(
      `${selectedCount} Foto${selectedCount === 1 ? "" : "s"} wirklich löschen? Die Dateien werden aus der Projektakte entfernt.`,
    );

    if (!confirmed) return;

    startPhotoActionTransition(async () => {
      try {
        await deleteProjectPhotos(selectedPhotoIdList);
        setSelectedIndex(null);
        setSelectedPhotoIds(new Set());
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Fotos konnten nicht gelöscht werden.",
        );
      }
    });
  }

  function moveSelectedPhotos() {
    if (selectedCount === 0) return;

    if (!moveTargetProjectId) {
      alert("Bitte eine Zielbaustelle auswählen.");
      return;
    }

    const targetProject = moveProjects.find(
      (project) => project.id === moveTargetProjectId,
    );
    const confirmed = window.confirm(
      `${selectedCount} Foto${selectedCount === 1 ? "" : "s"} nach "${targetProject?.label ?? "Zielbaustelle"}" verschieben?`,
    );

    if (!confirmed) return;

    startPhotoActionTransition(async () => {
      try {
        await moveProjectPhotos({
          photoIds: selectedPhotoIdList,
          targetProjectId: moveTargetProjectId,
        });
        setMoveTargetProjectId("");
        setSelectedIndex(null);
        setSelectedPhotoIds(new Set());
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Fotos konnten nicht verschoben werden.",
        );
      }
    });
  }

  function downloadSelectedPhotos() {
    for (const photo of photos) {
      if (selectedPhotoIds.has(photo.id)) {
        downloadPhoto(photo);
      }
    }
  }

  function refreshGpsLocations() {
    startPhotoActionTransition(async () => {
      try {
        const result = await refreshProjectPhotoLocations(currentProjectId);
        alert(
          result.updated === 0
            ? "Keine neuen GPS-Orte ergänzt."
            : `${result.updated} GPS-Ort${result.updated === 1 ? "" : "e"} ergänzt.`,
        );
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "GPS-Orte konnten nicht ergänzt werden.",
        );
      }
    });
  }

  return (
    <>
      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800">
              <input
                checked={allPhotosSelected}
                className="h-4 w-4"
                disabled={isPhotoActionPending}
                onChange={(event) => selectAllPhotos(event.target.checked)}
                type="checkbox"
              />
              Alle markieren
            </label>
            <span className="text-xs font-semibold text-gray-600">
              {selectedCount} ausgewählt
            </span>
            <span className="text-xs text-gray-500">
              Auswahl löschen oder in eine andere Baustelle verschieben.
            </span>
            {hasPhotosMissingGpsAddress ? (
              <button
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                disabled={isPhotoActionPending}
                onClick={refreshGpsLocations}
                type="button"
              >
                {isPhotoActionPending
                  ? "Ergänzt..."
                  : "GPS-Orte ergänzen (OSM)"}
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <PhotoViewModeSelector
              onChange={setViewMode}
              viewMode={viewMode}
            />
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-gray-900 disabled:opacity-60"
              disabled={
                selectedCount === 0 ||
                selectableMoveProjects.length === 0 ||
                isPhotoActionPending
              }
              onChange={(event) => setMoveTargetProjectId(event.target.value)}
              value={moveTargetProjectId}
            >
              <option value="">
                {selectableMoveProjects.length === 0
                  ? "Keine Zielbaustelle vorhanden"
                  : "Zielbaustelle auswählen"}
              </option>
              {selectableMoveProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.label}
                </option>
              ))}
            </select>
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              disabled={
                selectedCount === 0 || !moveTargetProjectId || isPhotoActionPending
              }
              onClick={moveSelectedPhotos}
              type="button"
            >
              Verschieben
            </button>
            <button
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
              disabled={selectedCount === 0 || isPhotoActionPending}
              onClick={downloadSelectedPhotos}
              type="button"
            >
              Herunterladen
            </button>
            <button
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              disabled={selectedCount === 0 || isPhotoActionPending}
              onClick={deleteSelectedPhotos}
              type="button"
            >
              Löschen
            </button>
          </div>
        </div>
      </div>

      <div className={photoGridClasses[viewMode]}>
        {photos.map((photo, index) => (
          <PhotoGalleryCard
            index={index}
            key={photo.id}
            isPending={isPhotoActionPending}
            isSelected={selectedPhotoIds.has(photo.id)}
            onOpen={() => setSelectedIndex(index)}
            onToggle={(checked) => togglePhotoSelection(photo.id, checked)}
            photo={photo}
            viewMode={viewMode}
          />
        ))}
      </div>

      {selectedPhoto ? (
        <PhotoDetailModal
          currentIndex={selectedIndex ?? 0}
          hasMultiplePhotos={hasMultiplePhotos}
          isDeleting={isPhotoActionPending}
          key={selectedPhoto.id}
          onClose={() => setSelectedIndex(null)}
          onDelete={() => deleteSelectedPhoto(selectedPhoto)}
          onDownload={() => downloadPhoto(selectedPhoto)}
          onNext={() =>
            setSelectedIndex((current) =>
              current === null
                ? current
                : getNextPhotoIndex(current, photos.length),
            )
          }
          onPrevious={() =>
            setSelectedIndex((current) =>
              current === null
                ? current
                : getPreviousPhotoIndex(current, photos.length),
            )
          }
          onSaveNote={(notes) => savePhotoNote(selectedPhoto, notes)}
          photo={selectedPhoto}
          totalCount={photos.length}
        />
      ) : null}
    </>
  );
}

function PhotoViewModeSelector({
  onChange,
  viewMode,
}: {
  onChange: (viewMode: PhotoViewMode) => void;
  viewMode: PhotoViewMode;
}) {
  return (
    <div
      aria-label="Fotoansicht"
      className="flex w-fit overflow-hidden rounded-lg border border-gray-300 bg-white"
      role="group"
    >
      {photoViewModes.map((mode) => (
        <button
          className={`border-r border-gray-200 px-3 py-2 text-xs font-semibold last:border-r-0 ${
            viewMode === mode.value
              ? "bg-gray-900 text-white"
              : "text-gray-800 hover:bg-gray-50"
          }`}
          key={mode.value}
          onClick={() => onChange(mode.value)}
          type="button"
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

function PhotoGalleryCard({
  index,
  isPending,
  isSelected,
  onOpen,
  onToggle,
  photo,
  viewMode,
}: {
  index: number;
  isPending: boolean;
  isSelected: boolean;
  onOpen: () => void;
  onToggle: (checked: boolean) => void;
  photo: ProjectPhotoGalleryItem;
  viewMode: PhotoViewMode;
}) {
  if (viewMode === "details") {
    return (
      <article
        className={`overflow-hidden rounded-lg border p-2 transition ${
          isSelected ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-50"
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-800">
            <input
              checked={isSelected}
              className="h-4 w-4"
              disabled={isPending}
              onChange={(event) => onToggle(event.target.checked)}
              type="checkbox"
            />
            Markieren
          </label>
        </div>

        <button
          className="grid w-full grid-cols-1 gap-3 text-left transition hover:opacity-90 sm:grid-cols-[150px_1fr]"
          onClick={onOpen}
          type="button"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-white">
            <Image
              alt={`Projektfoto ${index + 1}`}
              className="object-cover"
              fill
              sizes="150px"
              src={photo.publicUrl}
              unoptimized
            />
          </div>

          <div className="min-w-0">
            <PhotoCardHeader photo={photo} />

            <div className="mt-2 rounded-lg bg-white p-2 text-xs text-gray-700">
              <span className="font-semibold text-gray-900">Notiz:</span>{" "}
              {photo.notes || "Ohne Notiz"}
            </div>

            <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
              <PhotoMetaItem
                label="Aufnahme"
                value={photo.capturedAt ? formatDateTime(photo.capturedAt) : "-"}
              />
              <PhotoMetaItem label="Kamera" value={getCameraLabel(photo)} />
              <PhotoMetaItem label="GPS-Ort" value={getGpsSummaryLabel(photo)} />
              <PhotoMetaItem label="Bildgröße" value={getImageSizeLabel(photo)} />
            </div>
          </div>
        </button>
      </article>
    );
  }

  return (
    <article
      className={`relative overflow-hidden rounded-lg border bg-white transition ${
        isSelected ? "border-blue-300 ring-2 ring-blue-100" : "border-gray-200"
      }`}
    >
      <label className="absolute left-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/95 shadow">
        <span className="sr-only">Foto markieren</span>
        <input
          checked={isSelected}
          className="h-4 w-4"
          disabled={isPending}
          onChange={(event) => onToggle(event.target.checked)}
          type="checkbox"
        />
      </label>

      <button
        className="block w-full text-left transition hover:opacity-90"
        onClick={onOpen}
        type="button"
      >
        <div className="relative aspect-[4/3] w-full bg-gray-100">
          <Image
            alt={`Projektfoto ${index + 1}`}
            className="object-cover"
            fill
            sizes={getPhotoImageSizes(viewMode)}
            src={photo.publicUrl}
            unoptimized
          />
        </div>

        {viewMode !== "small" ? (
          <div className="min-w-0 p-2">
            <div className="truncate text-xs font-semibold text-gray-900">
              {formatDateTime(photo.uploadedAt)}
            </div>
            {viewMode === "large" ? (
              <>
                <div className="mt-1 truncate text-xs text-gray-500">
                  {getUploaderLabel(photo)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <PhotoPill
                    label={photo.metadataTaken ? "Metadaten" : "Ohne Metadaten"}
                    tone={photo.metadataTaken ? "green" : "gray"}
                  />
                  {photo.availableForDailyReports ? (
                    <PhotoPill label="Bericht" tone="blue" />
                  ) : null}
                </div>
                <div className="mt-2 line-clamp-2 text-xs text-gray-600">
                  {photo.notes || "Ohne Notiz"}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </button>
    </article>
  );
}

function PhotoCardHeader({ photo }: { photo: ProjectPhotoGalleryItem }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="text-xs font-semibold text-gray-900">
        Hochgeladen {formatDateTime(photo.uploadedAt)} · {getUploaderLabel(photo)}
      </div>
      <PhotoPill
        label={photo.metadataTaken ? "Metadaten übernommen" : "Ohne Metadaten"}
        tone={photo.metadataTaken ? "green" : "gray"}
      />
      {photo.availableForDailyReports ? (
        <PhotoPill label="Bautagesbericht" tone="blue" />
      ) : null}
    </div>
  );
}

function PhotoDetailModal({
  currentIndex,
  hasMultiplePhotos,
  isDeleting,
  onClose,
  onDelete,
  onDownload,
  onNext,
  onPrevious,
  onSaveNote,
  photo,
  totalCount,
}: {
  currentIndex: number;
  hasMultiplePhotos: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSaveNote: (notes: string) => void;
  photo: ProjectPhotoGalleryItem;
  totalCount: number;
}) {
  const [notes, setNotes] = useState(photo.notes ?? "");
  const [isEditingNote, setIsEditingNote] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="grid max-h-[92vh] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-2xl lg:grid-cols-[1.4fr_0.8fr]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative min-h-[320px] bg-black lg:min-h-[640px]">
          <Image
            alt="Projektfoto groß"
            className="object-contain"
            fill
            sizes="(min-width: 1024px) 65vw, 100vw"
            src={photo.publicUrl}
            unoptimized
          />
          {hasMultiplePhotos ? (
            <>
              <button
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow hover:bg-white"
                onClick={onPrevious}
                type="button"
              >
                Zurück
              </button>
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow hover:bg-white"
                onClick={onNext}
                type="button"
              >
                Vor
              </button>
            </>
          ) : null}
        </div>

        <aside className="max-h-[92vh] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Fotodetails
              </h3>
              <p className="mt-1 text-xs font-medium text-gray-500">
                Foto {currentIndex + 1} von {totalCount}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                aria-label="Foto herunterladen"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                disabled={isDeleting}
                onClick={onDownload}
                title="Foto herunterladen"
                type="button"
              >
                <DownloadIcon />
              </button>
              <button
                aria-label="Foto löschen"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60"
                disabled={isDeleting}
                onClick={onDelete}
                title="Foto löschen"
                type="button"
              >
                <TrashIcon />
              </button>
              <button
                aria-label="Fotodetails schließen"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                disabled={isDeleting}
                onClick={onClose}
                title="Schließen"
                type="button"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <PhotoPill
              label={
                photo.metadataTaken ? "Metadaten übernommen" : "Ohne Metadaten"
              }
              tone={photo.metadataTaken ? "green" : "gray"}
            />
            {photo.availableForDailyReports ? (
              <PhotoPill label="Bautagesbericht" tone="blue" />
            ) : null}
          </div>

          {hasMultiplePhotos ? (
            <div className="mt-4 flex w-fit overflow-hidden rounded-lg border border-gray-200 bg-white">
              <button
                className="border-r border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                onClick={onPrevious}
                type="button"
              >
                Zurück
              </button>
              <button
                className="px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                onClick={onNext}
                type="button"
              >
                Vor
              </button>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase text-gray-500">
                Notiz
              </span>
              {!isEditingNote ? (
                <button
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  disabled={isDeleting}
                  onClick={() => setIsEditingNote(true)}
                  type="button"
                >
                  Notiz bearbeiten
                </button>
              ) : null}
            </div>

            {isEditingNote ? (
              <>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                  disabled={isDeleting}
                  onChange={(event) => setNotes(event.currentTarget.value)}
                  placeholder="Notiz zum Foto"
                  value={notes}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
                    disabled={
                      isDeleting ||
                      notes.trim() === (photo.notes ?? "").trim()
                    }
                    onClick={() => {
                      onSaveNote(notes);
                      setIsEditingNote(false);
                    }}
                    type="button"
                  >
                    {isDeleting ? "Speichert..." : "Notiz speichern"}
                  </button>
                  <button
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                    disabled={isDeleting}
                    onClick={() => {
                      setNotes(photo.notes ?? "");
                      setIsEditingNote(false);
                    }}
                    type="button"
                  >
                    Abbrechen
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-2 whitespace-pre-wrap">
                {photo.notes || "Ohne Notiz"}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
            <DetailRow
              label="Hochgeladen"
              value={`${formatDateTime(photo.uploadedAt)} · ${getUploaderLabel(
                photo,
              )}`}
            />
            <DetailRow label="Aufnahme" value={getCapturedAtLabel(photo)} />
            <DetailRow label="Kamera" value={getCameraLabel(photo)} />
            <DetailRow label="Bildgröße" value={getImageSizeLabel(photo)} />
            <DetailRow
              label="Originaldatei"
              value={photo.originalFileName || "-"}
            />
            <DetailRow
              label="Metadaten"
              value={
                photo.metadataTaken
                  ? "Beim Upload übernommen"
                  : "Beim Upload nicht übernommen"
              }
            />
          </div>

          <PhotoLocationMap photo={photo} />

          <DetailRow
            className="mt-4"
            label="Adresse ermittelt"
            value={getAddressResolvedLabel(photo)}
          />
        </aside>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 15H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PhotoLocationMap({ photo }: { photo: ProjectPhotoGalleryItem }) {
  const mapUrl = getPhotoMapEmbedUrl(photo);
  const openMapUrl = getOpenStreetMapUrl(photo);

  if (!mapUrl || !openMapUrl) {
    return null;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-2">
        <div>
          <div className="text-xs font-semibold uppercase text-gray-500">
            Karte
          </div>
          <div className="mt-0.5 text-xs font-semibold text-gray-900">
            {getPhotoLocationHeader(photo)}
          </div>
        </div>
        <a
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          href={openMapUrl}
          rel="noreferrer"
          target="_blank"
        >
          OSM öffnen
        </a>
      </div>
      <iframe
        className="h-56 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={mapUrl}
        title="Fotoaufnahmeort"
      />
    </div>
  );
}

function DetailRow({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={`rounded-lg border border-gray-100 bg-gray-50 p-3 ${className}`}>
      <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
      <div className="mt-1 break-words font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function PhotoMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-2">
      <div className="text-[11px] font-semibold uppercase text-gray-500">
        {label}
      </div>
      <div className="mt-1 break-words font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function PhotoPill({
  label,
  tone,
}: {
  label: string;
  tone: "blue" | "gray" | "green";
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-800",
    gray: "bg-gray-100 text-gray-700",
    green: "bg-green-100 text-green-800",
  };

  return (
    <span
      className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors[tone]}`}
    >
      {label}
    </span>
  );
}

function getCameraLabel(photo: ProjectPhotoGalleryItem) {
  return [photo.cameraMake, photo.cameraModel].filter(Boolean).join(" ") || "-";
}

function getUploaderLabel(photo: ProjectPhotoGalleryItem) {
  return photo.uploadedByName || "Unbekannt";
}

function getCapturedAtLabel(photo: ProjectPhotoGalleryItem) {
  return photo.capturedAt ? formatDateTime(photo.capturedAt) : "-";
}

function getGpsLabel(photo: ProjectPhotoGalleryItem) {
  if (photo.gpsLatitude === null || photo.gpsLongitude === null) {
    return "-";
  }

  return `${roundGps(photo.gpsLatitude)}, ${roundGps(photo.gpsLongitude)}`;
}

function getAddressResolvedLabel(photo: ProjectPhotoGalleryItem) {
  if (photo.gpsReverseGeocodedAt) {
    return `${formatDateTime(photo.gpsReverseGeocodedAt)} über OpenStreetMap`;
  }

  if (photo.gpsLatitude !== null && photo.gpsLongitude !== null) {
    return "Noch nicht abgefragt";
  }

  return "Keine GPS-Daten im Foto";
}

function getPhotoLocationHeader(photo: ProjectPhotoGalleryItem) {
  if (photo.gpsAddressLabel) {
    return photo.gpsAddressLabel;
  }

  return "GPS-Position aus Foto-Metadaten";
}

function getGpsSummaryLabel(photo: ProjectPhotoGalleryItem) {
  const coordinateLabel = getGpsLabel(photo);

  if (!photo.gpsAddressLabel) {
    return coordinateLabel;
  }

  if (coordinateLabel === "-") {
    return photo.gpsAddressLabel;
  }

  return `${photo.gpsAddressLabel} · ${coordinateLabel}`;
}

function getPhotoMapEmbedUrl(photo: ProjectPhotoGalleryItem) {
  if (photo.gpsLatitude === null || photo.gpsLongitude === null) {
    return null;
  }

  const latitude = photo.gpsLatitude;
  const longitude = photo.gpsLongitude;
  const latitudeDelta = 0.002;
  const longitudeDelta = 0.003;
  const bbox = [
    longitude - longitudeDelta,
    latitude - latitudeDelta,
    longitude + longitudeDelta,
    latitude + latitudeDelta,
  ].join(",");
  const url = new URL("https://www.openstreetmap.org/export/embed.html");
  url.searchParams.set("bbox", bbox);
  url.searchParams.set("layer", "mapnik");
  url.searchParams.set("marker", `${latitude},${longitude}`);

  return url.toString();
}

function getOpenStreetMapUrl(photo: ProjectPhotoGalleryItem) {
  if (photo.gpsLatitude === null || photo.gpsLongitude === null) {
    return null;
  }

  const url = new URL("https://www.openstreetmap.org/");
  url.hash = `map=18/${photo.gpsLatitude}/${photo.gpsLongitude}`;

  return url.toString();
}

function getImageSizeLabel(photo: ProjectPhotoGalleryItem) {
  const fileSize = formatPhotoFileSize(photo.fileSizeBytes);

  if (!photo.imageWidth || !photo.imageHeight) {
    return fileSize;
  }

  return `${photo.imageWidth} x ${photo.imageHeight}px · ${fileSize}`;
}

function formatPhotoFileSize(bytes: number) {
  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(bytes / (1024 * 1024))} MB`;
}

function getPhotoImageSizes(viewMode: PhotoViewMode) {
  if (viewMode === "large") {
    return "(min-width: 1280px) 28vw, (min-width: 768px) 45vw, 100vw";
  }

  if (viewMode === "medium") {
    return "(min-width: 1280px) 18vw, (min-width: 768px) 30vw, 50vw";
  }

  return "(min-width: 1280px) 12vw, (min-width: 640px) 22vw, 33vw";
}

function downloadPhoto(photo: ProjectPhotoGalleryItem) {
  const link = document.createElement("a");
  link.href = photo.publicUrl;
  link.download = getPhotoDownloadFileName(photo);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function getPhotoDownloadFileName(photo: ProjectPhotoGalleryItem) {
  if (photo.originalFileName) {
    return photo.originalFileName;
  }

  const urlParts = photo.publicUrl.split("/");
  return urlParts.at(-1) || `projektfoto-${photo.id}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function roundGps(value: number) {
  return `${Math.round(value * 100000) / 100000}`;
}

function getNextPhotoIndex(currentIndex: number, totalCount: number) {
  if (totalCount <= 1) return currentIndex;
  return currentIndex + 1 >= totalCount ? 0 : currentIndex + 1;
}

function getPreviousPhotoIndex(currentIndex: number, totalCount: number) {
  if (totalCount <= 1) return currentIndex;
  return currentIndex - 1 < 0 ? totalCount - 1 : currentIndex - 1;
}
