"use client";

import { useState } from "react";
import { createPortalUser } from "./actions";

type Employee = { firstName: string; id: string; lastName: string };
type PortalRole = { key: string; label: string };

export function CreatePortalUserForm({
  emailConfigured,
  employees,
  inputClass,
  portalRoles,
}: {
  emailConfigured: boolean;
  employees: Employee[];
  inputClass: string;
  portalRoles: PortalRole[];
}) {
  const [inviteViaEmail, setInviteViaEmail] = useState(false);

  return (
    <form action={createPortalUser} className="mt-5 grid gap-4 md:grid-cols-2">
      <label className="text-sm font-bold">
        Mitarbeiter
        <select className={inputClass} name="employeeId" required>
          <option value="">Mitarbeiter auswählen …</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.lastName}, {employee.firstName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-3 pt-7 text-sm font-bold">
        <input
          className="h-5 w-5 accent-gray-950"
          name="canApproveLeaveRequests"
          type="checkbox"
        />
        Darf Urlaubsanträge freigeben
      </label>
      <fieldset className="md:col-span-2">
        <legend className="text-sm font-bold">Rollen (kombinierbar)</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {portalRoles.map((role) => (
            <label
              className="flex items-center gap-2 rounded-xl border border-gray-400 p-3 font-bold text-gray-950"
              key={role.key}
            >
              <input
                className="h-5 w-5 accent-gray-950"
                defaultChecked={role.key === "employee"}
                name="role"
                type="checkbox"
                value={role.key}
              />
              {role.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm font-bold">
        E-Mail {inviteViaEmail ? "(für Einladung erforderlich)" : "(optional)"}
        <input
          className={inputClass}
          name="email"
          required={inviteViaEmail}
          type="email"
        />
      </label>

      {emailConfigured ? (
        <label className="flex items-center gap-3 pt-7 text-sm font-bold">
          <input
            checked={inviteViaEmail}
            className="h-5 w-5 accent-gray-950"
            name="inviteViaEmail"
            onChange={(event) => setInviteViaEmail(event.target.checked)}
            type="checkbox"
          />
          Per E-Mail einladen (Nutzer legt eigenes Passwort fest)
        </label>
      ) : null}

      {inviteViaEmail ? (
        <p className="text-sm font-semibold text-blue-800 md:col-span-2">
          Es wird kein Startpasswort vergeben - der Nutzer erhält eine E-Mail
          mit einem Link, um selbst ein Passwort festzulegen.
        </p>
      ) : (
        <label className="text-sm font-bold">
          Startpasswort
          <input
            className={inputClass}
            minLength={10}
            name="password"
            required
            type="password"
          />
        </label>
      )}

      <p className="text-sm font-semibold text-gray-700 md:col-span-2">
        Der Benutzername entsteht automatisch aus Nachname und den ersten drei
        Buchstaben des Vornamens.
      </p>
      <button className="w-fit rounded-xl bg-gray-950 px-4 py-2.5 font-bold text-white">
        Konto anlegen
      </button>
    </form>
  );
}
