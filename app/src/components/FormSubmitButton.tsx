"use client";

import { useFormStatus } from "react-dom";

export function FormSubmitButton({
  className,
  idleLabel,
  pendingLabel,
}: {
  className: string;
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={`inline-flex items-center gap-2 disabled:opacity-60 ${className}`}
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" />
          {pendingLabel}
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}
