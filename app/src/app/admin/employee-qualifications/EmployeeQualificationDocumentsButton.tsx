"use client";

import Image from "next/image";
import { useState } from "react";
import {
  deleteEmployeeQualificationDocument,
  updateEmployeeQualificationDocument,
  uploadEmployeeQualificationDocuments,
} from "./actions";

export type EmployeeQualificationDocumentItem = {
  displayName: string;
  documentType: string;
  id: string;
  mimeType: string;
  publicUrl: string;
  uploadedAtLabel: string;
};

const documentTypeOptions = [
  { label: "Führerschein", value: "DRIVER_LICENSE" },
  {
    label: "Erdbaumaschinenschein",
    value: "EARTHMOVING_MACHINE_LICENSE",
  },
  { label: "Kranschein", value: "CRANE_LICENSE" },
  { label: "Staplerschein", value: "FORKLIFT_LICENSE" },
  { label: "Sonstiges / eigene Bezeichnung", value: "OTHER" },
];

export function EmployeeQualificationDocumentsButton({
  documents,
  employeeId,
  employeeName,
}: {
  documents: EmployeeQualificationDocumentItem[];
  employeeId: string;
  employeeName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewDocument, setPreviewDocument] =
    useState<EmployeeQualificationDocumentItem | null>(null);

  return (
    <>
      <button
        className="w-full rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        Dokumente ({documents.length})
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Dokumente · {employeeName}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Nachweise hochladen, öffnen, umbenennen oder neu zuordnen.
                </p>
              </div>
              <button
                aria-label="Dokumentdialog schließen"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setPreviewDocument(null);
                  setIsOpen(false);
                }}
                type="button"
              >
                Schließen
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <form
                action={uploadEmployeeQualificationDocuments}
                className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-2"
              >
                <input name="employeeId" type="hidden" value={employeeId} />
                <DocumentTypeSelect />
                <label className="text-xs font-semibold text-gray-700">
                  Eigene Bezeichnung (nur bei Sonstiges)
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    name="customDocumentType"
                  />
                </label>
                <label className="text-xs font-semibold text-gray-700 md:col-span-2">
                  Dateien
                  <input
                    accept="image/*,application/pdf"
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                    multiple
                    name="documents"
                    required
                    type="file"
                  />
                </label>
                <div className="md:col-span-2">
                  <button
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                    type="submit"
                  >
                    Dokumente hochladen
                  </button>
                </div>
              </form>

              <div className="mt-5 space-y-3">
                {documents.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm font-medium text-gray-500">
                    Für diese Person sind noch keine Dokumente hinterlegt.
                  </p>
                ) : (
                  documents.map((document) => (
                    <div
                      className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 rounded-xl border border-gray-200 p-3"
                      key={document.id}
                    >
                      <button
                        aria-label={`${document.displayName} in Vorschau öffnen`}
                        className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-100 hover:border-blue-300 hover:ring-2 hover:ring-blue-100"
                        onClick={() => setPreviewDocument(document)}
                        type="button"
                      >
                        <DocumentThumbnail document={document} />
                      </button>

                      <div className="min-w-0">
                        <form
                          action={updateEmployeeQualificationDocument}
                          className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]"
                        >
                          <input name="id" type="hidden" value={document.id} />
                          <label className="text-xs font-semibold text-gray-700">
                            Bezeichnung
                            <input
                              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                              defaultValue={document.displayName}
                              name="displayName"
                              required
                            />
                          </label>
                          <DocumentTypeSelect
                            defaultValue={document.documentType}
                          />
                          <div className="flex items-end gap-2">
                            <button
                              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                              type="submit"
                            >
                              Speichern
                            </button>
                            <button
                              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                              onClick={() => setPreviewDocument(document)}
                              type="button"
                            >
                              Öffnen
                            </button>
                          </div>
                        </form>
                        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                          <span>Hochgeladen {document.uploadedAtLabel}</span>
                          <form action={deleteEmployeeQualificationDocument}>
                            <input name="id" type="hidden" value={document.id} />
                            <button
                              className="font-semibold text-red-700 hover:underline"
                              type="submit"
                            >
                              Löschen
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {previewDocument ? (
            <div
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-4"
              onClick={() => setPreviewDocument(null)}
            >
              <div
                className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-4 border-b border-gray-200 p-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {previewDocument.displayName}
                    </h4>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {previewDocument.mimeType}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                      href={previewDocument.publicUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      In neuem Tab
                    </a>
                    <a
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                      download
                      href={previewDocument.publicUrl}
                    >
                      Herunterladen
                    </a>
                    <button
                      className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700"
                      onClick={() => setPreviewDocument(null)}
                      type="button"
                    >
                      Vorschau schließen
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 bg-gray-900 p-3">
                  {previewDocument.mimeType.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={previewDocument.displayName}
                      className="h-full w-full object-contain"
                      src={previewDocument.publicUrl}
                    />
                  ) : previewDocument.mimeType === "application/pdf" ? (
                    <iframe
                      className="h-full w-full rounded-lg bg-white"
                      src={previewDocument.publicUrl}
                      title={previewDocument.displayName}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <a
                        className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-900"
                        download
                        href={previewDocument.publicUrl}
                      >
                        Datei herunterladen
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function DocumentThumbnail({
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

function FileIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8"
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

function DocumentTypeSelect({
  defaultValue = "DRIVER_LICENSE",
}: {
  defaultValue?: string;
}) {
  return (
    <label className="text-xs font-semibold text-gray-700">
      Dokumentart
      <select
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        defaultValue={defaultValue}
        name="documentType"
      >
        {documentTypeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
