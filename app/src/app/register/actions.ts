"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type RegistrationState = {
  error?: string;
  success?: string;
  username?: string;
};

function text(formData: FormData, name: string) {
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

async function availableUsername(firstName: string, lastName: string) {
  const base = `${usernamePart(lastName)}-${usernamePart(firstName).slice(0, 3)}`.slice(0, 40);
  let candidate = base;
  let suffix = 2;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function registerPortalUser(
  _state: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const birthDate = text(formData, "birthDate");
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordRepeat = String(formData.get("passwordRepeat") ?? "");

  if (!birthDate) {
    return { error: "Das Geburtsdatum ist erforderlich." };
  }
  if (!email || !email.includes("@")) {
    return { error: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }
  if (password.length < 10) {
    return { error: "Das Passwort muss mindestens 10 Zeichen lang sein." };
  }
  if (password !== passwordRepeat) {
    return { error: "Die beiden Passwörter stimmen nicht überein." };
  }

  const start = new Date(`${birthDate}T00:00:00.000Z`);
  const end = new Date(`${birthDate}T23:59:59.999Z`);
  const matches = await prisma.employee.findMany({
    where: {
      birthDate: { gte: start, lte: end },
      statusValue: "active",
    },
  });
  if (matches.length === 0) {
    return {
      error:
        "Das Geburtsdatum konnte keinem aktiven Mitarbeiter zugeordnet werden.",
    };
  }
  if (matches.length > 1) {
    return {
      error:
        "Dieses Geburtsdatum ist mehrfach vorhanden. Bitte einen Administrator kontaktieren.",
    };
  }
  const employee = matches[0];
  if (await prisma.user.findUnique({ where: { employeeId: employee.id } })) {
    return { error: "Für diesen Mitarbeiter besteht bereits ein Portalkonto." };
  }

  const username = await availableUsername(employee.firstName, employee.lastName);
  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "Diese E-Mail-Adresse wird bereits für ein Konto verwendet." };
  }

  try {
    const result = await auth.api.createUser({
      body: {
        data: { displayUsername: username, username },
        email,
        name: `${employee.firstName} ${employee.lastName}`,
        password,
        role: "user",
      },
    });
    await prisma.user.update({
      data: {
        banReason: "REGISTRATION_PENDING",
        banned: true,
        displayUsername: username,
        employeeId: employee.id,
        role: "employee",
        username,
      },
      where: { id: result.user.id },
    });
    if (!employee.email) {
      await prisma.employee.update({
        data: { email },
        where: { id: employee.id },
      });
    }
    return {
      success:
        "Konto wurde angelegt und wartet auf die Freigabe durch einen Administrator.",
      username,
    };
  } catch {
    return { error: "Das Konto konnte nicht angelegt werden. Bitte erneut versuchen." };
  }
}
