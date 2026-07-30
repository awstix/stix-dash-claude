"use client";

import { useActionState } from "react";
import Link from "next/link";

import { registerPortalUser, type RegistrationState } from "./actions";

const initialState: RegistrationState = {};
const inputClass =
  "mt-2 w-full rounded-xl border border-gray-400 bg-white px-4 py-3 text-gray-950";

export function RegisterForm() {
  const [state, action, pending] = useActionState(
    registerPortalUser,
    initialState,
  );

  if (state.success) {
    return (
      <div className="mt-6 space-y-4">
        <p className="rounded-xl border border-green-500 bg-green-50 p-4 font-bold text-green-950">
          {state.success}
        </p>
        <p className="text-gray-950">
          Dein Benutzername: <strong>{state.username}</strong>
        </p>
        <Link
          className="inline-flex rounded-xl bg-gray-950 px-4 py-3 font-bold text-white"
          href="/login"
        >
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block text-sm font-bold text-gray-950">
        Geburtsdatum
        <input autoFocus className={inputClass} name="birthDate" required type="date" />
      </label>
      <label className="block text-sm font-bold text-gray-950">
        E-Mail-Adresse
        <input
          autoComplete="email"
          className={inputClass}
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block text-sm font-bold text-gray-950">
        Passwort
        <input
          autoComplete="new-password"
          className={inputClass}
          minLength={10}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="block text-sm font-bold text-gray-950">
        Passwort wiederholen
        <input
          autoComplete="new-password"
          className={inputClass}
          minLength={10}
          name="passwordRepeat"
          required
          type="password"
        />
      </label>
      {state.error ? (
        <p className="rounded-xl border border-red-500 bg-red-50 p-3 text-sm font-bold text-red-950">
          {state.error}
        </p>
      ) : null}
      <button
        className="w-full rounded-xl bg-gray-950 px-4 py-3 font-bold text-white disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Konto wird angelegt …" : "Konto anlegen"}
      </button>
      <Link className="block text-center font-bold text-gray-950 underline" href="/login">
        Bereits registriert? Zur Anmeldung
      </Link>
    </form>
  );
}
