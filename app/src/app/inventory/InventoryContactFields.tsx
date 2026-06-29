"use client";

import { useState } from "react";

export type InventoryContactFormValue = {
  company: string | null;
  email: string | null;
  firstName: string | null;
  id?: string;
  lastName: string | null;
  mobilePhone: string | null;
  name: string | null;
  notes: string | null;
  phone: string | null;
  role: string;
  salutation: string | null;
  website: string | null;
};

function emptyContact(): InventoryContactFormValue {
  return {
    company: "",
    email: "",
    firstName: "",
    lastName: "",
    mobilePhone: "",
    name: "",
    notes: "",
    phone: "",
    role: "",
    salutation: "",
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
            className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-3 md:grid-cols-2 xl:grid-cols-12"
            key={contact.id ?? index}
          >
            <Input
              className="xl:col-span-3"
              defaultValue={contact.company ?? ""}
              label="Firma"
              name="contactCompany"
            />
            <Input
              className="xl:col-span-2"
              defaultValue={contact.role}
              label="Rolle"
              name="contactRole"
              placeholder="z.B. Werkstatt"
            />
            <Input
              className="xl:col-span-2"
              defaultValue={contact.salutation ?? ""}
              label="Anrede"
              list="inventory-contact-salutations"
              name="contactSalutation"
              placeholder="Herr, Frau, Divers oder eigene Eingabe"
            />
            <Input
              className="xl:col-span-2"
              defaultValue={contact.firstName ?? ""}
              label="Vorname"
              name="contactFirstName"
            />
            <Input
              className="xl:col-span-3"
              defaultValue={contact.lastName ?? ""}
              label="Nachname"
              name="contactLastName"
            />
            <Input
              className="xl:col-span-3"
              defaultValue={contact.phone ?? ""}
              label="Telefon"
              name="contactPhone"
            />
            <Input
              className="xl:col-span-3"
              defaultValue={contact.mobilePhone ?? ""}
              label="Mobilnummer"
              name="contactMobilePhone"
            />
            <Input
              className="xl:col-span-3"
              defaultValue={contact.email ?? ""}
              label="E-Mail"
              name="contactEmail"
              type="email"
            />
            <Input
              className="xl:col-span-3"
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
      <datalist id="inventory-contact-salutations">
        <option value="Herr" />
        <option value="Frau" />
        <option value="Divers" />
      </datalist>
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
