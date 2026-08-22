"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { getPortalRoleKeys } from "@/lib/portal-roles";
import { isEmailConfigured, getEmailSettings } from "@/lib/mailer";
import { syncUserProjectAccessForEmployee } from "@/lib/project-access-sync";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function part(value: string) {
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

async function usernameFor(firstName: string, lastName: string) {
  const base = `${part(lastName)}-${part(firstName).slice(0, 3)}`.slice(0, 40);
  let username = base;
  let suffix = 2;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${base}${suffix}`;
    suffix += 1;
  }
  return username;
}

export async function createPortalUser(formData: FormData) {
  await requireAdmin();
  const employeeId = text(formData, "employeeId");
  const inviteViaEmail = formData.get("inviteViaEmail") === "on";
  const password = text(formData, "password");
  const validRoleKeys = await getPortalRoleKeys();
  const roles = formData
    .getAll("role")
    .map(String)
    .filter((role) => validRoleKeys.has(role));
  const role = roles.length ? roles.join(",") : "employee";
  const canApproveLeaveRequests =
    formData.get("canApproveLeaveRequests") === "on";
  if (!inviteViaEmail && password.length < 10) {
    throw new Error("Das Startpasswort muss mindestens 10 Zeichen lang sein.");
  }
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });
  if (!employee) throw new Error("Mitarbeiter wurde nicht gefunden.");
  if (await prisma.user.findUnique({ where: { employeeId } })) {
    throw new Error("Für diesen Mitarbeiter besteht bereits ein Portalkonto.");
  }
  const username = await usernameFor(employee.firstName, employee.lastName);
  const realEmail = text(formData, "email").toLowerCase() || employee.email?.toLowerCase() || "";

  if (inviteViaEmail) {
    if (!realEmail) {
      throw new Error(
        "Für eine Einladung per E-Mail wird eine echte E-Mail-Adresse benötigt.",
      );
    }
    if (!isEmailConfigured(await getEmailSettings())) {
      throw new Error(
        "E-Mail-Versand ist nicht konfiguriert. Bitte zuerst unter Admin > E-Mail-Versand einrichten.",
      );
    }
  }

  const email = realEmail || `${username}@accounts.stix.invalid`;
  // Wird nie angezeigt oder mitgeteilt - der Nutzer setzt sein eigenes
  // Passwort über den Einladungslink, bevor er sich je damit anmeldet.
  const startPassword = inviteViaEmail
    ? randomBytes(24).toString("base64url")
    : password;
  const result = await auth.api.createUser({
    body: {
      data: { displayUsername: username, username },
      email,
      name: `${employee.firstName} ${employee.lastName}`,
      password: startPassword,
      role: roles.includes("admin") ? "admin" : "user",
    },
  });
  await prisma.user.update({
    data: {
      canApproveLeaveRequests,
      displayUsername: username,
      employeeId,
      role,
      username,
    },
    where: { id: result.user.id },
  });
  await prisma.$transaction((tx) =>
    syncUserProjectAccessForEmployee(tx, employeeId),
  );

  if (inviteViaEmail) {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${process.env.BETTER_AUTH_URL}/reset-password`,
      },
    });
  } else if (realEmail) {
    // Kein Einladungs-Link nötig (Admin setzt das Startpasswort direkt) -
    // trotzdem die E-Mail-Adresse bestätigen lassen, falls eine echte
    // hinterlegt wurde. Der Reset-Link-Klick beim Einladungs-Pfad oben zählt
    // dagegen bereits selbst als ausreichender Nachweis, keine Doppel-Mail.
    try {
      await auth.api.sendVerificationEmail({
        body: { callbackURL: "/login", email: realEmail },
      });
    } catch {
      // Siehe Kommentar bei requireEmailVerification in auth.ts.
    }
  }
  revalidatePath("/admin/users");
}

export async function updateLeaveApprovalPermission(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  await prisma.user.update({
    data: {
      canApproveLeaveRequests:
        formData.get("canApproveLeaveRequests") === "on",
    },
    where: { id },
  });
  revalidatePath("/admin/users");
}

export async function approvePortalUser(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  await prisma.user.update({
    data: {
      banReason: null,
      banned: false,
    },
    where: { id },
  });
  revalidatePath("/admin/users");
}
