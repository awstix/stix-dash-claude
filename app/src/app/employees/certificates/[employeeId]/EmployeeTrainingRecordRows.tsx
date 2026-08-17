"use client";

/* eslint-disable @next/next/no-img-element */

import { Fragment, useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import {
  deleteEmployeeTrainingRecordDocument,
  deleteEmployeeTrainingRecord,
  uploadEmployeeTrainingRecordDocument,
  updateEmployeeTrainingRecord,
} from "../actions";

export type EmployeeTrainingRecordDocumentRow = {
  displayName: string;
  fileName: string;
  fileSizeBytes: number;
  id: string;
  mimeType: string;
  notes: string | null;
  originalFileName: string;
  publicUrl: string;
  uploadedAt: string;
  uploadedByName: string | null;
};

export type EmployeeTrainingRecordRow = {
  bookedAt: string | null;
  bookingConfirmedAt: string | null;
  certificateReceivedAt: string | null;
  documents: EmployeeTrainingRecordDocumentRow[];
  durationDays: number | null;
  id: string;
  location: string | null;
  notes: string | null;
  number: string | null;
  provider: string | null;
  topic: string;
  trainingDate: string | null;
  type: string | null;
  validityMonths: number | null;
  validUntil: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace(".", ",")} KB`;
  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

function isImageDocument(document: EmployeeTrainingRecordDocumentRow) {
  return document.mimeType.startsWith("image/");
}

function isPdfDocument(document: EmployeeTrainingRecordDocumentRow) {
  return document.mimeType === "application/pdf";
}

function formatInputDate(value: string | null) {
  if (!value) return "";

  return value.slice(0, 10);
}

function getTrainingProgress(trainingDate: string | null, validUntil: string | null) {
  if (!trainingDate || !validUntil) return null;

  const training = new Date(trainingDate);
  const valid = new Date(validUntil);

  if (valid <= training) return null;

  const today = new Date();
  const total = valid.getTime() - training.getTime();
  const elapsed = today.getTime() - training.getTime();
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

function getRefreshText(validUntil: string | null) {
  if (!validUntil) return "—";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const valid = new Date(validUntil);
  valid.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (valid.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0) return `seit ${Math.abs(diffDays)} Tagen abgelaufen`;
  if (diffDays === 0) return "heute";
  return `in ${diffDays} Tagen`;
}

function getTrainingState(validUntil: string | null) {
  if (!validUntil) {
    return {
      className: "bg-gray-100 text-gray-700 ring-gray-200",
      label: "ohne Ablauf",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 60);
  const valid = new Date(validUntil);
  valid.setHours(0, 0, 0, 0);

  if (valid < today) {
    return {
      className: "bg-red-100 text-red-900 ring-red-200",
      label: "abgelaufen",
    };
  }

  if (valid <= soon) {
    return {
      className: "bg-yellow-100 text-yellow-950 ring-yellow-200",
      label: "läuft bald ab",
    };
  }

  return {
    className: "bg-green-100 text-green-900 ring-green-200",
    label: "gültig",
  };
}

export function EmployeeTrainingRecordRows({
  employeeId,
  records,
}: {
  employeeId: string;
  records: EmployeeTrainingRecordRow[];
}) {
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<EmployeeTrainingRecordDocumentRow | null>(null);
  const editingRecord =
    records.find((record) => record.id === editingRecordId) ?? null;

  if (records.length === 0) {
    return (
      <tr>
        <td className="p-8 text-center text-gray-500" colSpan={7}>
          Noch keine Schulungen hinterlegt.
        </td>
      </tr>
    );
  }

  return (
    <>
      {records.map((record) => {
        const state = getTrainingState(record.validUntil);
        const progress = getTrainingProgress(
          record.trainingDate,
          record.validUntil,
        );

        return (
          <Fragment key={record.id}>
            <tr className="border-t border-gray-100">
              <td className="p-3">
                <div className="flex gap-2">
                  <button
                    aria-label={`${record.topic} bearbeiten`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    onClick={() => {
                      setEditingRecordId(record.id);
                    }}
                    title="Bearbeiten"
                    type="button"
                  >
                    <ActionIcon name="edit" className="h-4 w-4" />
                  </button>
                  <form action={deleteEmployeeTrainingRecord}>
                    <input name="id" type="hidden" value={record.id} />
                    <input name="employeeId" type="hidden" value={employeeId} />
                    <button
                      aria-label={`${record.topic} löschen`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                      title="Löschen"
                      type="submit"
                    >
                      <ActionIcon name="delete" className="h-4 w-4" />
                    </button>
                  </form>
                </div>
              </td>
              <td className="p-3">
                {record.documents.length ? (
                  <button
                    className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900 hover:bg-blue-100"
                    onClick={() => setSelectedDocument(record.documents[0])}
                    type="button"
                  >
                    <span>{record.documents.length}</span>
                    <span>Zertifikat{record.documents.length === 1 ? "" : "e"}</span>
                  </button>
                ) : (
                  <span className="text-xs text-gray-500">—</span>
                )}
              </td>
              <td className="min-w-0 p-3">
                <div className="truncate font-semibold text-gray-900">
                  {record.topic}
                </div>
                <div className="mt-1 truncate text-xs text-gray-500">
                  {[record.number, record.provider, record.type, record.location]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                {record.notes ? (
                  <div className="mt-1 truncate text-xs font-normal text-gray-500">
                    {record.notes}
                  </div>
                ) : null}
              </td>
              <td className="p-3 text-gray-700">
                {formatDate(record.trainingDate)}
              </td>
              <td className="p-3 text-gray-700">
                {formatDate(record.validUntil)}
              </td>
              <td className="p-3 text-gray-700">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${state.className}`}
                >
                  {progress === null ? state.label : `${progress} %`}
                </span>
              </td>
              <td className="truncate p-3 text-gray-700">
                {getRefreshText(record.validUntil)}
              </td>
            </tr>
          </Fragment>
        );
      })}
      {editingRecord ? (
        <TrainingRecordEditModal
          employeeId={employeeId}
          onClose={() => setEditingRecordId(null)}
          onSelectDocument={setSelectedDocument}
          record={editingRecord}
        />
      ) : null}
      {selectedDocument ? (
        <TrainingDocumentViewer
          document={selectedDocument}
          employeeId={employeeId}
          onClose={() => setSelectedDocument(null)}
        />
      ) : null}
    </>
  );
}

