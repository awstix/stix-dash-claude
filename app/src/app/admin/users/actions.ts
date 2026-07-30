"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { portalRoleKeys } from "@/lib/portal-roles";

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
  const password = text(formData, "password");
  const roles = formData
    .getAll("role")
    .map(String)
    .filter((role) => portalRoleKeys.has(role));
  const role = roles.length ? roles.join(",") : "employee";
  const canApproveLeaveRequests =
    formData.get("canApproveLeaveRequests") === "on";
  if (password.length < 10) {
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
  const email = realEmail || `${username}@accounts.stix.invalid`;
  const result = await auth.api.createUser({
    body: {
      data: { displayUsername: username, username },
      email,
      name: `${employee.firstName} ${employee.lastName}`,
      password,
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
