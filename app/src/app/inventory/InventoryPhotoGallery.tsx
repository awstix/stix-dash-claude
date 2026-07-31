"use client";

import Image from "next/image";
import { ActionIcon } from "@/components/ActionIcon";
import { useEffect, useRef, useState } from "react";
import { deleteInventoryPhoto } from "./actions";

export type InventoryPhotoGalleryItem = {
  createdAt: string;
  fileName: string;
  id: string;
  isPrimary: boolean;
  locationNote: string | null;
  mimeType: string | null;
  originalName: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  url: string;
};

const minimumZoom = 1;
const maximumZoom = 4;
const zoomStep = 0.25;

export function InventoryPhotoGallery({
  itemName,
  photos,
}: {
  itemName: string;
  photos: InventoryPhotoGalleryItem[];
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedPhoto =
    selectedIndex === null ? null : photos[selectedIndex] ?? null;

  function closeViewer() {
    setSelectedIndex(null);
  }

  function selectPrevious() {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length);
  }

  function selectNext() {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((selectedIndex + 1) % photos.length);
  }

  useEffect(() => {
    if (selectedIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) =>
          current === null ? current : (current - 1 + photos.length) % photos.length,
        );
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((current) =>
          current === null ? current : (current + 1) % photos.length,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, photos.length]);

  if (photos.length === 0) {
    return (
      <p className="mt-4 text-sm text-gray-500">
        Noch keine Fotos hochgeladen. Fotos können beim Bearbeiten des
        Inventarobjekts ergänzt werden.
      </p>
    );
  }

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
        {photos.map((photo, index) => (
          <button
            className="rounded-2xl border border-gray-200 bg-gray-50 p-2 text-left hover:bg-white hover:shadow-sm"
            key={photo.id}
            onClick={() => setSelectedIndex(index)}
            type="button"
          >
            <span className="relative block aspect-square overflow-hidden rounded-xl bg-gray-100">
              <Image
                alt={photo.originalName ?? itemName}
                className="object-cover"
                fill
                sizes="180px"
                src={photo.url}
              />
            </span>
            <span className="mt-2 block truncate text-xs font-semibold text-gray-800">
              {photo.originalName ?? photo.fileName}
            </span>
            {photo.isPrimary ? (
              <span className="mt-1 inline-flex rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-bold text-yellow-900">
                Hauptfoto
              </span>
            ) : null}
            <span className="block text-[11px] text-gray-500">
              {formatDateTime(photo.createdAt)}
            </span>
          </button>
        ))}
      </div>

      {selectedPhoto ? (
        <InventoryPhotoViewer
          key={selectedPhoto.id}
          onClose={closeViewer}
          onNext={selectNext}
          onPrevious={selectPrevious}
          photo={selectedPhoto}
          showNavigation={photos.length > 1}
        />
      ) : null}
    </>
  );
}

export function InventoryPhotoThumbnailButton({
  itemName,
  photos,
}: {
  itemName: string;
  photos: InventoryPhotoGalleryItem[];
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedPhoto =
    selectedIndex === null ? null : photos[selectedIndex] ?? null;
  const primaryPhoto = photos[0] ?? null;

  function closeViewer() {
    setSelectedIndex(null);
  }

  function selectPrevious() {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length);
  }

  function selectNext() {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((selectedIndex + 1) % photos.length);
  }

  useEffect(() => {
    if (selectedIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) =>
          current === null ? current : (current - 1 + photos.length) % photos.length,
        );
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((current) =>
          current === null ? current : (current + 1) % photos.length,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, photos.length]);

  if (!primaryPhoto) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-xs font-semibold text-gray-400">
        —
      </div>
    );
  }

  return (
    <>
      <button
        className="relative block h-12 w-12 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 hover:ring-2 hover:ring-gray-300"
        onClick={() => setSelectedIndex(0)}
        title={`${itemName} Fotogalerie öffnen`}
        type="button"
      >
        <Image
          alt={`Foto von ${itemName}`}
          className="object-cover"
          fill
          sizes="48px"
          src={primaryPhoto.url}
        />
        {photos.length > 1 ? (
          <span className="absolute bottom-0 right-0 rounded-tl-lg bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {photos.length}
          </span>
        ) : null}
      </button>

      {selectedPhoto ? (
        <InventoryPhotoViewer
          key={selectedPhoto.id}
          onClose={closeViewer}
          onNext={selectNext}
          onPrevious={selectPrevious}
          photo={selectedPhoto}
          showNavigation={photos.length > 1}
        />
      ) : null}
    </>
  );
}

