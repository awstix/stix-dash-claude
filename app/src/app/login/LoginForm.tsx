"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("identifier") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const result = identifier.includes("@")
      ? await authClient.signIn.email({
          email: identifier,
          password,
          rememberMe: true,
        })
      : await authClient.signIn.username({
          password,
          rememberMe: true,
          username: identifier,
        });
    setPending(false);
    if (result.error) {
      setError("Benutzername/E-Mail oder Passwort ist nicht korrekt.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-bold text-gray-950">
        E-Mail oder Benutzername
        <input
          autoComplete="username"
          autoFocus
          className="mt-2 w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-gray-950"
          name="identifier"
          required
        />
      </label>
      <label className="block text-sm font-bold text-gray-950">
        Passwort
        <input
          autoComplete="current-password"
          className="mt-2 w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-gray-950"
          minLength={10}
          name="password"
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
        {pending ? "Anmeldung läuft …" : "Anmelden"}
      </button>
    </form>
  );
}
