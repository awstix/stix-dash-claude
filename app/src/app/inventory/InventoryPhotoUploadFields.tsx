"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

export type InventoryPhotoFormValue = {
  fileName: string;
  id: string;
  isPrimary: boolean;
  originalName: string | null;
  url: string;
};

type PendingPhoto = {
  name: string;
  previewUrl: string;
};

export function InventoryPhotoUploadFields({
  photos = [],
}: {
  photos?: InventoryPhotoFormValue[];
}) {
  const [pendingCameraPhotos, setPendingCameraPhotos] = useState<PendingPhoto[]>(
    [],
  );
  const [pendingGalleryPhotos, setPendingGalleryPhotos] = useState<
    PendingPhoto[]
  >([]);
  const pendingPhotos = useMemo(
    () => [...pendingGalleryPhotos, ...pendingCameraPhotos],
    [pendingCameraPhotos, pendingGalleryPhotos],
  );
  const pendingPhotosRef = useRef<PendingPhoto[]>([]);

  useEffect(() => {
    pendingPhotosRef.current = pendingPhotos;
  }, [pendingPhotos]);

  useEffect(
    () => () => {
      pendingPhotosRef.current.forEach((photo) =>
        URL.revokeObjectURL(photo.previewUrl),
      );
    },
    [],
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-bold text-gray-900">Fotos</h3>
      <p className="mt-1 text-xs leading-5 text-gray-500">
        Mehrere Fotos können direkt beim Anlegen oder Bearbeiten hochgeladen
        werden. Markiere ein Foto als Hauptfoto für Listen und Übersichten.
      </p>

      {photos.length > 0 ? (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Vorhandene Fotos
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
            {photos.map((photo) => (
              <label
                className="block cursor-pointer rounded-xl border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-800 hover:border-gray-400"
                key={photo.id}
              >
                <span className="relative block aspect-square overflow-hidden rounded-lg bg-gray-100">
                  <Image
                    alt={photo.originalName ?? photo.fileName}
                    className="object-cover"
                    fill
                    sizes="120px"
                    src={photo.url}
                  />
                </span>
                <span className="mt-2 flex items-center gap-2">
                  <input
                    defaultChecked={photo.isPrimary}
                    name="primaryExistingPhotoId"
                    type="radio"
                    value={photo.id}
                  />
                  Hauptfoto
                </span>
                <span className="mt-1 block truncate text-[11px] text-gray-500">
                  {photo.originalName ?? photo.fileName}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-800">
          Fotos auswählen
          <input
            accept="image/jpeg,image/png,image/webp"
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            multiple
            name="photos"
            onChange={(event) => {
              pendingGalleryPhotos.forEach((photo) =>
                URL.revokeObjectURL(photo.previewUrl),
              );
              setPendingGalleryPhotos(
                Array.from(event.currentTarget.files ?? []).map((file) => ({
                  name: file.name,
                  previewUrl: URL.createObjectURL(file),
                })),
              );
            }}
            type="file"
          />
        </label>

        <label className="rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-800">
          Foto mit Kamera aufnehmen
          <input
            accept="image/*"
            capture="environment"
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            name="photos"
            onChange={(event) => {
              pendingCameraPhotos.forEach((photo) =>
                URL.revokeObjectURL(photo.previewUrl),
              );
              setPendingCameraPhotos(
                Array.from(event.currentTarget.files ?? []).map((file) => ({
                  name: file.name,
                  previewUrl: URL.createObjectURL(file),
                })),
              );
            }}
            type="file"
          />
          <span className="mt-2 block text-xs font-medium leading-5 text-gray-500">
            Auf dem Handy öffnet sich damit direkt die Kamera.
          </span>
        </label>
      </div>

      {pendingPhotos.length > 0 ? (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Neue Fotos
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
            {pendingPhotos.map((photo, index) => (
              <label
                className="block cursor-pointer rounded-xl border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-800 hover:border-gray-400"
                key={`${photo.name}-${photo.previewUrl}`}
              >
                <span className="relative block aspect-square overflow-hidden rounded-lg bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={photo.name}
                    className="h-full w-full object-cover"
                    src={photo.previewUrl}
                  />
                </span>
                <span className="mt-2 flex items-center gap-2">
                  <input
                    defaultChecked={photos.length === 0 && index === 0}
                    name="primaryNewPhotoIndex"
                    type="radio"
                    value={String(index)}
                  />
                  Hauptfoto
                </span>
                <span className="mt-1 block truncate text-[11px] text-gray-500">
                  {photo.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
