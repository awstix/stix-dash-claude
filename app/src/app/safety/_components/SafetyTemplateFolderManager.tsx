import Link from "next/link";

import { ActionIcon } from "@/components/ActionIcon";
import {
  createSafetyTemplateFolder,
  uploadSafetyDocumentTemplate,
} from "../actions";
import { SafetyTemplateDocumentMoveButton } from "./SafetyTemplateDocumentMoveButton";
import { SafetyTemplateFolderActions } from "./SafetyTemplateFolderActions";

type Folder = {
  defaultValidityMonths: number | null;
  id: string;
  name: string;
  parentId: string | null;
  systemKey: string | null;
};

type Template = {
  folderId: string | null;
  id: string;
  sourceDocxPath: string | null;
  sourcePdfPath: string | null;
  title: string;
};

export function SafetyTemplateFolderManager({
  area,
  folders,
  templates,
}: {
  area: "COMMISSION" | "OPERATING_INSTRUCTION" | "RISK_ASSESSMENT";
  folders: Folder[];
  templates: Template[];
}) {
  const label =
    area === "OPERATING_INSTRUCTION"
      ? "Betriebsanweisungen"
      : area === "COMMISSION"
        ? "Beauftragungen"
        : "Gefährdungsbeurteilungen";
  const folderLabels = new Map(
    folders.map((folder) => [folder.id, folderPath(folder, folders)]),
  );

  return (
    <section className="rounded-2xl border border-gray-300 bg-white shadow-sm">
      <details>
        <summary className="cursor-pointer px-5 py-4 font-bold text-gray-950">
          + Ordner, Unterordner oder {label.slice(0, -2)} hinzufügen
        </summary>
        <div className="grid gap-5 border-t border-gray-200 bg-gray-50 p-5 xl:grid-cols-2">
          <form
            action={createSafetyTemplateFolder}
            className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
          >
            <input name="area" type="hidden" value={area} />
            <h3 className="font-bold text-gray-950">
              Ordner oder Unterordner erstellen
            </h3>
            <input
              className={inputClass}
              name="name"
              placeholder="Ordnername"
              required
            />
            <select className={inputClass} name="parentId">
              <option value="">Oberste Ebene</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folderLabels.get(folder.id)}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              min="1"
              name="defaultValidityMonths"
              placeholder="Gültigkeit in Monaten (Standard: 12)"
              type="number"
            />
            <button className={buttonClass} type="submit">
              Ordner erstellen
            </button>
          </form>

          <form
            action={uploadSafetyDocumentTemplate}
            className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"
          >
            <input name="area" type="hidden" value={area} />
            <h3 className="font-bold text-gray-950">
              Neue Vorlage hochladen
            </h3>
            <input
              className={inputClass}
              name="title"
              placeholder="Titel der Vorlage"
              required
            />
            <select className={inputClass} name="folderId" required>
              <option value="">Ordner auswählen</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folderLabels.get(folder.id)}
                </option>
              ))}
            </select>
            {!folders.length ? (
              <p className="text-xs font-semibold text-amber-800">
                Vor dem Upload zuerst einen Ordner anlegen.
              </p>
            ) : null}
            <textarea
              className={`${inputClass} min-h-20`}
              name="description"
              placeholder="Beschreibung (optional)"
            />
            <label className="block text-sm font-bold text-gray-800">
              PDF für Webansicht und Unterweisung
              <input
                accept="application/pdf,.pdf"
                className={`${inputClass} mt-2`}
                name="pdfFile"
                required
                type="file"
              />
            </label>
            <label className="block text-sm font-bold text-gray-800">
              Bearbeitbare Word-Datei (optional)
              <input
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className={`${inputClass} mt-2`}
                name="docxFile"
                type="file"
              />
            </label>
            <button
              className={buttonClass}
              disabled={!folders.length}
              type="submit"
            >
              Vorlage hochladen
            </button>
          </form>
        </div>
      </details>

      {folders.length ? (
        <div className="space-y-3 border-t border-gray-200 bg-gray-100 p-4">
          {folders
            .filter((folder) => !folder.parentId)
            .map((folder) => (
              <FolderNode
                allFolders={folders}
                depth={0}
                folder={folder}
                key={folder.id}
                templates={templates}
              />
            ))}
        </div>
      ) : null}
    </section>
  );
}

