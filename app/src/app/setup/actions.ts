"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function usernamePart(value: string) {
  return value
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

async function availableUsername(base: string) {
  let candidate = base;
  let suffix = 2;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function createFirstAdmin(formData: FormData) {
  if ((await prisma.user.count()) > 0) {
    throw new Error("Die Ersteinrichtung wurde bereits abgeschlossen.");
  }

  const enteredName = value(formData, "name");
  const enteredEmail = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const passwordRepeat = value(formData, "passwordRepeat");
  const employeeId = value(formData, "employeeId") || null;
  const employee = employeeId
    ? await prisma.employee.findUnique({
        select: { firstName: true, lastName: true },
        where: { id: employeeId },
      })
    : null;
  const name = employee
    ? `${employee.firstName} ${employee.lastName}`
    : enteredName;

  if (!name) throw new Error("Name ist ein Pflichtfeld.");
  const nameParts = name.split(/\s+/).filter(Boolean);
  const firstName = employee?.firstName ?? nameParts[0] ?? "";
  const lastName = employee?.lastName ?? nameParts.at(-1) ?? "";
  const usernameBase = `${usernamePart(lastName)}-${usernamePart(firstName).slice(0, 3)}`;
  if (usernameBase.length < 5) {
    throw new Error("Aus dem Namen konnte kein Benutzername erzeugt werden.");
  }
  const username = await availableUsername(usernameBase.slice(0, 40));
  if (password.length < 10) {
    throw new Error("Das Passwort muss mindestens 10 Zeichen lang sein.");
  }
  if (password !== passwordRepeat) {
    throw new Error("Die Passwörter stimmen nicht überein.");
  }

  const email = enteredEmail || `${username}@accounts.stix.invalid`;
  const result = await auth.api.createUser({
    body: {
      data: {
        displayUsername: username,
        username,
      },
      email,
      name,
      password,
      role: "admin",
    },
  });

  await prisma.user.update({
    data: {
      employeeId,
      role: "admin",
      username,
      displayUsername: username,
    },
    where: { id: result.user.id },
  });

  redirect("/login?setup=done");
}