function DocumentPreviewIcon({
  document,
}: {
  document: EmployeeTrainingRecordDocumentRow;
}) {
  if (isImageDocument(document)) {
    return (
      <img
        alt=""
        className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover"
        src={document.publicUrl}
      />
    );
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-xs font-black text-red-700">
      PDF
    </span>
  );
}

function TrainingRecordEditModal({
  employeeId,
  onClose,
  onSelectDocument,
  record,
}: {
  employeeId: string;
  onClose: () => void;
  onSelectDocument: (document: EmployeeTrainingRecordDocumentRow) => void;
  record: EmployeeTrainingRecordRow;
}) {
  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Schulung bearbeiten
            </div>
            <h2 className="mt-1 truncate text-2xl font-bold text-gray-900">
              {record.topic}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Daten ändern, Zertifikate hochladen und Nachweise ansehen.
            </p>
          </div>
          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            onClick={onClose}
            type="button"
          >
            <ActionIcon name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-92px)] overflow-y-auto p-5">
          <form
            action={updateEmployeeTrainingRecord}
            className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
          >
            <input name="id" type="hidden" value={record.id} />
            <input name="employeeId" type="hidden" value={employeeId} />
            <TextInput defaultValue={record.number ?? ""} label="Nr." name="number" />
            <TextInput
              defaultValue={record.provider ?? ""}
              label="Anbieter"
              name="provider"
            />
            <TextInput
              defaultValue={record.topic}
              label="Thema Kurs"
              name="topic"
            />
            <DateInput
              defaultValue={formatInputDate(record.trainingDate)}
              label="Datum der Schulung"
              name="trainingDate"
            />
            <TextInput defaultValue={record.type ?? ""} label="Typ" name="type" />
            <TextInput defaultValue={record.location ?? ""} label="Ort" name="location" />
            <TextInput
              defaultValue={
                record.durationDays === null
                  ? ""
                  : String(record.durationDays).replace(".", ",")
              }
              label="Dauer [Tage]"
              name="durationDays"
            />
            <DateInput
              defaultValue={formatInputDate(record.bookedAt)}
              label="Buchung am"
              name="bookedAt"
            />
            <DateInput
              defaultValue={formatInputDate(record.bookingConfirmedAt)}
              label="Buchungsbestätigung"
              name="bookingConfirmedAt"
            />
            <DateInput
              defaultValue={formatInputDate(record.certificateReceivedAt)}
              label="Zertifikat erhalten"
              name="certificateReceivedAt"
            />
            <TextInput
              defaultValue={
                record.validityMonths
                  ? String(record.validityMonths / 12).replace(".", ",")
                  : ""
              }
              label="Gültigkeit [Jahre]"
              name="validityYears"
            />
            <DateInput
              defaultValue={formatInputDate(record.validUntil)}
              label="gültig bis"
              name="validUntil"
            />
            <label className="text-sm font-semibold text-gray-800 xl:col-span-4">
              Bemerkung
              <input
                className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                defaultValue={record.notes ?? ""}
                name="notes"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row xl:col-span-4">
              <button
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                type="submit"
              >
                Änderung speichern
              </button>
              <button
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                onClick={onClose}
                type="button"
              >
                Schließen
              </button>
            </div>
          </form>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-200 pt-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <div>
              <div className="mb-3">
                <h3 className="text-sm font-bold text-gray-900">
                  Zertifikate / Nachweise
                </h3>
                <p className="text-xs text-gray-500">
                  PDF, JPG, PNG oder WebP zur konkreten Schulung.
                </p>
              </div>
              {record.documents.length ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {record.documents.map((document) => (
                    <button
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left hover:bg-gray-50"
                      key={document.id}
                      onClick={() => onSelectDocument(document)}
                      type="button"
                    >
                      <DocumentPreviewIcon document={document} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-gray-900">
                          {document.displayName}
                        </span>
                        <span className="mt-1 block truncate text-xs text-gray-500">
                          {formatFileSize(document.fileSizeBytes)} ·{" "}
                          {formatDateTime(document.uploadedAt)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500">
                  Noch kein Zertifikat hochgeladen.
                </div>
              )}
            </div>

            <form
              action={uploadEmployeeTrainingRecordDocument}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
            >
              <input name="employeeId" type="hidden" value={employeeId} />
              <input name="trainingRecordId" type="hidden" value={record.id} />
              <label className="text-sm font-semibold text-gray-800">
                Zertifikat hochladen
                <input
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="mt-2 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-800 hover:file:bg-gray-100"
                  multiple
                  name="files"
                  type="file"
                />
              </label>
              <label className="mt-3 block text-sm font-semibold text-gray-800">
                Hochgeladen von
                <input
                  className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  defaultValue="Admin"
                  name="uploadedByName"
                  placeholder="später automatisch Benutzer"
                />
              </label>
              <label className="mt-3 block text-sm font-semibold text-gray-800">
                Notiz
                <input
                  className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  name="notes"
                  placeholder="z.B. Original, Nachtrag, Scan..."
                />
              </label>
              <button
                className="mt-4 w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                type="submit"
              >
                Zertifikat speichern
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainingDocumentViewer({
  document,
  employeeId,
  onClose,
}: {
  document: EmployeeTrainingRecordDocumentRow;
  employeeId: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[var(--z-modal-nested)] flex items-center justify-center bg-gray-950/80 p-3"
      onClick={onClose}
    >
      <div
        className="relative grid h-[96vh] w-full max-w-[96vw] grid-cols-1 overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[minmax(0,1fr)_380px]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="Zertifikat schließen"
          className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-700 shadow-lg hover:bg-gray-50"
          onClick={onClose}
          type="button"
        >
          <ActionIcon name="close" className="h-4 w-4" />
        </button>
        <div className="flex min-h-0 items-center justify-center bg-gray-100 p-4">
          {isImageDocument(document) ? (
            <img
              alt={document.displayName}
              className="max-h-full max-w-full rounded-xl object-contain shadow"
              src={document.publicUrl}
            />
          ) : isPdfDocument(document) ? (
            <iframe
              className="h-full w-full rounded-xl bg-white"
              src={document.publicUrl}
              title={document.displayName}
            />
          ) : (
            <div className="rounded-2xl bg-white p-8 text-center">
              <div className="text-lg font-bold text-gray-900">
                Keine Vorschau verfügbar
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Die Datei kann heruntergeladen werden.
              </p>
            </div>
          )}
        </div>
        <aside className="overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Zertifikat
              </div>
              <h3 className="mt-1 break-words text-lg font-bold text-gray-900">
                {document.displayName}
              </h3>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <DetailRow label="Datei" value={document.originalFileName} />
            <DetailRow label="Typ" value={document.mimeType} />
            <DetailRow label="Größe" value={formatFileSize(document.fileSizeBytes)} />
            <DetailRow
              label="Hochgeladen"
              value={`${formatDateTime(document.uploadedAt)} · ${
                document.uploadedByName || "Unbekannt"
              }`}
            />
            <DetailRow label="Notiz" value={document.notes || "—"} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-2">
            <a
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              download={document.originalFileName}
              href={document.publicUrl}
            >
              <ActionIcon name="download" className="h-4 w-4" />
              Herunterladen
            </a>
            <form action={deleteEmployeeTrainingRecordDocument}>
              <input name="documentId" type="hidden" value={document.id} />
              <input name="employeeId" type="hidden" value={employeeId} />
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                type="submit"
              >
                <ActionIcon name="delete" className="h-4 w-4" />
                Löschen
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 break-words font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function TextInput({
  defaultValue,
  label,
  name,
}: {
  defaultValue: string;
  label: string;
  name: string;
}) {
  return (
    <label className="text-sm font-semibold text-gray-800">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        defaultValue={defaultValue}
        name={name}
      />
    </label>
  );
}

function DateInput({
  defaultValue,
  label,
  name,
}: {
  defaultValue: string;
  label: string;
  name: string;
}) {
  return (
    <label className="text-sm font-semibold text-gray-800">
      {label}
      <input
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        defaultValue={defaultValue}
        name={name}
        type="date"
      />
    </label>
  );
}
