import type { InputHTMLAttributes } from "react";

export function FreeTextCombobox({
  className = "",
  options,
  suggestionsId,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  options: Array<{ id: string; label: string }>;
  suggestionsId: string;
}) {
  return (
    <>
      <span className="relative block">
        <input
          {...inputProps}
          list={suggestionsId}
          className={`${className} pr-10`}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="m7 10 5 5 5-5" />
          </svg>
        </span>
      </span>
      <datalist id={suggestionsId}>
        {options.map((option) => (
          <option key={option.id} value={option.label} />
        ))}
      </datalist>
    </>
  );
}
