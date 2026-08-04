"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import {
  createPortalRoleAction,
  deletePortalRoleAction,
  renamePortalRoleAction,
  type RoleActionState,
} from "./actions";

const initialState: RoleActionState = { error: null, errorKey: 0 };

type Role = {
  description: string | null;
  id: string;
  isBuiltIn: boolean;
  key: string;
  label: string;
};

function ErrorPopup({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/45 p-4"
      role="alertdialog"
    >
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Eingabe prüfen</h3>
            <p className="mt-2 text-sm leading-6 text-gray-700">{message}</p>
          </div>
          <button
            aria-label="Fehlermeldung schließen"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-xl font-semibold text-gray-700 hover:bg-gray-50"
            onClick={onClose}
            type="button"
          >
            <ActionIcon className="h-4 w-4" name="close" />
          </button>
        </div>
        <button
          className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          onClick={onClose}
          type="button"
        >
          Eingaben korrigieren
        </button>
      </div>
    </div>
  );
}

/** Läuft eine Aktion gerade nicht mehr, aber lief zuvor, und kam ohne Fehler zurück – dann war
 * sie erfolgreich. So lässt sich "danach etwas tun" ohne eigenes success-Flag im Server-State
 * abbilden. */
function useRanSuccessfully(isPending: boolean, error: string | null, onSuccess: () => void) {
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !isPending && !error) {
      onSuccess();
    }
    wasPending.current = isPending;
  }, [isPending, error, onSuccess]);
}

function RenameRoleRow({ id, label, description }: { id: string; label: string; description: string | null }) {
  const [state, formAction, isPending] = useActionState(renamePortalRoleAction, initialState);
  const [isEditing, setIsEditing] = useState(false);
  const [dismissedErrorKey, setDismissedErrorKey] = useState(0);
  const visibleError = state.error && state.errorKey !== dismissedErrorKey ? state.error : null;

  useRanSuccessfully(isPending, state.error, () => setIsEditing(false));

  if (!isEditing) {
    return (
      <button
        aria-label={`${label} umbenennen`}
        className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        onClick={() => setIsEditing(true)}
        title="Umbenennen"
        type="button"
      >
        <ActionIcon className="h-3.5 w-3.5" name="edit" />
      </button>
    );
  }

  return (
    <>
      <form action={formAction} className="mt-2 space-y-1.5 rounded-lg border border-gray-200 bg-gray-50 p-2">
        <input name="id" type="hidden" value={id} />
        <input
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900"
          defaultValue={label}
          disabled={isPending}
          name="label"
          placeholder="Rollenname"
        />
        <input
          className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900"
          defaultValue={description ?? ""}
          disabled={isPending}
          name="description"
          placeholder="Beschreibung (optional)"
        />
        <div className="flex gap-1.5">
          <button
            className="flex-1 rounded-lg bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Speichert..." : "Speichern"}
          </button>
          <button
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700"
            onClick={() => setIsEditing(false)}
            type="button"
          >
            Abbrechen
          </button>
        </div>
      </form>
      {visibleError ? <ErrorPopup message={visibleError} onClose={() => setDismissedErrorKey(state.errorKey)} /> : null}
    </>
  );
}

function DeleteRoleButton({ id, label }: { id: string; label: string }) {
  const [state, formAction, isPending] = useActionState(deletePortalRoleAction, initialState);
  const [dismissedErrorKey, setDismissedErrorKey] = useState(0);
  const visibleError = state.error && state.errorKey !== dismissedErrorKey ? state.error : null;

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!confirm(`Rolle „${label}“ wirklich löschen? Mitarbeiter mit dieser Rolle verlieren sie dabei.`)) {
            return;
          }
          formAction(new FormData(event.currentTarget));
        }}
      >
        <input name="id" type="hidden" value={id} />
        <button
          aria-label={`${label} löschen`}
          className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
          disabled={isPending}
          title="Löschen"
          type="submit"
        >
          <ActionIcon className="h-3.5 w-3.5" name="delete" />
        </button>
      </form>
      {visibleError ? <ErrorPopup message={visibleError} onClose={() => setDismissedErrorKey(state.errorKey)} /> : null}
    </>
  );
}

function CreateRoleForm() {
  const [state, formAction, isPending] = useActionState(createPortalRoleAction, initialState);
  const [dismissedErrorKey, setDismissedErrorKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const visibleError = state.error && state.errorKey !== dismissedErrorKey ? state.error : null;

  useRanSuccessfully(isPending, state.error, () => formRef.current?.reset());

  return (
    <>
      <details className="mt-2 rounded-lg border border-dashed border-gray-300 p-2">
        <summary className="cursor-pointer text-xs font-semibold text-gray-700">+ Neue Rolle</summary>
        <form action={formAction} className="mt-2 space-y-1.5" ref={formRef}>
          <input
            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900"
            disabled={isPending}
            name="label"
            placeholder="Name der Rolle"
            required
          />
          <input
            className="w-full rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900"
            disabled={isPending}
            name="description"
            placeholder="Beschreibung (optional)"
          />
          <button
            className="w-full rounded-lg bg-gray-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Wird angelegt..." : "Rolle anlegen"}
          </button>
        </form>
      </details>
      {visibleError ? <ErrorPopup message={visibleError} onClose={() => setDismissedErrorKey(state.errorKey)} /> : null}
    </>
  );
}

export function RoleSidebar({ roles, selectedRoleKey }: { roles: Role[]; selectedRoleKey: string }) {
  return (
    <nav className="flex flex-col gap-1 self-start rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <span className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">Rolle</span>
      {roles.map((role) => (
        <div key={role.key}>
          <div className="flex items-center gap-1">
            <Link
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                role.key === selectedRoleKey ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
              href={`/admin/permissions?role=${role.key}`}
            >
              {role.label}
              {role.key === "admin" ? (
                <span className="ml-1.5 text-[10px] font-normal opacity-70">(immer alles)</span>
              ) : null}
            </Link>
            <RenameRoleRow description={role.description} id={role.id} label={role.label} />
            {role.isBuiltIn ? null : <DeleteRoleButton id={role.id} label={role.label} />}
          </div>
        </div>
      ))}
      <CreateRoleForm />
    </nav>
  );
}
