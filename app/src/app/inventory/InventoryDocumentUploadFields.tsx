"use client";

import { useState } from "react";

export type InventoryDocumentFormValue = {
  fileName: string;
  id: string;
  originalName: string | null;
  sizeBytes: number | null;
  url: string;
};

function formatFileSize(sizeBytes: number | null) {
  if (!sizeBytes) return "";
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InventoryDocumentUploadFields({
  documents = [],
}: {
  documents?: InventoryDocumentFormValue[];
}) {
  const [pendingFileNames, setPendingFileNames] = useState<string[]>([]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-bold text-gray-900">Dokumente</h3>
      <p className="mt-1 text-xs leading-5 text-gray-500">
        Anleitungen, Datenblätter oder andere Dokumente als PDF, Word, Excel
        oder Bild direkt beim Anlegen oder Bearbeiten hochladen.
      </p>

      {documents.length > 0 ? (
        <div className="mt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Vorhandene Dokumente
          </div>
          <div className="mt-2 space-y-2">
            {documents.map((document) => (
              <a
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-800 hover:border-gray-400"
                href={document.url}
                key={document.id}
                rel="noreferrer"
                target="_blank"
              >
                <span className="truncate">
                  {document.originalName ?? document.fileName}
                </span>
                <span className="shrink-0 text-xs font-normal text-gray-500">
                  {formatFileSize(document.sizeBytes)}
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <label className="mt-4 block rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-800">
        Dokumente auswählen
        <input
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/jpeg,image/png"
          className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          multiple
          name="documents"
          onChange={(event) =>
            setPendingFileNames(
              Array.from(event.currentTarget.files ?? []).map(
                (file) => file.name,
              ),
            )
          }
          type="file"
        />
      </label>

      {pendingFileNames.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Neue Dokumente
          </div>
          <ul className="mt-2 space-y-1 text-sm text-gray-700">
            {pendingFileNames.map((name) => (
              <li className="truncate" key={name}>
                {name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
