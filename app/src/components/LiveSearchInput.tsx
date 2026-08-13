"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export function LiveSearchInput({
  className,
  paramName = "q",
  placeholder,
}: {
  className?: string;
  paramName?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(urlValue);
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the field in sync when the URL changes from outside this input
  // (e.g. browser back/forward) - done during render, not in an effect, so
  // it doesn't fight with the debounced update below.
  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue);
    setValue(urlValue);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function applyValue(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) {
      params.set(paramName, next);
    } else {
      params.delete(paramName);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleChange(next: string) {
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => applyValue(next), 300);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    applyValue(value);
  }

  return (
    <input
      className={className}
      onChange={(event) => handleChange(event.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  );
}
