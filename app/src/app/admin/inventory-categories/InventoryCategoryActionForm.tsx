"use client";

import {
  startTransition,
  useActionState,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

type CategoryActionState = {
  error: string | null;
  errorKey: number;
  success: boolean;
  successKey: number;
};

const initialState: CategoryActionState = {
  error: null,
  errorKey: 0,
  success: false,
  successKey: 0,
};

export function InventoryCategoryActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (
    previousState: CategoryActionState,
    formData: FormData,
  ) => Promise<CategoryActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [dismissedErrorKey, setDismissedErrorKey] = useState(0);
  const visibleError =
    state.error && state.errorKey !== dismissedErrorKey ? state.error : null;

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <>
      <form className={className} onSubmit={submitForm} ref={formRef}>
        <fieldset
          className="contents"
          disabled={isPending}
          key={resetOnSuccess ? state.successKey : 0}
        >
          {children}
        </fieldset>
      </form>

      {visibleError ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[180] flex items-center justify-center bg-gray-950/45 p-4"
          role="alertdialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Eingabe prüfen
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-700">
                  {visibleError}
                </p>
              </div>
              <button
                aria-label="Fehlermeldung schließen"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-xl font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setDismissedErrorKey(state.errorKey)}
                type="button"
              >
                ×
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
