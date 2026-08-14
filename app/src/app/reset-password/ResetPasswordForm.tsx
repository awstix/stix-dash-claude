"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (newPassword.length < 10) {
      setError("Das Passwort muss mindestens 10 Zeichen lang sein.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setPending(true);
    const result = await authClient.resetPassword({ newPassword, token });
    setPending(false);

    if (result.error) {
      setError(
        "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.",
      );
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  }

  if (done) {
    return (
      <p className="mt-6 rounded-xl border border-green-500 bg-green-50 p-3 text-sm font-bold text-green-950">
        Passwort gespeichert. Du wirst zur Anmeldung weitergeleitet …
      </p>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-bold text-gray-950">
        Neues Passwort
        <input
          autoComplete="new-password"
          autoFocus
          className="mt-2 w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-gray-950"
          minLength={10}
          name="newPassword"
          required
          type="password"
        />
      </label>
      <label className="block text-sm font-bold text-gray-950">
        Passwort wiederholen
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
      <button
        className="w-full rounded-xl bg-gray-950 px-4 py-3 font-bold text-white hover:bg-gray-800 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Speichern …" : "Passwort speichern"}
      </button>
      <Link
        className="block text-center font-bold text-gray-950 underline"
        href="/login"
      >
        Zurück zur Anmeldung
      </Link>
    </form>
  );
}
