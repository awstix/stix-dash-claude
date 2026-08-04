"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import type { WorkTimePresetActionState } from "./actions";

const initialState: WorkTimePresetActionState = { error: null, errorKey: 0 };

export function WorkTimePresetForm({
  action,
  children,
  className,
  formId,
}: {
  action: (state: WorkTimePresetActionState, formData: FormData) => Promise<WorkTimePresetActionState>;
  children: ReactNode;
  className?: string;
  formId?: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const [dismissedErrorKey, setDismissedErrorKey] = useState(0);
  const visibleError = state.error && state.errorKey !== dismissedErrorKey ? state.error : null;

  return (
    <>
      <form action={formAction} className={className} id={formId}>
        {children}
      </form>

      {visibleError ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/45 p-4"
          role="alertdialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Eingabe prüfen</h3>
                <p className="mt-2 text-sm leading-6 text-gray-700">{visibleError}</p>
              </div>
              <button
                aria-label="Fehlermeldung schließen"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-xl font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setDismissedErrorKey(state.errorKey)}
                type="button"
              >
                <ActionIcon className="h-4 w-4" name="close" />
              </button>
            </div>
            <button
              className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
              onClick={() => setDismissedErrorKey(state.errorKey)}
              type="button"
            >
              Eingaben korrigieren
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
