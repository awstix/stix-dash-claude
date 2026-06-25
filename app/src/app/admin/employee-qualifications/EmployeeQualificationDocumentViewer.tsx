"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { deleteEmployeeQualificationDocument } from "./actions";

export type EmployeeQualificationDocumentItem = {
  displayName: string;
  documentType: string;
  documentTypeLabel?: string;
  employeeName?: string;
  fileSizeLabel?: string;
  id: string;
  mimeType: string;
  originalFileName?: string;
  publicUrl: string;
  uploadedAtLabel: string;
  uploadedByName?: string;
};

const minimumDocumentZoom = 1;
const maximumDocumentZoom = 5;
const documentZoomStep = 0.5;

export function EmployeeQualificationDocumentViewerButton({
  children,
  className,
  document,
  documents,
}: {
  children: ReactNode;
  className: string;
  document: EmployeeQualificationDocumentItem;
  documents?: EmployeeQualificationDocumentItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className={className}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {children}
      </button>
      {isOpen ? (
        <EmployeeQualificationDocumentViewer
          document={document}
          documents={documents}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

export function EmployeeQualificationDocumentViewer({
  document,
  documents,
  onClose,
}: {
  document: EmployeeQualificationDocumentItem;
  documents?: EmployeeQualificationDocumentItem[];
  onClose: () => void;
}) {
  const viewerDocuments = useMemo(() => {
    const items = documents?.length ? documents : [document];
    const uniqueItems = new Map<string, EmployeeQualificationDocumentItem>();

    for (const item of items) {
      uniqueItems.set(item.id, item);
    }

    if (!uniqueItems.has(document.id)) {
      uniqueItems.set(document.id, document);
    }

    return Array.from(uniqueItems.values());
  }, [document, documents]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(document.id);
  const selectedIndex = Math.max(
    0,
    viewerDocuments.findIndex((item) => item.id === selectedDocumentId),
  );
  const selectedDocument = viewerDocuments[selectedIndex] ?? document;
  const hasMultipleDocuments = viewerDocuments.length > 1;
  const isImage = selectedDocument.mimeType.startsWith("image/");
  const isPdf = selectedDocument.mimeType === "application/pdf";
  const [zoom, setZoom] = useState(minimumDocumentZoom);
  const [isDraggingDocument, setIsDraggingDocument] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    pointerId: -1,
    scrollLeft: 0,
    scrollTop: 0,
    x: 0,
    y: 0,
  });

  function resetDocumentView() {
    setZoom(minimumDocumentZoom);
    setIsDraggingDocument(false);
    dragRef.current.pointerId = -1;
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
      viewportRef.current.scrollTop = 0;
    }
  }

  function selectDocumentByIndex(nextIndex: number) {
    const nextDocument = viewerDocuments[nextIndex];
    if (!nextDocument) return;
    resetDocumentView();
    setSelectedDocumentId(nextDocument.id);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (!hasMultipleDocuments) return;
        selectDocumentByIndex(
          selectedIndex <= 0 ? viewerDocuments.length - 1 : selectedIndex - 1,
        );
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (!hasMultipleDocuments) return;
        selectDocumentByIndex(
          selectedIndex >= viewerDocuments.length - 1 ? 0 : selectedIndex + 1,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function showPreviousDocument() {
    if (!hasMultipleDocuments) return;
    const previousIndex =
      selectedIndex <= 0 ? viewerDocuments.length - 1 : selectedIndex - 1;
    selectDocumentByIndex(previousIndex);
  }

  function showNextDocument() {
    if (!hasMultipleDocuments) return;
    const nextIndex =
      selectedIndex >= viewerDocuments.length - 1 ? 0 : selectedIndex + 1;
    selectDocumentByIndex(nextIndex);
  }

  function changeZoom(nextZoom: number) {
    setZoom(
      Math.min(
        maximumDocumentZoom,
        Math.max(minimumDocumentZoom, nextZoom),
      ),
    );
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!isImage) return;
    event.preventDefault();
    changeZoom(zoom + (event.deltaY < 0 ? documentZoomStep : -documentZoomStep));
  }

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;

    if (
      !isImage ||
      !viewport ||
      zoom <= minimumDocumentZoom ||
      event.button !== 0 ||
      (event.target instanceof Element &&
        Boolean(event.target.closest("button, a, input, textarea, select")))
    ) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      x: event.clientX,
      y: event.clientY,
    };
    viewport.setPointerCapture(event.pointerId);
    setIsDraggingDocument(true);
    event.preventDefault();
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    const drag = dragRef.current;

    if (
      !viewport ||
      !isDraggingDocument ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    viewport.scrollLeft = drag.scrollLeft - (event.clientX - drag.x);
    viewport.scrollTop = drag.scrollTop - (event.clientY - drag.y);
    event.preventDefault();
  }

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;

    if (dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    dragRef.current.pointerId = -1;
    setIsDraggingDocument(false);
  }

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="grid max-h-[92vh] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-2xl lg:grid-cols-[1.35fr_0.75fr]"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`group relative min-h-[320px] overflow-auto bg-gray-950 lg:min-h-[640px] ${
            isImage && zoom > minimumDocumentZoom
              ? isDraggingDocument
                ? "cursor-grabbing select-none"
                : "cursor-grab"
              : ""
          }`}
          onDoubleClick={(event) => {
            if (
              !isImage ||
              (event.target instanceof Element &&
                event.target.closest("button, a"))
            ) {
              return;
            }

            changeZoom(zoom === minimumDocumentZoom ? 2 : minimumDocumentZoom);
          }}
          onPointerCancel={stopDrag}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onWheel={handleWheel}
          ref={viewportRef}
          style={{
            touchAction:
              isImage && zoom > minimumDocumentZoom ? "none" : "auto",
          }}
        >
          {isImage ? (
            <div
              className="absolute left-0 top-0 min-h-full min-w-full"
              style={{
                height: `${zoom * 100}%`,
                width: `${zoom * 100}%`,
              }}
            >
              <Image
                alt={selectedDocument.displayName}
                className="object-contain"
                draggable={false}
                fill
                sizes="(min-width: 1024px) 65vw, 100vw"
                src={selectedDocument.publicUrl}
                unoptimized
              />
            </div>
          ) : isPdf ? (
            <iframe
              className="h-full min-h-[640px] w-full bg-white"
              src={selectedDocument.publicUrl}
              title={selectedDocument.displayName}
            />
          ) : (
            <div className="flex h-full min-h-[640px] items-center justify-center p-6 text-center">
              <div className="rounded-2xl bg-white p-6 shadow">
                <FileIcon className="mx-auto h-12 w-12 text-gray-500" />
                <p className="mt-3 text-sm font-semibold text-gray-900">
                  Für diesen Dateityp gibt es keine Vorschau.
                </p>
                <a
                  className="mt-4 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  download={selectedDocument.originalFileName || undefined}
                  href={selectedDocument.publicUrl}
                >
                  Datei herunterladen
                </a>
              </div>
            </div>
          )}

          {isImage ? (
            <>
              <div className="sticky left-3 top-3 z-20 flex w-fit items-center overflow-hidden rounded-lg border border-white/30 bg-black/70 text-white shadow-lg backdrop-blur">
                <button
                  aria-label="Dokument verkleinern"
                  className="h-9 w-10 text-lg font-semibold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={zoom <= minimumDocumentZoom}
                  onClick={() => changeZoom(zoom - documentZoomStep)}
                  title="Verkleinern"
                  type="button"
                >
                  −
                </button>
                <button
                  aria-label="Dokument-Zoom zurücksetzen"
                  className="h-9 min-w-16 border-x border-white/20 px-2 text-xs font-semibold hover:bg-white/15"
                  onClick={() => changeZoom(minimumDocumentZoom)}
                  title="Zoom zurücksetzen"
                  type="button"
                >
                  {Math.round(zoom * 100)} %
                </button>
                <button
                  aria-label="Dokument vergrößern"
                  className="h-9 w-10 text-lg font-semibold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={zoom >= maximumDocumentZoom}
                  onClick={() => changeZoom(zoom + documentZoomStep)}
                  title="Vergrößern"
                  type="button"
                >
                  +
                </button>
              </div>

              <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                Mausrad oder Doppelklick zum Zoomen
                {zoom > minimumDocumentZoom
                  ? " · Dokument anfassen und ziehen"
                  : ""}
              </div>
            </>
          ) : null}

          {hasMultipleDocuments ? (
            <>
              <button
                aria-label="Vorheriges Dokument"
                className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 opacity-0 shadow transition hover:bg-white focus-visible:opacity-100 group-hover:opacity-100"
                onClick={showPreviousDocument}
                title="Vorheriges Dokument"
                type="button"
              >
                <ChevronLeftIcon />
              </button>
              <button
                aria-label="Nächstes Dokument"
                className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 opacity-0 shadow transition hover:bg-white focus-visible:opacity-100 group-hover:opacity-100"
                onClick={showNextDocument}
                title="Nächstes Dokument"
                type="button"
              >
                <ChevronRightIcon />
              </button>
            </>
          ) : null}
        </div>

        <aside className="max-h-[92vh] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Nachweisdokument
              </p>
              <h3 className="mt-1 break-words text-lg font-semibold text-gray-900">
                {selectedDocument.displayName}
              </h3>
              <p className="mt-1 text-xs font-medium text-gray-500">
                {selectedDocument.documentTypeLabel ||
                  selectedDocument.documentType}
              </p>
              {hasMultipleDocuments ? (
                <p className="mt-1 text-xs font-semibold text-gray-500">
                  Dokument {selectedIndex + 1} von {viewerDocuments.length}
                </p>
              ) : null}
            </div>
            <button
              aria-label="Dokument schließen"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              onClick={onClose}
              title="Schließen"
              type="button"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {hasMultipleDocuments ? (
              <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white">
                <button
                  className="border-r border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={showPreviousDocument}
                  type="button"
                >
                  ← Zurück
                </button>
                <button
                  className="px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={showNextDocument}
                  type="button"
                >
                  Weiter →
                </button>
              </div>
            ) : null}
            <a
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              download={selectedDocument.originalFileName || undefined}
              href={selectedDocument.publicUrl}
            >
              <DownloadIcon />
              Herunterladen
            </a>
            <form action={deleteEmployeeQualificationDocument}>
              <input name="id" type="hidden" value={selectedDocument.id} />
              <button
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                type="submit"
              >
                <TrashIcon />
                Löschen
              </button>
            </form>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 text-sm">
            <DetailRow
              label="Mitarbeiter"
              value={selectedDocument.employeeName || "-"}
            />
            <DetailRow
              label="Hochgeladen"
              value={selectedDocument.uploadedAtLabel}
            />
            <DetailRow
              label="Hochgeladen von"
              value={selectedDocument.uploadedByName || "Nicht erfasst"}
            />
            <DetailRow
              label="Originaldatei"
              value={selectedDocument.originalFileName || "-"}
            />
            <DetailRow
              label="Dateigröße"
              value={selectedDocument.fileSizeLabel || "-"}
            />
            <DetailRow label="Dateityp" value={selectedDocument.mimeType || "-"} />
          </div>
        </aside>
      </div>
    </div>
  );
}

export function DocumentThumbnail({
  document,
}: {
  document: EmployeeQualificationDocumentItem;
}) {
  if (document.mimeType.startsWith("image/")) {
    return (
      <Image
        alt=""
        className="h-full w-full object-cover"
        height={80}
        src={document.publicUrl}
        unoptimized
        width={80}
      />
    );
  }

  if (document.mimeType === "application/pdf") {
    return (
      <span className="flex flex-col items-center text-red-700">
        <FileIcon />
        <span className="mt-1 text-[10px] font-bold">PDF</span>
      </span>
    );
  }

  return (
    <span className="flex flex-col items-center text-gray-600">
      <FileIcon />
      <span className="mt-1 text-[10px] font-bold">DATEI</span>
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 break-words font-medium text-gray-900">{value}</div>
    </div>
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

function ChevronLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      viewBox="0 0 24 24"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
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
      <path d="m10 11 .5 6" />
      <path d="m14 11-.5 6" />
      <path d="M6 6l1 15h10l1-15" />
    </svg>
  );
}

function FileIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M6 2h8l4 4v16H6Z" />
      <path d="M14 2v5h5" />
    </svg>
  );
}
