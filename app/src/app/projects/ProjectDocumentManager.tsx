"use client";

import { Fragment, FormEvent, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import {
  createProjectDocumentFolder,
  deleteProjectDocumentFolder,
  deleteProjectDocument,
  deleteProjectDocuments,
  moveProjectDocuments,
  updateProjectDocumentFolder,
  updateProjectDocument,
  uploadProjectDocuments,
} from "./actions";
import { ProjectFileDropInput } from "./ProjectFileDropInput";

export type ProjectDocumentProjectOption = {
  id: string;
  label: string;
};

export type ProjectDocumentFolderOption = {
  id: string;
  name: string;
  projectId: string;
  sortOrder: number;
};

export type ProjectDocumentListItem = {
  displayName: string;
  fileSizeBytes: number;
  folderId: string | null;
  folderName: string | null;
  id: string;
  mimeType: string;
  originalFileName: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  publicUrl: string;
  uploadedAt: string;
  uploadedByName: string | null;
  uploadedByUserId: string | null;
};

export function ProjectDocumentManager({
  documents,
  embedded = false,
  folders,
  initialProjectId,
  lockedProjectId,
  projects,
}: {
  documents: ProjectDocumentListItem[];
  embedded?: boolean;
  folders: ProjectDocumentFolderOption[];
  initialProjectId?: string;
  lockedProjectId?: string;
  projects: ProjectDocumentProjectOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const defaultProjectId = getInitialProjectId(
    projects,
    lockedProjectId ?? initialProjectId,
  );
  const [uploadProjectId, setUploadProjectId] = useState(defaultProjectId);
  const [folderProjectId, setFolderProjectId] = useState(defaultProjectId);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState("");
  const [moveTargetProjectId, setMoveTargetProjectId] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [documentFilter, setDocumentFilter] = useState("");
  const [projectFilterId, setProjectFilterId] = useState(
    lockedProjectId ? "" : getOptionalProjectId(projects, initialProjectId),
  );
  const [expandedDocumentProjectIds, setExpandedDocumentProjectIds] = useState<
    Set<string>
  >(() => new Set());
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const effectiveUploadProjectId = lockedProjectId ?? uploadProjectId;
  const effectiveFolderProjectId = lockedProjectId ?? folderProjectId;
  const uploadFolders = getFoldersForProject(folders, effectiveUploadProjectId);
  const createFolderProject = projects.find(
    (project) => project.id === effectiveFolderProjectId,
  );
  const effectiveListProjectId = lockedProjectId ?? projectFilterId;
  const filteredDocuments = documents.filter((fileDocument) => {
    const projectMatches =
      !effectiveListProjectId || fileDocument.projectId === effectiveListProjectId;
    const nameMatches = fileDocument.displayName
      .toLowerCase()
      .includes(nameFilter.trim().toLowerCase());
    const documentMatches = fileDocument.originalFileName
      .toLowerCase()
      .includes(documentFilter.trim().toLowerCase());

    return projectMatches && nameMatches && documentMatches;
  });
  const visibleDocumentIds = new Set(
    filteredDocuments.map((fileDocument) => fileDocument.id),
  );
  const selectedDocumentIdList = Array.from(selectedDocumentIds).filter(
    (documentId) => visibleDocumentIds.has(documentId),
  );
  const selectedCount = selectedDocumentIdList.length;
  const allDocumentsSelected =
    filteredDocuments.length > 0 && selectedCount === filteredDocuments.length;
  const selectedDocument =
    selectedIndex === null ? null : (filteredDocuments[selectedIndex] ?? null);
  const moveTargetFolders = getFoldersForProject(folders, moveTargetProjectId);
  const totalMb = documents.reduce(
    (sum, fileDocument) => sum + fileDocument.fileSizeBytes,
    0,
  );
  const hasTextDocumentFilters = Boolean(
    nameFilter.trim() || documentFilter.trim(),
  );
  const documentGroups = getDocumentGroups({
    documents: filteredDocuments,
    folders,
    includeEmptyFolders: !hasTextDocumentFilters,
    listProjectId: effectiveListProjectId,
    projects,
  });
  const documentProjectGroups = getDocumentProjectGroups(documentGroups);
  const documentIndexById = new Map(
    filteredDocuments.map((fileDocument, index) => [fileDocument.id, index]),
  );

  function changeUploadProject(projectId: string) {
    setUploadProjectId(projectId);
    setFolderProjectId(projectId);
  }

  function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = String(formData.get("name") ?? "");
    const projectId = lockedProjectId ?? String(formData.get("projectId") ?? "");

    startTransition(async () => {
      try {
        await createProjectDocumentFolder({
          name,
          projectId,
        });
        form.reset();
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Ordner konnte nicht erstellt werden.",
        );
      }
    });
  }

  function uploadDocuments(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (lockedProjectId) {
      formData.set("projectId", lockedProjectId);
    }

    startTransition(async () => {
      try {
        await uploadProjectDocuments(formData);
        form.reset();
        changeUploadProject(defaultProjectId);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Dokumente konnten nicht hochgeladen werden.",
        );
      }
    });
  }

  function deleteFolder(group: DocumentTableGroup) {
    if (!group.folderId) return;

    const confirmed = window.confirm(
      `Ordner "${group.folderName}" wirklich löschen? Die Dokumente bleiben erhalten und werden danach ohne Ordner angezeigt.`,
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteProjectDocumentFolder({
          id: group.folderId ?? "",
        });
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Ordner konnte nicht gelöscht werden.",
        );
      }
    });
  }

  function updateFolderName(event: FormEvent<HTMLFormElement>, group: DocumentTableGroup) {
    event.preventDefault();
    if (!group.folderId) return;

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await updateProjectDocumentFolder({
          id: group.folderId ?? "",
          name: String(formData.get("folderName") ?? ""),
        });
        setEditingFolderId(null);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Ordner konnte nicht umbenannt werden.",
        );
      }
    });
  }

  function updateDocumentName(
    event: FormEvent<HTMLFormElement>,
    documentId: string,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      try {
        await updateProjectDocument({
          displayName: String(formData.get("displayName") ?? ""),
          id: documentId,
        });
        setEditingDocumentId(null);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Dokumentname konnte nicht gespeichert werden.",
        );
      }
    });
  }

  function deleteSingleDocument(fileDocument: ProjectDocumentListItem) {
    const confirmed = window.confirm(
      `"${fileDocument.displayName}" wirklich löschen? Die Datei wird aus der Projektakte entfernt.`,
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteProjectDocument(fileDocument.id);
        setSelectedIndex(null);
        setSelectedDocumentIds((current) => {
          const next = new Set(current);
          next.delete(fileDocument.id);
          return next;
        });
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Dokument konnte nicht gelöscht werden.",
        );
      }
    });
  }

  function deleteSelectedDocuments() {
    if (selectedCount === 0) return;

    const confirmed = window.confirm(
      `${selectedCount} Dokument${selectedCount === 1 ? "" : "e"} wirklich löschen? Die Dateien werden aus der Projektakte entfernt.`,
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteProjectDocuments(selectedDocumentIdList);
        setSelectedDocumentIds(new Set());
        setSelectedIndex(null);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Dokumente konnten nicht gelöscht werden.",
        );
      }
    });
  }

  function moveSelectedDocuments() {
    if (selectedCount === 0) return;

    if (!moveTargetProjectId) {
      alert("Bitte eine Zielbaustelle auswählen.");
      return;
    }

    const targetProject = projects.find(
      (project) => project.id === moveTargetProjectId,
    );
    const targetFolder = moveTargetFolders.find(
      (folder) => folder.id === moveTargetFolderId,
    );
    const targetLabel = [
      targetProject?.label ?? "Zielbaustelle",
      targetFolder?.name ?? "ohne Ordner",
    ].join(" · ");
    const confirmed = window.confirm(
      `${selectedCount} Dokument${selectedCount === 1 ? "" : "e"} nach "${targetLabel}" verschieben?`,
    );

    if (!confirmed) return;

    startTransition(async () => {
      try {
        await moveProjectDocuments({
          documentIds: selectedDocumentIdList,
          targetFolderId: moveTargetFolderId || undefined,
          targetProjectId: moveTargetProjectId,
        });
        setMoveTargetFolderId("");
        setMoveTargetProjectId("");
        setSelectedDocumentIds(new Set());
        setSelectedIndex(null);
        router.refresh();
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Dokumente konnten nicht verschoben werden.",
        );
      }
    });
  }

  function downloadSelectedDocuments() {
    for (const fileDocument of filteredDocuments) {
      if (selectedDocumentIds.has(fileDocument.id)) {
        downloadDocument(fileDocument);
      }
    }
  }

  function toggleDocumentSelection(documentId: string, checked: boolean) {
    setSelectedDocumentIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(documentId);
      } else {
        next.delete(documentId);
      }

      return next;
    });
  }

  function selectAllDocuments(checked: boolean) {
    setSelectedDocumentIds(
      checked
        ? new Set(filteredDocuments.map((fileDocument) => fileDocument.id))
        : new Set(),
    );
  }

  function toggleDocumentProject(projectId: string) {
    setExpandedDocumentProjectIds((current) => {
      const next = new Set(current);

      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }

      return next;
    });
  }

  function renderDocumentGroup(group: DocumentTableGroup) {
    return (
      <Fragment key={group.key}>
        <tr className="border-t border-gray-200 bg-gray-50">
          <td
            className="px-3 py-2"
            colSpan={lockedProjectId ? 7 : 8}
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {editingFolderId === group.folderId ? (
                  <form
                    className="flex max-w-xl gap-2"
                    onSubmit={(event) => updateFolderName(event, group)}
                  >
                    <input
                      autoFocus
                      className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-gray-900"
                      defaultValue={group.folderName}
                      name="folderName"
                      required
                      type="text"
                    />
                    <button
                      aria-label="Ordnername speichern"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                      disabled={isPending}
                      title="Speichern"
                      type="submit"
                    >
                      <ActionIcon name="save" className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="Ordnerbearbeitung abbrechen"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                      disabled={isPending}
                      onClick={() => setEditingFolderId(null)}
                      title="Abbrechen"
                      type="button"
                    >
                      <ActionIcon name="close" className="h-4 w-4" />
                    </button>
                  </form>
                ) : (
                  <div className="font-semibold text-gray-900">
                    {group.folderName}
                  </div>
                )}
                {lockedProjectId ? null : (
                  <div className="mt-0.5 text-xs font-medium text-gray-500">
                    {group.projectLabel}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                  {group.documents.length} Dokument
                  {group.documents.length === 1 ? "" : "e"}
                </span>
                {group.folderId ? (
                  <>
                    <button
                      aria-label={`Ordner ${group.folderName} umbenennen`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                      disabled={isPending}
                      onClick={() => setEditingFolderId(group.folderId)}
                      title="Ordner umbenennen"
                      type="button"
                    >
                      <ActionIcon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      aria-label={`Ordner ${group.folderName} löschen`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60"
                      disabled={isPending}
                      onClick={() => deleteFolder(group)}
                      title="Ordner löschen"
                      type="button"
                    >
                      <ActionIcon name="delete" className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </td>
        </tr>

        {group.documents.length === 0 ? (
          <tr className="border-t border-gray-100">
            <td
              className="p-4 text-sm font-medium text-gray-500"
              colSpan={lockedProjectId ? 7 : 8}
            >
              Dieser Ordner ist noch leer.
            </td>
          </tr>
        ) : (
          group.documents.map((fileDocument) => {
            const documentIndex = documentIndexById.get(fileDocument.id) ?? 0;

            return (
              <tr
                className="border-t border-gray-100 align-top"
                key={fileDocument.id}
              >
                <td className="p-3">
                  <input
                    checked={selectedDocumentIds.has(fileDocument.id)}
                    className="h-4 w-4"
                    disabled={isPending}
                    onChange={(event) =>
                      toggleDocumentSelection(
                        fileDocument.id,
                        event.target.checked,
                      )
                    }
                    type="checkbox"
                  />
                </td>
                <td className="p-3">
                  {editingDocumentId === fileDocument.id ? (
                    <form
                      className="flex min-w-0 gap-2"
                      onSubmit={(event) =>
                        updateDocumentName(event, fileDocument.id)
                      }
                    >
                      <input
                        autoFocus
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-gray-900"
                        defaultValue={fileDocument.displayName}
                        name="displayName"
                        required
                        type="text"
                      />
                      <button
                        aria-label="Dokumentname speichern"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                        disabled={isPending}
                        title="Speichern"
                        type="submit"
                      >
                        <ActionIcon name="save" className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Bearbeitung abbrechen"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                        disabled={isPending}
                        onClick={() => setEditingDocumentId(null)}
                        title="Abbrechen"
                        type="button"
                      >
                        <ActionIcon name="close" className="h-4 w-4" />
                      </button>
                    </form>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        className="min-w-0 flex-1 break-words text-left font-semibold text-gray-900 hover:underline"
                        onClick={() => setSelectedIndex(documentIndex)}
                        type="button"
                      >
                        {fileDocument.displayName}
                      </button>
                      <button
                        aria-label="Dokumentname bearbeiten"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                        disabled={isPending}
                        onClick={() => setEditingDocumentId(fileDocument.id)}
                        title="Bearbeiten"
                        type="button"
                      >
                        <ActionIcon name="edit" className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <button
                    className="break-words text-left font-semibold text-gray-900 hover:underline"
                    onClick={() => setSelectedIndex(documentIndex)}
                    type="button"
                  >
                    {fileDocument.originalFileName}
                  </button>
                  <div className="mt-1 text-xs text-gray-500">
                    {getDocumentTypeLabel(fileDocument)}
                  </div>
                </td>
                <td className="p-3 text-gray-700">
                  {fileDocument.folderName || "Ohne Ordner"}
                </td>
                {lockedProjectId ? null : (
                  <td className="p-3 text-gray-700">
                    {fileDocument.projectNumber} · {fileDocument.projectName}
                  </td>
                )}
                <td className="p-3 font-semibold text-gray-900">
                  {formatMb(fileDocument.fileSizeBytes)}
                </td>
                <td className="p-3 text-gray-700">
                  {formatDateTime(fileDocument.uploadedAt)}
                  <div className="mt-1 text-xs text-gray-500">
                    {fileDocument.uploadedByName || "Unbekannt"}
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button
                      aria-label="Dokument herunterladen"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                      onClick={() => downloadDocument(fileDocument)}
                      title="Herunterladen"
                      type="button"
                    >
                      <ActionIcon name="download" className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="Dokument löschen"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60"
                      disabled={isPending}
                      onClick={() => deleteSingleDocument(fileDocument)}
                      title="Löschen"
                      type="button"
                    >
                      <ActionIcon name="delete" className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </Fragment>
    );
  }

  return (
    <>
      {embedded ? null : (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard label="Dokumente gesamt" value={`${documents.length}`} />
          <SummaryCard label="Ordner" value={`${folders.length}`} />
          <SummaryCard label="Datenmenge" value={formatMb(totalMb)} />
        </div>
      )}

      <section
        className={
          embedded
            ? "mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3"
            : "mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-gray-900">
                Dokumente hochladen
              </h2>
              {lockedProjectId ? (
                <div className="mt-2 w-fit rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                  {projects.find((project) => project.id === lockedProjectId)
                    ?.label ?? "Projektakte"}
                </div>
              ) : null}
            </div>
          </div>

          <form
            className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.25fr)]"
            encType="multipart/form-data"
            onSubmit={uploadDocuments}
          >
            {lockedProjectId ? (
              <input name="projectId" type="hidden" value={lockedProjectId} />
            ) : null}

            <div className="rounded-lg bg-gray-50 p-3">
              <label className="text-xs font-semibold uppercase text-gray-500">
                Dokumente
                <ProjectFileDropInput
                  emptyLabel="Dateien ablegen"
                  multiple
                  name="documents"
                  required
                  selectedLabel="Klick oder Drag & Drop"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 content-start gap-3 md:grid-cols-2">
              {lockedProjectId ? null : (
                <label className="text-xs font-semibold uppercase text-gray-500">
                  Baustelle
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900 outline-none focus:border-gray-900"
                    disabled={projects.length === 0}
                    name="projectId"
                    onChange={(event) => changeUploadProject(event.target.value)}
                    required
                    value={uploadProjectId}
                  >
                    <option value="">Baustelle auswählen</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-xs font-semibold uppercase text-gray-500">
                Ordner
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900 outline-none focus:border-gray-900"
                  disabled={
                    !effectiveUploadProjectId || uploadFolders.length === 0
                  }
                  name="folderId"
                >
                  <option value="">Ohne Ordner</option>
                  {uploadFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-semibold uppercase text-gray-500">
                Name
                <input
                  className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900 outline-none focus:border-gray-900"
                  name="displayName"
                  placeholder="Optional, sonst Dateiname"
                  type="text"
                />
              </label>

              <div className="flex justify-end md:col-span-2">
                <button
                  className="h-10 w-full rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60 sm:w-auto"
                  disabled={isPending || projects.length === 0}
                  type="submit"
                >
                  {isPending ? "Lädt hoch..." : "Dokumente hochladen"}
                </button>
              </div>
            </div>
          </form>

          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(120px,0.35fr)_minmax(0,1fr)] lg:items-end">
              <h3 className="pb-2 text-sm font-semibold text-gray-900 lg:pb-0">
                Ordner anlegen
              </h3>

              <form
                className={`grid w-full items-end gap-3 ${
                  lockedProjectId
                    ? "sm:grid-cols-[minmax(220px,1fr)_auto]"
                    : "lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto]"
                }`}
                onSubmit={createFolder}
              >
                {lockedProjectId ? (
                  <input name="projectId" type="hidden" value={lockedProjectId} />
                ) : (
                  <label className="text-xs font-semibold uppercase text-gray-500">
                    Baustelle
                    <select
                      className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900 outline-none focus:border-gray-900"
                      disabled={projects.length === 0}
                      name="projectId"
                      onChange={(event) =>
                        setFolderProjectId(event.target.value)
                      }
                      required
                      value={folderProjectId}
                    >
                      <option value="">Baustelle auswählen</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="text-xs font-semibold uppercase text-gray-500">
                  Neuer Ordner
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm normal-case text-gray-900 outline-none focus:border-gray-900"
                    name="name"
                    placeholder="z. B. Pläne"
                    required
                    type="text"
                  />
                </label>

                <button
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                  disabled={isPending || !createFolderProject}
                  type="submit"
                >
                  Ordner erstellen
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section
        className={
          embedded
            ? "mt-4"
            : "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        }
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Dokumentenliste
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Dateien filtern, markieren, verschieben, herunterladen und prüfen.
            </p>
          </div>

          <div
            className={`grid grid-cols-1 gap-2 ${
              lockedProjectId ? "sm:grid-cols-2" : "sm:grid-cols-3"
            }`}
          >
            {lockedProjectId ? null : (
              <label className="text-xs font-semibold uppercase text-gray-500">
                Baustelle
                <select
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case text-gray-900 outline-none focus:border-gray-900"
                  onChange={(event) => setProjectFilterId(event.target.value)}
                  value={projectFilterId}
                >
                  <option value="">Alle Baustellen</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-xs font-semibold uppercase text-gray-500">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case text-gray-900 outline-none focus:border-gray-900"
                onChange={(event) => setNameFilter(event.target.value)}
                placeholder="Name filtern"
                type="search"
                value={nameFilter}
              />
            </label>
            <label className="text-xs font-semibold uppercase text-gray-500">
              Dokument
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm normal-case text-gray-900 outline-none focus:border-gray-900"
                onChange={(event) => setDocumentFilter(event.target.value)}
                placeholder="Dateiname filtern"
                type="search"
                value={documentFilter}
              />
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800">
                <input
                  checked={allDocumentsSelected}
                  className="h-4 w-4"
                  disabled={isPending || filteredDocuments.length === 0}
                  onChange={(event) => selectAllDocuments(event.target.checked)}
                  type="checkbox"
                />
                Alle markieren
              </label>
              <span className="text-xs font-semibold text-gray-600">
                {selectedCount} ausgewählt
              </span>
              <span className="text-xs text-gray-500">
                {filteredDocuments.length} von {documents.length} Dokumenten
              </span>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <select
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-gray-900 disabled:opacity-60"
                disabled={selectedCount === 0 || isPending}
                onChange={(event) => {
                  setMoveTargetProjectId(event.target.value);
                  setMoveTargetFolderId("");
                }}
                value={moveTargetProjectId}
              >
                <option value="">Zielbaustelle auswählen</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 outline-none focus:border-gray-900 disabled:opacity-60"
                disabled={
                  selectedCount === 0 ||
                  !moveTargetProjectId ||
                  moveTargetFolders.length === 0 ||
                  isPending
                }
                onChange={(event) => setMoveTargetFolderId(event.target.value)}
                value={moveTargetFolderId}
              >
                <option value="">Ohne Ordner</option>
                {moveTargetFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <button
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                disabled={selectedCount === 0 || !moveTargetProjectId || isPending}
                onClick={moveSelectedDocuments}
                type="button"
              >
                Verschieben
              </button>
              <button
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                disabled={selectedCount === 0 || isPending}
                onClick={downloadSelectedDocuments}
                type="button"
              >
                Herunterladen
              </button>
              <button
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                disabled={selectedCount === 0 || isPending}
                onClick={deleteSelectedDocuments}
                type="button"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="w-12 p-3 font-semibold">Mark.</th>
                  <th className="p-3 font-semibold">Name</th>
                  <th className="p-3 font-semibold">Dokument</th>
                  <th className="p-3 font-semibold">Ordner</th>
                  {lockedProjectId ? null : (
                    <th className="p-3 font-semibold">Projekt</th>
                  )}
                  <th className="p-3 font-semibold">Größe</th>
                  <th className="p-3 font-semibold">Hochgeladen</th>
                  <th className="w-28 p-3 font-semibold">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {!lockedProjectId ? (
                  documentProjectGroups.length === 0 ? (
                    <tr>
                      <td className="p-8 text-center text-gray-500" colSpan={8}>
                        Noch keine passenden Dokumente vorhanden.
                      </td>
                    </tr>
                  ) : (
                    documentProjectGroups.map((projectGroup) => {
                      const isExpanded = expandedDocumentProjectIds.has(
                        projectGroup.projectId,
                      );

                      return (
                        <Fragment key={projectGroup.projectId}>
                          <tr className="border-t border-gray-200 bg-white">
                            <td className="px-3 py-3" colSpan={8}>
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <button
                                  className="min-w-0 text-left"
                                  onClick={() =>
                                    toggleDocumentProject(projectGroup.projectId)
                                  }
                                  type="button"
                                >
                                  <div className="font-semibold text-gray-900">
                                    {projectGroup.projectLabel}
                                  </div>
                                  <div className="mt-1 text-xs font-medium text-gray-500">
                                    {projectGroup.folderCount} Ordner ·{" "}
                                    {projectGroup.documentCount} Dokument
                                    {projectGroup.documentCount === 1 ? "" : "e"}
                                  </div>
                                </button>
                                <button
                                  className="w-fit rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                                  onClick={() =>
                                    toggleDocumentProject(projectGroup.projectId)
                                  }
                                  type="button"
                                >
                                  {isExpanded ? "Zuklappen" : "Öffnen"}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded
                            ? projectGroup.groups.map(renderDocumentGroup)
                            : null}
                        </Fragment>
                      );
                    })
                  )
                ) : documentGroups.length === 0 ? (
                  <tr>
                    <td
                      className="p-8 text-center text-gray-500"
                      colSpan={lockedProjectId ? 7 : 8}
                    >
                      Noch keine passenden Dokumente vorhanden.
                    </td>
                  </tr>
                ) : (
                  documentGroups.map((group) => (
                    <Fragment key={group.key}>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td
                          className="px-3 py-2"
                          colSpan={lockedProjectId ? 7 : 8}
                        >
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1">
                              {editingFolderId === group.folderId ? (
                                <form
                                  className="flex max-w-xl gap-2"
                                  onSubmit={(event) =>
                                    updateFolderName(event, group)
                                  }
                                >
                                  <input
                                    autoFocus
                                    className="h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900 outline-none focus:border-gray-900"
                                    defaultValue={group.folderName}
                                    name="folderName"
                                    required
                                    type="text"
                                  />
                                  <button
                                    aria-label="Ordnername speichern"
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                                    disabled={isPending}
                                    title="Speichern"
                                    type="submit"
                                  >
                                    <ActionIcon name="save" className="h-4 w-4" />
                                  </button>
                                  <button
                                    aria-label="Ordnerbearbeitung abbrechen"
                                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                                    disabled={isPending}
                                    onClick={() => setEditingFolderId(null)}
                                    title="Abbrechen"
                                    type="button"
                                  >
                                    <ActionIcon name="close" className="h-4 w-4" />
                                  </button>
                                </form>
                              ) : (
                                <div className="font-semibold text-gray-900">
                                  {group.folderName}
                                </div>
                              )}
                              {lockedProjectId ? null : (
                                <div className="mt-0.5 text-xs font-medium text-gray-500">
                                  {group.projectLabel}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                                {group.documents.length} Dokument
                                {group.documents.length === 1 ? "" : "e"}
                              </span>
                              {group.folderId ? (
                                <>
                                  <button
                                    aria-label={`Ordner ${group.folderName} umbenennen`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                                    disabled={isPending}
                                    onClick={() => setEditingFolderId(group.folderId)}
                                    title="Ordner umbenennen"
                                    type="button"
                                  >
                                    <ActionIcon name="edit" className="h-4 w-4" />
                                  </button>
                                  <button
                                    aria-label={`Ordner ${group.folderName} löschen`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60"
                                    disabled={isPending}
                                    onClick={() => deleteFolder(group)}
                                    title="Ordner löschen"
                                    type="button"
                                  >
                                    <ActionIcon
                                      name="delete"
                                      className="h-4 w-4"
                                    />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {group.documents.length === 0 ? (
                        <tr className="border-t border-gray-100">
                          <td
                            className="p-4 text-sm font-medium text-gray-500"
                            colSpan={lockedProjectId ? 7 : 8}
                          >
                            Dieser Ordner ist noch leer.
                          </td>
                        </tr>
                      ) : (
                        group.documents.map((fileDocument) => {
                          const documentIndex =
                            documentIndexById.get(fileDocument.id) ?? 0;

                          return (
                            <tr
                              className="border-t border-gray-100 align-top"
                              key={fileDocument.id}
                            >
                              <td className="p-3">
                                <input
                                  checked={selectedDocumentIds.has(
                                    fileDocument.id,
                                  )}
                                  className="h-4 w-4"
                                  disabled={isPending}
                                  onChange={(event) =>
                                    toggleDocumentSelection(
                                      fileDocument.id,
                                      event.target.checked,
                                    )
                                  }
                                  type="checkbox"
                                />
                              </td>
                              <td className="p-3">
                                {editingDocumentId === fileDocument.id ? (
                                  <form
                                    className="flex min-w-0 gap-2"
                                    onSubmit={(event) =>
                                      updateDocumentName(
                                        event,
                                        fileDocument.id,
                                      )
                                    }
                                  >
                                    <input
                                      autoFocus
                                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-gray-900"
                                      defaultValue={fileDocument.displayName}
                                      name="displayName"
                                      required
                                      type="text"
                                    />
                                    <button
                                      aria-label="Dokumentname speichern"
                                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                                      disabled={isPending}
                                      title="Speichern"
                                      type="submit"
                                    >
                                      <ActionIcon
                                        name="save"
                                        className="h-4 w-4"
                                      />
                                    </button>
                                    <button
                                      aria-label="Bearbeitung abbrechen"
                                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                                      disabled={isPending}
                                      onClick={() => setEditingDocumentId(null)}
                                      title="Abbrechen"
                                      type="button"
                                    >
                                      <ActionIcon
                                        name="close"
                                        className="h-4 w-4"
                                      />
                                    </button>
                                  </form>
                                ) : (
                                  <div className="flex min-w-0 items-center gap-2">
                                    <button
                                      className="min-w-0 flex-1 break-words text-left font-semibold text-gray-900 hover:underline"
                                      onClick={() => setSelectedIndex(documentIndex)}
                                      type="button"
                                    >
                                      {fileDocument.displayName}
                                    </button>
                                    <button
                                      aria-label="Dokumentname bearbeiten"
                                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                                      disabled={isPending}
                                      onClick={() =>
                                        setEditingDocumentId(fileDocument.id)
                                      }
                                      title="Bearbeiten"
                                      type="button"
                                    >
                                      <ActionIcon
                                        name="edit"
                                        className="h-4 w-4"
                                      />
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                <button
                                  className="break-words text-left font-semibold text-gray-900 hover:underline"
                                  onClick={() => setSelectedIndex(documentIndex)}
                                  type="button"
                                >
                                  {fileDocument.originalFileName}
                                </button>
                                <div className="mt-1 text-xs text-gray-500">
                                  {getDocumentTypeLabel(fileDocument)}
                                </div>
                              </td>
                              <td className="p-3 text-gray-700">
                                {fileDocument.folderName || "Ohne Ordner"}
                              </td>
                              {lockedProjectId ? null : (
                                <td className="p-3 text-gray-700">
                                  {fileDocument.projectNumber} ·{" "}
                                  {fileDocument.projectName}
                                </td>
                              )}
                              <td className="p-3 font-semibold text-gray-900">
                                {formatMb(fileDocument.fileSizeBytes)}
                              </td>
                              <td className="p-3 text-gray-700">
                                {formatDateTime(fileDocument.uploadedAt)}
                                <div className="mt-1 text-xs text-gray-500">
                                  {fileDocument.uploadedByName || "Unbekannt"}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="flex gap-2">
                                  <button
                                    aria-label="Dokument herunterladen"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                                    onClick={() =>
                                      downloadDocument(fileDocument)
                                    }
                                    title="Herunterladen"
                                    type="button"
                                  >
                                    <ActionIcon
                                      name="download"
                                      className="h-4 w-4"
                                    />
                                  </button>
                                  <button
                                    aria-label="Dokument löschen"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60"
                                    disabled={isPending}
                                    onClick={() =>
                                      deleteSingleDocument(fileDocument)
                                    }
                                    title="Löschen"
                                    type="button"
                                  >
                                    <ActionIcon
                                      name="delete"
                                      className="h-4 w-4"
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {selectedDocument ? (
        <DocumentDetailModal
          currentIndex={selectedIndex ?? 0}
          fileDocument={selectedDocument}
          hasMultipleDocuments={filteredDocuments.length > 1}
          isPending={isPending}
          onClose={() => setSelectedIndex(null)}
          onDelete={() => deleteSingleDocument(selectedDocument)}
          onDownload={() => downloadDocument(selectedDocument)}
          onNext={() =>
            setSelectedIndex((current) =>
              current === null
                ? current
                : getNextDocumentIndex(current, filteredDocuments.length),
            )
          }
          onPrevious={() =>
            setSelectedIndex((current) =>
              current === null
                ? current
                : getPreviousDocumentIndex(current, filteredDocuments.length),
            )
          }
          totalCount={filteredDocuments.length}
        />
      ) : null}
    </>
  );
}

function DocumentDetailModal({
  currentIndex,
  fileDocument,
  hasMultipleDocuments,
  isPending,
  onClose,
  onDelete,
  onDownload,
  onNext,
  onPrevious,
  totalCount,
}: {
  currentIndex: number;
  fileDocument: ProjectDocumentListItem;
  hasMultipleDocuments: boolean;
  isPending: boolean;
  onClose: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onNext: () => void;
  onPrevious: () => void;
  totalCount: number;
}) {
  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="grid max-h-[92vh] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-2xl lg:grid-cols-[1.25fr_0.8fr]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative min-h-[360px] bg-gray-950 lg:min-h-[640px]">
          <DocumentPreview fileDocument={fileDocument} />
          {hasMultipleDocuments ? (
            <>
              <button
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow hover:bg-white"
                onClick={onPrevious}
                type="button"
              >
                Zurück
              </button>
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow hover:bg-white"
                onClick={onNext}
                type="button"
              >
                Vor
              </button>
            </>
          ) : null}
        </div>

        <aside className="max-h-[92vh] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="break-words text-lg font-semibold text-gray-900">
                Dokumentdetails
              </h3>
              <p className="mt-1 text-xs font-medium text-gray-500">
                Dokument {currentIndex + 1} von {totalCount}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                aria-label="Dokument herunterladen"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                disabled={isPending}
                onClick={onDownload}
                title="Herunterladen"
                type="button"
              >
                <ActionIcon name="download" className="h-4 w-4" />
              </button>
              <button
                aria-label="Dokument löschen"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60"
                disabled={isPending}
                onClick={onDelete}
                title="Löschen"
                type="button"
              >
                <ActionIcon name="delete" className="h-4 w-4" />
              </button>
              <button
                aria-label="Dokumentdetails schließen"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                disabled={isPending}
                onClick={onClose}
                title="Schließen"
                type="button"
              >
                <ActionIcon name="close" className="h-4 w-4" />
              </button>
            </div>
          </div>

          {hasMultipleDocuments ? (
            <div className="mt-4 flex w-fit overflow-hidden rounded-lg border border-gray-200 bg-white">
              <button
                className="border-r border-gray-200 px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                onClick={onPrevious}
                type="button"
              >
                Zurück
              </button>
              <button
                className="px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                onClick={onNext}
                type="button"
              >
                Vor
              </button>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-2 text-sm">
            <DetailRow label="Name" value={fileDocument.displayName} />
            <DetailRow label="Dokument" value={fileDocument.originalFileName} />
            <DetailRow
              label="Projekt"
              value={`${fileDocument.projectNumber} · ${fileDocument.projectName}`}
            />
            <DetailRow
              label="Ordner"
              value={fileDocument.folderName || "Ohne Ordner"}
            />
            <DetailRow label="Größe" value={formatMb(fileDocument.fileSizeBytes)} />
            <DetailRow
              label="Dateityp"
              value={getDocumentTypeLabel(fileDocument)}
            />
            <DetailRow
              label="Hochgeladen"
              value={`${formatDateTime(fileDocument.uploadedAt)} · ${
                fileDocument.uploadedByName || "Unbekannt"
              }`}
            />
          </div>

          <a
            className="mt-4 inline-flex rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            href={fileDocument.publicUrl}
            rel="noreferrer"
            target="_blank"
          >
            Original öffnen
          </a>
        </aside>
      </div>
    </div>
  );
}

function DocumentPreview({
  fileDocument,
}: {
  fileDocument: ProjectDocumentListItem;
}) {
  const previewType = getPreviewType(fileDocument);

  if (previewType === "image") {
    return (
      <Image
        alt={fileDocument.displayName}
        className="object-contain"
        fill
        sizes="(min-width: 1024px) 60vw, 100vw"
        src={fileDocument.publicUrl}
        unoptimized
      />
    );
  }

  if (previewType === "frame") {
    return (
      <iframe
        className="h-full min-h-[360px] w-full border-0 bg-white lg:min-h-[640px]"
        src={fileDocument.publicUrl}
        title={fileDocument.displayName}
      />
    );
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col items-center justify-center p-8 text-center text-white lg:min-h-[640px]">
      <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4">
        <div className="text-sm font-semibold uppercase text-white/70">
          Keine Browservorschau
        </div>
        <div className="mt-2 max-w-md break-words text-lg font-semibold">
          {fileDocument.originalFileName}
        </div>
        <div className="mt-2 text-sm text-white/70">
          {getDocumentTypeLabel(fileDocument)}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="text-xs font-semibold uppercase text-gray-500">{label}</div>
      <div className="mt-1 break-words font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

type DocumentTableGroup = {
  documents: ProjectDocumentListItem[];
  folderId: string | null;
  folderName: string;
  key: string;
  projectId: string;
  projectLabel: string;
  projectSortLabel: string;
  sortOrder: number;
};

type DocumentProjectTableGroup = {
  documentCount: number;
  folderCount: number;
  groups: DocumentTableGroup[];
  projectId: string;
  projectLabel: string;
  projectSortLabel: string;
};

function getDocumentGroups({
  documents,
  folders,
  includeEmptyFolders,
  listProjectId,
  projects,
}: {
  documents: ProjectDocumentListItem[];
  folders: ProjectDocumentFolderOption[];
  includeEmptyFolders: boolean;
  listProjectId?: string;
  projects: ProjectDocumentProjectOption[];
}) {
  const projectLabelById = new Map(
    projects.map((project) => [project.id, project.label]),
  );
  const groups = new Map<string, DocumentTableGroup>();
  const visibleFolders = folders.filter(
    (folder) => !listProjectId || folder.projectId === listProjectId,
  );

  if (includeEmptyFolders) {
    for (const folder of visibleFolders) {
      groups.set(`folder-${folder.id}`, {
        documents: [],
        folderId: folder.id,
        folderName: folder.name,
        key: `folder-${folder.id}`,
        projectId: folder.projectId,
        projectLabel: projectLabelById.get(folder.projectId) ?? "Projekt",
        projectSortLabel: projectLabelById.get(folder.projectId) ?? "",
        sortOrder: folder.sortOrder,
      });
    }
  }

  for (const fileDocument of documents) {
    const key = fileDocument.folderId
      ? `folder-${fileDocument.folderId}`
      : `without-folder-${fileDocument.projectId}`;
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.documents.push(fileDocument);
      continue;
    }

    groups.set(key, {
      documents: [fileDocument],
      folderId: fileDocument.folderId,
      folderName: fileDocument.folderName || "Ohne Ordner",
      key,
      projectId: fileDocument.projectId,
      projectLabel: `${fileDocument.projectNumber} · ${fileDocument.projectName}`,
      projectSortLabel: `${fileDocument.projectNumber} · ${fileDocument.projectName}`,
      sortOrder: fileDocument.folderId ? 0 : 999999,
    });
  }

  return Array.from(groups.values()).sort(
    (a, b) =>
      a.projectSortLabel.localeCompare(b.projectSortLabel, "de-DE") ||
      a.sortOrder - b.sortOrder ||
      a.folderName.localeCompare(b.folderName, "de-DE"),
  );
}

function getDocumentProjectGroups(groups: DocumentTableGroup[]) {
  const projectGroups = new Map<string, DocumentProjectTableGroup>();

  for (const group of groups) {
    const existingGroup = projectGroups.get(group.projectId);

    if (existingGroup) {
      existingGroup.groups.push(group);
      existingGroup.documentCount += group.documents.length;
      existingGroup.folderCount += group.folderId ? 1 : 0;
      continue;
    }

    projectGroups.set(group.projectId, {
      documentCount: group.documents.length,
      folderCount: group.folderId ? 1 : 0,
      groups: [group],
      projectId: group.projectId,
      projectLabel: group.projectLabel,
      projectSortLabel: group.projectSortLabel,
    });
  }

  return Array.from(projectGroups.values()).sort((a, b) =>
    a.projectSortLabel.localeCompare(b.projectSortLabel, "de-DE"),
  );
}

function getFoldersForProject(
  folders: ProjectDocumentFolderOption[],
  projectId: string,
) {
  return folders
    .filter((folder) => folder.projectId === projectId)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de-DE"),
    );
}

function getInitialProjectId(
  projects: ProjectDocumentProjectOption[],
  projectId?: string,
) {
  if (projectId && projects.some((project) => project.id === projectId)) {
    return projectId;
  }

  return projects[0]?.id ?? "";
}

function getOptionalProjectId(
  projects: ProjectDocumentProjectOption[],
  projectId?: string,
) {
  if (projectId && projects.some((project) => project.id === projectId)) {
    return projectId;
  }

  return "";
}

function getPreviewType(fileDocument: ProjectDocumentListItem) {
  const mimeType = fileDocument.mimeType.toLowerCase();
  const extension = fileDocument.originalFileName.split(".").pop()?.toLowerCase();

  if (mimeType.startsWith("image/")) {
    return "image";
  }

  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    ["csv", "json", "log", "md", "txt"].includes(extension ?? "")
  ) {
    return "frame";
  }

  return "download";
}

function getDocumentTypeLabel(fileDocument: ProjectDocumentListItem) {
  if (fileDocument.mimeType && fileDocument.mimeType !== "application/octet-stream") {
    return fileDocument.mimeType;
  }

  const extension = fileDocument.originalFileName.split(".").pop();
  return extension ? `.${extension}` : "Datei";
}

function downloadDocument(fileDocument: ProjectDocumentListItem) {
  const link = window.document.createElement("a");
  link.href = fileDocument.publicUrl;
  link.download = fileDocument.originalFileName;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatMb(bytes: number) {
  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(bytes / 1024 / 1024)} MB`;
}

function getNextDocumentIndex(currentIndex: number, totalCount: number) {
  if (totalCount <= 1) return currentIndex;
  return currentIndex + 1 >= totalCount ? 0 : currentIndex + 1;
}

function getPreviousDocumentIndex(currentIndex: number, totalCount: number) {
  if (totalCount <= 1) return currentIndex;
  return currentIndex - 1 < 0 ? totalCount - 1 : currentIndex - 1;
}
