"use client";

import { useState } from "react";
import { ActionIcon } from "@/components/ActionIcon";

import { SignatureFormField } from "./SignatureFormField";

export function ExternalParticipants({ defaultDate }: { defaultDate: string }) {
  const [rows, setRows] = useState<string[]>([]);

  return (
    <div className="mt-6 border-t border-gray-400 pt-5 text-black">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Externe teilnehmende Personen</h3>
          <p className="mt-1 text-xs font-medium text-gray-600">
            Personen außerhalb der Firma mit Firma, Datum und Unterschrift erfassen.
          </p>
        </div>
        <button
          className="border border-black bg-white px-4 py-2 text-sm font-bold"
          onClick={() => setRows((current) => [...current, crypto.randomUUID()])}
          type="button"
        >
          + Externe Person
        </button>
      </div>
      <div className="mt-4 space-y-4">
        {rows.map((id, index) => (
          <div className="border border-gray-400 p-4" key={id}>
            <div className="flex justify-between gap-3">
              <p className="font-bold">Externe Person {index + 1}</p>
              <button
                aria-label="Externe Person entfernen"
                className="text-xl font-bold"
                onClick={() =>
                  setRows((current) => current.filter((row) => row !== id))
                }
                type="button"
              >
                <ActionIcon name="close" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <input className="border border-gray-400 bg-white p-3" name="externalCompany" placeholder="Firma / Abteilung" />
              <input className="border border-gray-400 bg-white p-3" defaultValue={defaultDate} name="externalInstructionDate" type="date" />
              <input className="border border-gray-400 bg-white p-3" name="externalFirstName" placeholder="Vorname" required />
              <input className="border border-gray-400 bg-white p-3" name="externalLastName" placeholder="Nachname" required />
            </div>
            <div className="mt-3">
              <SignatureFormField label="Unterschrift der externen Person" name="externalSignature" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
