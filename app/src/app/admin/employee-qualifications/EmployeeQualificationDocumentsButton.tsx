"use client";

import { useState } from "react";
import {
  updateEmployeeQualificationDocument,
  uploadEmployeeQualificationDocuments,
} from "./actions";
import {
  DocumentThumbnail,
  EmployeeQualificationDocumentViewer,
  type EmployeeQualificationDocumentItem,
} from "./EmployeeQualificationDocumentViewer";

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
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 p-4"
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
                          <button
                            className="font-semibold text-blue-700 hover:underline"
                            onClick={() => setPreviewDocument(document)}
                            type="button"
                          >
                            Vorschau öffnen
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {previewDocument ? (
            <EmployeeQualificationDocumentViewer
              document={previewDocument}
              documents={documents}
              onClose={() => setPreviewDocument(null)}
            />
          ) : null}
        </div>
      ) : null}
    </>
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
