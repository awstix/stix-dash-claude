"use client";

import { useState } from "react";

import { adminSetUserPassword } from "./actions";

const inputClass =
  "mt-2 w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-gray-950";

// Avoids visually ambiguous characters (0/O, 1/l/I) since this is meant
// to be read aloud or typed off a screen when handed to the user.
const PASSWORD_CHARSET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generatePassword(length = 14) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => PASSWORD_CHARSET[value % PASSWORD_CHARSET.length]).join("");
}

export function AdminSetPasswordForm({ userId }: { userId: string }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmedPassword, setConfirmedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function fillRandomPassword() {
    const generated = generatePassword();
    setPassword(generated);
    setShowPassword(true);
    setError("");
    setConfirmedPassword(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCopied(false);

    if (password.length < 10) {
      setError("Das Passwort muss mindestens 10 Zeichen lang sein.");
      return;
    }

    setPending(true);
    const result = await adminSetUserPassword(userId, password);
    setPending(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setConfirmedPassword(password);
    setPassword("");
  }

  async function copyConfirmedPassword() {
    if (!confirmedPassword) return;
    await navigator.clipboard.writeText(confirmedPassword);
    setCopied(true);
  }

  if (confirmedPassword) {
    return (
      <div className="mt-4 rounded-xl border border-green-500 bg-green-50 p-4">
        <p className="font-bold text-green-950">
          Neues Passwort gesetzt. Gib es dem Nutzer weiter (z. B. telefonisch
          oder persönlich) - es wird hier nicht gespeichert und ist danach
          nicht mehr einsehbar.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-lg border border-green-400 bg-white px-3 py-2 font-mono text-lg font-bold text-gray-950">
            {confirmedPassword}
          </code>
          <button
            className="rounded-lg border border-green-600 bg-white px-3 py-2 text-sm font-bold text-green-900 hover:bg-green-100"
            onClick={copyConfirmedPassword}
            type="button"
          >
            {copied ? "Kopiert ✓" : "Kopieren"}
          </button>
        </div>
        <button
          className="mt-4 text-sm font-bold text-gray-700 underline"
          onClick={() => setConfirmedPassword(null)}
          type="button"
        >
          Weiteres Passwort vergeben
        </button>
      </div>
    );
  }

  return (
    <form className="mt-4 space-y-3" onSubmit={submit}>
      <label className="block text-sm font-bold text-gray-950">
        Neues Passwort
        <div className="flex gap-2">
          <input
            autoComplete="new-password"
            className={inputClass}
            minLength={10}
            name="newPassword"
            onChange={(event) => setPassword(event.currentTarget.value)}
            type={showPassword ? "text" : "password"}
            value={password}
          />
        </div>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50"
          onClick={() => setShowPassword((current) => !current)}
          type="button"
        >
          {showPassword ? "Verbergen" : "Anzeigen"}
        </button>
        <button
          className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-xs font-bold text-gray-800 hover:bg-gray-50"
          onClick={fillRandomPassword}
          type="button"
        >
          Zufällig generieren
        </button>
      </div>
      {error ? (
        <p className="rounded-xl border border-red-400 bg-red-50 p-3 text-sm font-bold text-red-950">
          {error}
        </p>
      ) : null}
      <button
        className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-60"
        disabled={pending || password.length === 0}
        type="submit"
      >
        {pending ? "Wird gesetzt …" : "Neues Passwort vergeben"}
      </button>
    </form>
  );
}
