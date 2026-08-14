"use client";

import { useState } from "react";

type Preset = {
  host: string;
  port: number;
  secure: boolean;
  userHint: string;
};

const PRESETS: Record<string, Preset> = {
  custom: { host: "", port: 587, secure: false, userHint: "" },
  office365: {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    userHint: "vollständige E-Mail-Adresse des Postfachs",
  },
  resend: {
    host: "smtp.resend.com",
    port: 465,
    secure: true,
    userHint: '"resend" (fest vorgegeben von Resend)',
  },
  sendgrid: {
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    userHint: '"apikey" (fest vorgegeben von SendGrid)',
  },
};

const PROVIDER_LABELS: Record<string, string> = {
  custom: "Eigener Mailserver",
  office365: "Microsoft 365 / Outlook",
  resend: "Resend",
  sendgrid: "SendGrid",
};

export function EmailProviderPresetFields({
  defaultFromAddress,
  defaultFromName,
  defaultProvider,
  defaultSmtpHost,
  defaultSmtpPort,
  defaultSmtpSecure,
  defaultSmtpUser,
  hasStoredPassword,
  inputClass,
}: {
  defaultFromAddress: string;
  defaultFromName: string;
  defaultProvider: string;
  defaultSmtpHost: string;
  defaultSmtpPort: number;
  defaultSmtpSecure: boolean;
  defaultSmtpUser: string;
  hasStoredPassword: boolean;
  inputClass: string;
}) {
  const [provider, setProvider] = useState(defaultProvider);
  const [host, setHost] = useState(defaultSmtpHost);
  const [port, setPort] = useState(defaultSmtpPort);
  const [secure, setSecure] = useState(defaultSmtpSecure);

  function handleProviderChange(next: string) {
    setProvider(next);
    const preset = PRESETS[next];
    if (preset && next !== "custom") {
      setHost(preset.host);
      setPort(preset.port);
      setSecure(preset.secure);
    }
  }

  const userHint = PRESETS[provider]?.userHint;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <label className="text-sm font-medium text-gray-800 lg:col-span-2">
        Anbieter
        <select
          className={inputClass}
          name="provider"
          onChange={(event) => handleProviderChange(event.target.value)}
          value={provider}
        >
          {Object.entries(PROVIDER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-gray-500">
          Füllt Server/Port als Vorschlag aus - danach frei anpassbar.
        </span>
      </label>

      <label className="text-sm font-medium text-gray-800">
        SMTP-Server
        <input
          className={inputClass}
          name="smtpHost"
          onChange={(event) => setHost(event.target.value)}
          placeholder="smtp.beispiel.de"
          value={host}
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Port
        <input
          className={inputClass}
          min={1}
          max={65535}
          name="smtpPort"
          onChange={(event) => setPort(Number(event.target.value) || 0)}
          type="number"
          value={port}
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-800 lg:col-span-2">
        <input
          checked={secure}
          className="h-4 w-4 rounded border-gray-300"
          name="smtpSecure"
          onChange={(event) => setSecure(event.target.checked)}
          type="checkbox"
        />
        Verschlüsselte Verbindung von Anfang an (SSL/TLS, meist Port 465).
        Bei Port 587 üblicherweise ausgeschaltet lassen (STARTTLS wird
        automatisch verhandelt).
      </label>

      <label className="text-sm font-medium text-gray-800">
        Benutzername
        <input
          className={inputClass}
          defaultValue={defaultSmtpUser}
          name="smtpUser"
          placeholder={userHint || "Benutzername"}
        />
        {userHint ? (
          <span className="mt-1 block text-xs text-gray-500">{userHint}</span>
        ) : null}
      </label>

      <label className="text-sm font-medium text-gray-800">
        Passwort / API-Key
        <input
          className={inputClass}
          name="smtpPassword"
          placeholder={
            hasStoredPassword
              ? "•••••• (gespeichert - leer lassen, um es zu behalten)"
              : "Passwort oder API-Key"
          }
          type="password"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Absenderadresse
        <input
          className={inputClass}
          defaultValue={defaultFromAddress}
          name="fromAddress"
          placeholder="portal@beispiel.de"
          type="email"
        />
      </label>

      <label className="text-sm font-medium text-gray-800">
        Absendername
        <input
          className={inputClass}
          defaultValue={defaultFromName}
          name="fromName"
          placeholder="STIX Portal"
        />
      </label>
    </div>
  );
}
