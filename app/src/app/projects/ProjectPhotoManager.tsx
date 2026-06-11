"use client";

import { FormEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadProjectPhotos } from "./actions";
import { ProjectFileDropInput } from "./ProjectFileDropInput";
import {
  ProjectPhotoGallery,
  type ProjectPhotoGalleryItem,
} from "./ProjectPhotoGallery";

export type ProjectPhotoProjectOption = {
  id: string;
  label: string;
};

export type ProjectPhotoListItem = {
  availableForDailyReports: boolean;
  cameraMake: string | null;
  cameraModel: string | null;
  capturedAt: string | null;
  fileSizeBytes: number;
  gpsAddressLabel: string | null;
  gpsCity: string | null;
  gpsCountry: string | null;
  gpsHouseNumber: string | null;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
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
  const [isPending, startTransition] = useTransition();
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(
    () => new Set(),
  );
  const selectedInitialProjectId = projects.some(
    (project) => project.id === initialProjectId,
  )
    ? initialProjectId
    : "";
  const selectedInitialProject = projects.find(
    (project) => project.id === selectedInitialProjectId,
  );

  function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await uploadProjectPhotos(formData);
        formRef.current?.reset();
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
            {selectedInitialProject ? (
              <div className="mt-2 w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                Vorausgewählt: {selectedInitialProject.label}
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
                defaultValue={selectedInitialProjectId}
                name="projectId"
                required
              >
                <option value="">Projekt auswählen</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold text-gray-800">
              Fotos
              <ProjectFileDropInput
                accept="image/*"
                emptyLabel="Fotos auswählen oder ablegen"
                multiple
                name="photos"
                required
                selectedLabel="Drag & Drop oder Klick zum Auswählen"
              />
            </label>

            <label className="text-sm font-semibold text-gray-800">
              Hochgeladen von
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                name="uploadedByName"
                placeholder="Name"
                type="text"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <label className="text-sm font-semibold text-gray-800">
              Notiz für diese Fotos
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                name="notes"
                placeholder="z. B. Einbau Binder, Schadstelle, Lieferscheinbezug ..."
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              {isPending ? "Lädt hoch..." : "Fotos hochladen"}
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
    capturedAt: photo.capturedAt,
    gpsAddressLabel: photo.gpsAddressLabel,
    gpsCity: photo.gpsCity,
    gpsCountry: photo.gpsCountry,
    gpsHouseNumber: photo.gpsHouseNumber,
    gpsLatitude: photo.gpsLatitude,
    gpsLongitude: photo.gpsLongitude,
    gpsPostcode: photo.gpsPostcode,
    gpsReverseGeocodedAt: photo.gpsReverseGeocodedAt,
    gpsStreet: photo.gpsStreet,
    id: photo.id,
    imageHeight: photo.imageHeight,
    imageWidth: photo.imageWidth,
    metadataTaken: photo.metadataTaken,
    notes: photo.notes,
    originalFileName: photo.originalFileName,
    publicUrl: photo.publicUrl,
    uploadedByName: photo.uploadedByName,
    uploadedByUserId: photo.uploadedByUserId,
    uploadedAt: photo.uploadedAt,
  };
}