function FolderNode({
  allFolders,
  depth,
  folder,
  templates,
}: {
  allFolders: Folder[];
  depth: number;
  folder: Folder;
  templates: Template[];
}) {
  const children = allFolders.filter((entry) => entry.parentId === folder.id);
  const entries = templates.filter((entry) => entry.folderId === folder.id);
  const descendantIds = collectDescendantIds(folder.id, allFolders);
  const totalFolderCount = descendantIds.size;
  const specialDocumentCount =
    folder.systemKey === "safety-a-30-30" ||
    folder.systemKey === "operating-instructions-a-30-19"
      ? 1
      : 0;
  const totalDocumentCount =
    templates.filter(
      (template) =>
        template.folderId === folder.id ||
        (template.folderId ? descendantIds.has(template.folderId) : false),
    ).length + specialDocumentCount;
  const isTopLevel = depth === 0;
  return (
    <details
      className={`overflow-hidden rounded-xl border shadow-sm ${
        isTopLevel
          ? "border-gray-600 bg-gray-700"
          : "ml-4 border-gray-300 bg-white sm:ml-7"
      }`}
    >
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-bold marker:hidden ${
          isTopLevel
            ? "bg-gray-700 text-white hover:bg-gray-600"
            : "bg-white text-gray-950 hover:bg-gray-50"
        }`}
      >
        <span
          aria-label={`${folder.name} öffnen`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
          title="Öffnen"
        >
          <ActionIcon className="h-4 w-4" name="open" />
        </span>
      <SafetyTemplateFolderActions
        currentName={folder.name}
        defaultValidityMonths={folder.defaultValidityMonths}
          folderId={folder.id}
          parentId={folder.parentId}
          targets={allFolders
            .filter(
              (entry) =>
                entry.id !== folder.id &&
                !isDescendant(entry.id, folder.id, allFolders),
            )
            .map((entry) => ({
              id: entry.id,
              label: folderPath(entry, allFolders),
            }))}
        />
        <span className="min-w-0 flex-1">{folder.name}</span>
        <span
          className={`text-xs ${
            isTopLevel ? "text-gray-300" : "text-gray-500"
          }`}
        >
          {totalFolderCount} Unterordner · {totalDocumentCount} Dokumente ·{" "}
          {effectiveValidityMonths(folder, allFolders)} Monate gültig
        </span>
      </summary>
      <div className="space-y-2 border-t border-gray-200 bg-gray-50 p-3">
        {folder.systemKey === "safety-a-30-30" ? (
          <SpecialChecklistEntry />
        ) : null}
        {folder.systemKey === "operating-instructions-a-30-19" ? (
          <SpecialHazardEntry />
        ) : null}
        {children.map((child) => (
          <FolderNode
            allFolders={allFolders}
            depth={depth + 1}
            folder={child}
            key={child.id}
            templates={templates}
          />
        ))}
        {entries.map((template) => (
          <div
            className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center"
            key={template.id}
          >
            <div className="flex shrink-0 items-center gap-1">
              <Link
                aria-label={`${template.title} öffnen oder ausfüllen`}
                className={iconButtonClass}
                href={`/safety/template-library/new?templateId=${template.id}`}
                title="Öffnen / ausfüllen"
              >
                <ActionIcon className="h-4 w-4" name="open" />
              </Link>
              {template.sourcePdfPath ? (
                <a
                  aria-label={`${template.title} als PDF öffnen`}
                  className={iconButtonClass}
                  href={template.sourcePdfPath}
                  target="_blank"
                  title="PDF öffnen"
                >
                  <ActionIcon className="h-4 w-4" name="download" />
                </a>
              ) : null}
              {template.sourceDocxPath ? (
                <a
                  aria-label={`${template.title} als Word-Datei herunterladen`}
                  className={iconButtonClass}
                  href={template.sourceDocxPath}
                  title="Word herunterladen"
                >
                  <ActionIcon className="h-4 w-4" name="edit" />
                </a>
              ) : null}
              <SafetyTemplateDocumentMoveButton
                currentFolderId={folder.id}
                targets={allFolders.map((target) => ({
                  id: target.id,
                  label: folderPath(target, allFolders),
                }))}
                templateId={template.id}
                title={template.title}
              />
            </div>
            <span className="min-w-0 flex-1 font-semibold text-gray-950">
              {template.title}
            </span>
          </div>
        ))}
        {!children.length && !entries.length ? (
          <p className="px-2 py-1 text-sm text-gray-500">Ordner ist leer.</p>
        ) : null}
      </div>
    </details>
  );
}

function SpecialChecklistEntry() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center gap-1">
        <Link
          aria-label="Projektstart-Checklisten öffnen"
          className={iconButtonClass}
          href="/safety/risk-assessments/project-start"
          title="Öffnen"
        >
          <ActionIcon className="h-4 w-4" name="open" />
        </Link>
        <Link
          aria-label="Neue Projektstart-Checkliste ausfüllen"
          className={iconButtonClass}
          href="/safety/risk-assessments/project-start/new"
          title="Ausfüllen"
        >
          <ActionIcon className="h-4 w-4" name="edit" />
        </Link>
      </div>
      <div>
        <p className="font-bold text-gray-950">
          A-30-30-001 · Projektstart Tiefbau / Asphaltbau
        </p>
        <p className="text-xs text-gray-600">
          Projektangaben, LMRA-Prüfpunkte und Mitarbeiterunterschriften
        </p>
      </div>
    </div>
  );
}

function SpecialHazardEntry() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <Link
        aria-label="Gefahrstoffkataster öffnen"
        className={iconButtonClass}
        href="/safety/hazardous-substances"
        title="Gefahrstoffkataster öffnen"
      >
        <ActionIcon className="h-4 w-4" name="open" />
      </Link>
      <span className="font-bold text-gray-950">
        GSK · Gefahrstoffkataster
      </span>
    </div>
  );
}

function folderPath(folder: Folder, folders: Folder[]) {
  const names = [folder.name];
  let parentId = folder.parentId;
  const visited = new Set([folder.id]);
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = folders.find((entry) => entry.id === parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join(" / ");
}

function isDescendant(
  candidateId: string,
  ancestorId: string,
  folders: Folder[],
) {
  let currentId: string | null = candidateId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    if (currentId === ancestorId) return true;
    visited.add(currentId);
    currentId =
      folders.find((folder) => folder.id === currentId)?.parentId ?? null;
  }
  return false;
}

function collectDescendantIds(folderId: string, folders: Folder[]) {
  const descendants = new Set<string>();
  const pending = [folderId];
  while (pending.length) {
    const currentId = pending.pop();
    if (!currentId) continue;
    for (const child of folders) {
      if (
        child.parentId === currentId &&
        child.id !== folderId &&
        !descendants.has(child.id)
      ) {
        descendants.add(child.id);
        pending.push(child.id);
      }
    }
  }
  return descendants;
}

function effectiveValidityMonths(folder: Folder, folders: Folder[]) {
  let current: Folder | undefined = folder;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.defaultValidityMonths) return current.defaultValidityMonths;
    current = current.parentId
      ? folders.find((entry) => entry.id === current?.parentId)
      : undefined;
  }
  return 12;
}

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-950";
const buttonClass =
  "rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-400";
const iconButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50";
