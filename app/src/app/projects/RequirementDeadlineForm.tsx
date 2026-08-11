"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";

const DEADLINE_HOUR = 16;

function getDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTomorrowInput() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getDateInput(tomorrow);
}

function isDeadlinePassedForTomorrow(neededDateValue: string) {
  if (!neededDateValue) return false;
  if (neededDateValue !== getTomorrowInput()) return false;

  const now = new Date();
  const deadline = new Date();
  deadline.setHours(DEADLINE_HOUR, 0, 0, 0);

  return now.getTime() >= deadline.getTime();
}

export function RequirementDeadlineForm({
  action,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const bypassCheckRef = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (bypassCheckRef.current) {
      bypassCheckRef.current = false;
      return;
    }

    const neededDateValue = String(
      new FormData(event.currentTarget).get("neededDate") ?? "",
    );

    if (isDeadlinePassedForTomorrow(neededDateValue)) {
      event.preventDefault();
      setDialogOpen(true);
    }
  }

  function submitBypassingCheck() {
    bypassCheckRef.current = true;
    setDialogOpen(false);
    formRef.current?.requestSubmit();
  }

  function acceptAnyway() {
    submitBypassingCheck();
  }

  function revise() {
    setDialogOpen(false);
  }

  function discard() {
    formRef.current?.reset();
    setDialogOpen(false);
  }

  function postponeToDayAfter() {
    const input = formRef.current?.elements.namedItem(
      "neededDate",
    ) as HTMLInputElement | null;

    if (input?.value) {
      const nextDate = new Date(`${input.value}T00:00:00`);
      nextDate.setDate(nextDate.getDate() + 1);
      input.value = getDateInput(nextDate);
    }

    submitBypassingCheck();
  }

  return (
    <>
      <form
        action={action}
        className={className}
        onSubmit={handleSubmit}
        ref={formRef}
      >
        {children}
      </form>

      {dialogOpen ? (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
            <p className="text-sm font-bold uppercase tracking-wide text-red-700">
              Timer abgelaufen
            </p>
            <p className="mt-2 text-sm leading-6 text-gray-700">
              Der Bestell-Timer für morgen ist um 16:00 Uhr abgelaufen. Bitte
              mit Dispo klären.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                onClick={acceptAnyway}
                type="button"
              >
                Bestellung übernehmen
              </button>
              <button
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                onClick={revise}
                type="button"
              >
                Bestellung überarbeiten
              </button>
              <button
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
                onClick={postponeToDayAfter}
                type="button"
              >
                Bestellung auf den Folgetag verschieben
              </button>
              <button
                className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                onClick={discard}
                type="button"
              >
                Bestellung verwerfen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
