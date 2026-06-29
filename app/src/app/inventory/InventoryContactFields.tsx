"use client";

import { useState } from "react";

export type InventoryContactFormValue = {
  company: string | null;
  email: string | null;
  id?: string;
  name: string | null;
  notes: string | null;
  phone: string | null;
  role: string;
  website: string | null;
};

function emptyContact(): InventoryContactFormValue {
  return {
    company: "",
    email: "",
    name: "",
    notes: "",
    phone: "",
    role: "",
    website: "",
  };
}

export function InventoryContactFields({
  contacts,
}: {
  contacts: InventoryContactFormValue[];
}) {
  const [visibleContacts, setVisibleContacts] = useState<
    InventoryContactFormValue[]
  >(contacts.length > 0 ? contacts : [emptyContact()]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 xl:col-span-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">
            Kontakte / Ansprechpartner
          </h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Zum Beispiel Hersteller, Vertreter, Werkstatt oder Reparaturservice.
          </p>
        </div>

        <button
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          onClick={() =>
            setVisibleContacts((current) => [...current, emptyContact()])
          }
          type="button"
        >
          + Ansprechpartner hinzufügen
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {visibleContacts.map((contact, index) => (
          <div
            className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-3 md:grid-cols-2 xl:grid-cols-6"
            key={contact.id ?? index}
          >
            <Input
              defaultValue={contact.role}
              label="Rolle"
              name="contactRole"
              placeholder="z.B. Werkstatt"
            />
            <Input
              defaultValue={contact.company ?? ""}
              label="Firma"
              name="contactCompany"
            />
            <Input
              defaultValue={contact.name ?? ""}
              label="Name"
              name="contactName"
            />
            <Input
              defaultValue={contact.phone ?? ""}
              label="Telefon"
              name="contactPhone"
            />
            <Input
              defaultValue={contact.email ?? ""}
              label="E-Mail"
              name="contactEmail"
              type="email"
            />
            <Input
              defaultValue={contact.website ?? ""}
              label="Website"
              name="contactWebsite"
            />
            <Input
              className="xl:col-span-6"
              defaultValue={contact.notes ?? ""}
              label="Notiz"
              name="contactNotes"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Input({
  className = "",
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
}) {
  return (
    <label className={`text-sm font-medium text-gray-800 ${className}`}>
      {label}
      <input
        {...props}
        className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
      />
    </label>
  );
}
