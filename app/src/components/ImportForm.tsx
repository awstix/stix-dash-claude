"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

type ProgressState = {
  processed: number;
  status: string;
  total: number;
};

function ImportProgressStatus({
  importRunId,
  progressEndpoint,
}: {
  importRunId: string;
  progressEndpoint: string;
}) {
  const { pending } = useFormStatus();
  const [progress, setProgress] = useState<ProgressState | null>(null);

  useEffect(() => {
    if (!pending) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `${progressEndpoint}?id=${importRunId}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as ProgressState;
        if (!cancelled) setProgress(data);
      } catch {
        // Transient network hiccup while polling – keep trying.
      }
    };

    poll();
    const interval = window.setInterval(poll, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pending, importRunId, progressEndpoint]);

  if (!pending) return null;

  const total = progress?.total ?? 0;
  const processed = Math.min(progress?.processed ?? 0, total);
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center justify-between text-sm font-semibold text-blue-900">
        <span>
          {total > 0 ? `Zeile ${processed} von ${total}` : "Import startet …"}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** Wraps an import `<form>` with a live "Zeile X von Y" progress bar, backed
 * by the shared `ImportProgress` model. Give each import feature its own
 * `progressEndpoint` GET route (id -> {processed, total, status}). */
export function ImportForm({
  action,
  children,
  className,
  progressEndpoint,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
  progressEndpoint: string;
}) {
  const importRunIdRef = useRef<HTMLInputElement>(null);
  const [importRunId, setImportRunId] = useState(() => crypto.randomUUID());

  function handleSubmit() {
    const freshId = crypto.randomUUID();
    if (importRunIdRef.current) {
      importRunIdRef.current.value = freshId;
    }
    setImportRunId(freshId);
  }

  return (
    <form action={action} className={className} onSubmit={handleSubmit}>
      <input
        defaultValue={importRunId}
        name="importRunId"
        ref={importRunIdRef}
        type="hidden"
      />
      {children}
      <ImportProgressStatus
        importRunId={importRunId}
        progressEndpoint={progressEndpoint}
      />
    </form>
  );
}