export function InventoryPhotoPreviewPanel({
  itemName,
  photos,
}: {
  itemName: string;
  photos: InventoryPhotoGalleryItem[];
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedPhoto =
    selectedIndex === null ? null : photos[selectedIndex] ?? null;
  const primaryPhoto = photos[0] ?? null;

  function closeViewer() {
    setSelectedIndex(null);
  }

  function selectPrevious() {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length);
  }

  function selectNext() {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((selectedIndex + 1) % photos.length);
  }

  useEffect(() => {
    if (selectedIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) =>
          current === null ? current : (current - 1 + photos.length) % photos.length,
        );
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((current) =>
          current === null ? current : (current + 1) % photos.length,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, photos.length]);

  return (
    <>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-gray-900">Fotos</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
            {photos.length}
          </span>
        </div>

        {!primaryPhoto ? (
          <div className="mt-4 flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-sm font-semibold text-gray-400">
            Kein Foto vorhanden
          </div>
        ) : (
          <>
            <button
              className="relative mt-4 block aspect-[4/3] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 hover:ring-2 hover:ring-gray-300"
              onClick={() => setSelectedIndex(0)}
              title={`${itemName} Fotogalerie öffnen`}
              type="button"
            >
              <Image
                alt={primaryPhoto.originalName ?? itemName}
                className="object-cover"
                fill
                sizes="(min-width: 1280px) 28vw, 100vw"
                src={primaryPhoto.url}
              />
              {primaryPhoto.isPrimary ? (
                <span className="absolute left-3 top-3 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-bold text-yellow-900 shadow">
                  Hauptfoto
                </span>
              ) : null}
            </button>

            {photos.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {photos.slice(1, 9).map((photo, index) => (
                  <button
                    className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100 hover:ring-2 hover:ring-gray-300"
                    key={photo.id}
                    onClick={() => setSelectedIndex(index + 1)}
                    title={photo.originalName ?? photo.fileName}
                    type="button"
                  >
                    <Image
                      alt={photo.originalName ?? itemName}
                      className="object-cover"
                      fill
                      sizes="90px"
                      src={photo.url}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>

      {selectedPhoto ? (
        <InventoryPhotoViewer
          key={selectedPhoto.id}
          onClose={closeViewer}
          onNext={selectNext}
          onPrevious={selectPrevious}
          photo={selectedPhoto}
          showNavigation={photos.length > 1}
        />
      ) : null}
    </>
  );
}

function InventoryPhotoViewer({
  onClose,
  onNext,
  onPrevious,
  photo,
  showNavigation,
}: {
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  photo: InventoryPhotoGalleryItem;
  showNavigation: boolean;
}) {
  const [zoom, setZoom] = useState(minimumZoom);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const photoViewportRef = useRef<HTMLDivElement | null>(null);
  const photoDragRef = useRef({
    pointerId: -1,
    scrollLeft: 0,
    scrollTop: 0,
    x: 0,
    y: 0,
  });

  function changeZoom(nextZoom: number) {
    setZoom(Math.min(maximumZoom, Math.max(minimumZoom, nextZoom)));
  }

  function handlePhotoWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    changeZoom(zoom + (event.deltaY < 0 ? zoomStep : -zoomStep));
  }

  function startPhotoDrag(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = photoViewportRef.current;

    if (
      !viewport ||
      zoom <= minimumZoom ||
      event.button !== 0 ||
      (event.target instanceof Element &&
        Boolean(event.target.closest("button, a, input, textarea, select")))
    ) {
      return;
    }

    photoDragRef.current = {
      pointerId: event.pointerId,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      x: event.clientX,
      y: event.clientY,
    };
    viewport.setPointerCapture(event.pointerId);
    setIsDraggingPhoto(true);
    event.preventDefault();
  }

  function movePhoto(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = photoViewportRef.current;
    const drag = photoDragRef.current;

    if (!viewport || !isDraggingPhoto || drag.pointerId !== event.pointerId) {
      return;
    }

    viewport.scrollLeft = drag.scrollLeft - (event.clientX - drag.x);
    viewport.scrollTop = drag.scrollTop - (event.clientY - drag.y);
    event.preventDefault();
  }

  function stopPhotoDrag(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = photoViewportRef.current;

    if (photoDragRef.current.pointerId !== event.pointerId) {
      return;
    }

    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    photoDragRef.current.pointerId = -1;
    setIsDraggingPhoto(false);
  }

  function downloadPhoto() {
    const link = document.createElement("a");
    link.href = photo.url;
    link.download = photo.originalName ?? photo.fileName;
    document.body.append(link);
    link.click();
    link.remove();
  }

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="grid max-h-[92vh] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-2xl lg:grid-cols-[1.4fr_0.8fr]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`group relative min-h-[320px] overflow-auto bg-black lg:min-h-[640px] ${
            zoom > minimumZoom
              ? isDraggingPhoto
                ? "cursor-grabbing select-none"
                : "cursor-grab"
              : ""
          }`}
          onDoubleClick={(event) => {
            if (
              event.target instanceof Element &&
              event.target.closest("button, a")
            ) {
              return;
            }

            changeZoom(zoom === minimumZoom ? 2 : minimumZoom);
          }}
          onPointerCancel={stopPhotoDrag}
          onPointerDown={startPhotoDrag}
          onPointerMove={movePhoto}
          onPointerUp={stopPhotoDrag}
          onWheel={handlePhotoWheel}
          ref={photoViewportRef}
          style={{ touchAction: zoom > minimumZoom ? "none" : "auto" }}
        >
          <div
            className="absolute left-0 top-0 min-h-full min-w-full"
            style={{
              height: `${zoom * 100}%`,
              width: `${zoom * 100}%`,
            }}
          >
            <Image
              alt={`Inventarfoto groß, Zoom ${Math.round(zoom * 100)} Prozent`}
              className="object-contain"
              draggable={false}
              fill
              sizes="(min-width: 1024px) 65vw, 100vw"
              src={photo.url}
              unoptimized
            />
          </div>

          <div className="sticky left-3 top-3 z-20 flex w-fit items-center overflow-hidden rounded-lg border border-white/30 bg-black/70 text-white shadow-lg backdrop-blur">
            <button
              aria-label="Foto verkleinern"
              className="h-9 w-10 text-lg font-semibold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={zoom <= minimumZoom}
              onClick={() => changeZoom(zoom - zoomStep)}
              title="Verkleinern"
              type="button"
            >
              −
            </button>
            <button
              aria-label="Foto auf Originalansicht zurücksetzen"
              className="h-9 min-w-16 border-x border-white/20 px-2 text-xs font-semibold hover:bg-white/15"
              onClick={() => changeZoom(minimumZoom)}
              title="Zoom zurücksetzen"
              type="button"
            >
              {Math.round(zoom * 100)} %
            </button>
            <button
              aria-label="Foto vergrößern"
              className="h-9 w-10 text-lg font-semibold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={zoom >= maximumZoom}
              onClick={() => changeZoom(zoom + zoomStep)}
              title="Vergrößern"
              type="button"
            >
              +
            </button>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            Mausrad oder Doppelklick zum Zoomen
            {zoom > minimumZoom ? " · Bild anfassen und ziehen" : ""}
          </div>

          {showNavigation ? (
            <>
              <button
                aria-label="Vorheriges Foto"
                className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-gray-900 opacity-0 shadow transition hover:bg-white focus-visible:opacity-100 group-hover:opacity-100"
                onClick={onPrevious}
                title="Vorheriges Foto"
                type="button"
              >
                ‹
              </button>
              <button
                aria-label="Nächstes Foto"
                className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-2xl font-bold text-gray-900 opacity-0 shadow transition hover:bg-white focus-visible:opacity-100 group-hover:opacity-100"
                onClick={onNext}
                title="Nächstes Foto"
                type="button"
              >
                ›
              </button>
            </>
          ) : null}
        </div>

        <aside className="max-h-[92vh] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Inventarfoto
              </div>
              <h3 className="mt-1 text-lg font-bold text-gray-950">
                {photo.originalName ?? photo.fileName}
              </h3>
              {photo.isPrimary ? (
                <span className="mt-2 inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-bold text-yellow-900">
                  Hauptfoto
                </span>
              ) : null}
            </div>
            <button
              className="rounded-full border border-gray-200 px-3 py-1.5 text-lg font-bold text-gray-700 hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              <ActionIcon name="close" className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-500">
            Zoom wie in der Projektakte: Mausrad oder Doppelklick. Im gezoomten
            Bild kannst du es anfassen und verschieben.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              onClick={downloadPhoto}
              type="button"
            >
              Download
            </button>
            <form action={deleteInventoryPhoto}>
              <input name="id" type="hidden" value={photo.id} />
              <button
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                type="submit"
              >
                Löschen
              </button>
            </form>
          </div>

          <div className="mt-6 space-y-2">
            <DetailRow
              label="Hochgeladen"
              value={`${formatDateTime(photo.createdAt)} · ${
                photo.uploadedBy || "Unbekannt"
              }`}
            />
            <DetailRow
              label="Aufnahmeort / Standort"
              value={photo.locationNote || "Nicht hinterlegt"}
            />
            <DetailRow label="Datei" value={photo.originalName ?? photo.fileName} />
            <DetailRow label="Typ" value={photo.mimeType ?? "—"} />
            <DetailRow label="Größe" value={formatFileSize(photo.sizeBytes)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-semibold text-gray-900">
        {value}
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(sizeBytes: number | null) {
  if (sizeBytes === null) return "—";
  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(sizeBytes / 1024 / 1024)} MB`;
}
