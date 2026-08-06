"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ChangePasswordForm() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    const formData = new FormData(event.currentTarget);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword !== confirmPassword) {
      setError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }

    setPending(true);
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: false,
    });
    setPending(false);

    if (result.error) {
      setError(
        result.error.message ?? "Passwort konnte nicht geändert werden.",
      );
      return;
    }

    setSuccess(true);
    event.currentTarget.reset();
  }

  return (
    <form className="mt-4 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-bold text-gray-950">
        Aktuelles Passwort
        <input
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-gray-950"
          name="currentPassword"
          required
          type="password"
        />
      </label>
      <label className="block text-sm font-bold text-gray-950">
        Neues Passwort
        <input
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-gray-950"
          minLength={10}
          name="newPassword"
          required
          type="password"
        />
      </label>
      <label className="block text-sm font-bold text-gray-950">
        Neues Passwort bestätigen
        <input
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-gray-950"
          minLength={10}
          name="confirmPassword"
          required
          type="password"
        />
      </label>
      {error ? (
        <p className="rounded-xl border border-red-400 bg-red-50 p-3 text-sm font-bold text-red-950">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-green-400 bg-green-50 p-3 text-sm font-bold text-green-950">
          Passwort wurde geändert.
        </p>
      ) : null}
      <button
        className="rounded-xl bg-gray-950 px-5 py-3 font-bold text-white hover:bg-gray-800 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Wird gespeichert …" : "Passwort ändern"}
      </button>
    </form>
  );
}
