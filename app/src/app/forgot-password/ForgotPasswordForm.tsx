"use client";

import { useState } from "react";
import Link from "next/link";

import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm() {
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    setPending(true);
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(false);

    // Deliberately don't reveal whether the address exists - always show
    // the same success message so this form can't be used to check which
    // emails have an account.
    if (result.error) {
      setError("Die Anfrage ist fehlgeschlagen. Bitte versuche es erneut.");
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <p className="mt-6 rounded-xl border border-green-500 bg-green-50 p-3 text-sm font-bold text-green-950">
        Falls zu dieser Adresse ein Konto existiert, ist eine E-Mail mit
        einem Link zum Zurücksetzen unterwegs.
      </p>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-bold text-gray-950">
        E-Mail-Adresse
        <input
          autoComplete="email"
          autoFocus
          className="mt-2 w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-gray-950"
          name="email"
          required
          type="email"
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
        {pending ? "Wird gesendet …" : "Link zum Zurücksetzen senden"}
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
