"use client";

import { useState } from "react";

import { ActionIcon } from "@/components/ActionIcon";
import {
  deleteSafetyTemplateFolder,
  moveSafetyTemplateFolder,
  renameSafetyTemplateFolder,
  updateSafetyTemplateFolderValidity,
} from "../actions";

type FolderOption = {
  id: string;
  label: string;
};

export function SafetyTemplateFolderActions({
  currentName,
  defaultValidityMonths,
  folderId,
  parentId,
  targets,
}: {
  currentName: string;
  defaultValidityMonths: number | null;
  folderId: string;
  parentId: string | null;
  targets: FolderOption[];
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div
        className="flex shrink-0 items-center gap-1"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          aria-label={`${currentName} bearbeiten`}
          className={iconButtonClass}
          onClick={(event) => {
            event.preventDefault();
            setEditing(true);
          }}
          title="Bearbeiten"
          type="button"
        >
          <ActionIcon className="h-4 w-4" name="edit" />
          <span className="sr-only">Bearbeiten</span>
        </button>
        <form
          action={deleteSafetyTemplateFolder}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `Ordner „${currentName}“ wirklich löschen? Das ist nur möglich, wenn er vollständig leer ist.`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input name="folderId" type="hidden" value={folderId} />
          <button
            aria-label={`${currentName} löschen`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
            title="Löschen"
            type="submit"
          >
            <ActionIcon className="h-4 w-4" name="delete" />
          </button>
        </form>
      </div>

      {editing ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/65 p-4"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.target === event.currentTarget) setEditing(false);
          }}
          role="dialog"
        >
          <div className="w-full max-w-xl rounded-2xl border border-gray-300 bg-white p-5 text-left text-gray-950 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold">Ordner bearbeiten</h3>
              <button
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold"
                onClick={() => setEditing(false)}
                type="button"
              >
                Schließen
              </button>
            </div>
            <form
              action={renameSafetyTemplateFolder}
              className="mt-5 space-y-2"
            >
              <input name="folderId" type="hidden" value={folderId} />
              <label className="block text-xs font-bold text-gray-700">
                Ordnername
              </label>
              <input
                className={inputClass}
                defaultValue={currentName}
                name="name"
                required
              />
              <button className={buttonClass} type="submit">
                Namen speichern
              </button>
            </form>
            <form
              action={moveSafetyTemplateFolder}
              className="mt-5 space-y-2 border-t border-gray-200 pt-5"
            >
              <input name="folderId" type="hidden" value={folderId} />
              <label className="block text-xs font-bold text-gray-700">
                Ordner verschieben nach
              </label>
              <select
                className={inputClass}
                defaultValue={parentId ?? ""}
                name="parentId"
              >
                <option value="">Oberste Ebene</option>
                {targets.map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.label}
                  </option>
                ))}
              </select>
              <button className={buttonClass} type="submit">
                Ordner verschieben
              </button>
            </form>
            <form
              action={updateSafetyTemplateFolderValidity}
              className="mt-5 space-y-2 border-t border-gray-200 pt-5"
            >
              <input name="folderId" type="hidden" value={folderId} />
              <label className="block text-xs font-bold text-gray-700">
                Gültigkeit der Nachweise in Monaten
              </label>
              <input
                className={inputClass}
                defaultValue={defaultValidityMonths ?? ""}
                min="1"
                name="defaultValidityMonths"
                placeholder="Leer = vom Überordner, sonst 12 Monate"
                type="number"
              />
              <p className="text-xs text-gray-600">
                Unterordner ohne eigenen Wert übernehmen diese Gültigkeit
                automatisch.
              </p>
              <button className={buttonClass} type="submit">
                Gültigkeit speichern
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950";
const buttonClass =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50";
const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50";
