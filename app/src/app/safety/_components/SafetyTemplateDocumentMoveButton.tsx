"use client";

import { useState } from "react";

import { ActionIcon } from "@/components/ActionIcon";

import { moveSafetyDocumentTemplate } from "../actions";

export function SafetyTemplateDocumentMoveButton({
  currentFolderId,
  targets,
  templateId,
  title,
}: {
  currentFolderId: string;
  targets: { id: string; label: string }[];
  templateId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label={`${title} verschieben`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        onClick={() => setOpen(true)}
        title="Verschieben"
        type="button"
      >
        <ActionIcon className="h-4 w-4" name="move" />
      </button>
      {open ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[1600] flex items-center justify-center bg-gray-950/65 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          role="dialog"
        >
          <form
            action={moveSafetyDocumentTemplate}
            className="w-full max-w-lg rounded-2xl border border-gray-300 bg-white p-5 text-gray-950 shadow-2xl"
          >
            <input name="templateId" type="hidden" value={templateId} />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Dokument verschieben</h3>
                <p className="mt-1 text-sm text-gray-600">{title}</p>
              </div>
              <button
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300"
                onClick={() => setOpen(false)}
                title="Schließen"
                type="button"
              >
                <ActionIcon className="h-4 w-4" name="close" />
              </button>
            </div>
            <label className="mt-5 block space-y-2">
              <span className="text-sm font-bold">Zielordner</span>
              <select
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-950"
                defaultValue={currentFolderId}
                name="folderId"
              >
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex justify-end">
              <button
                className="rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white"
                type="submit"
              >
                Verschieben
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
