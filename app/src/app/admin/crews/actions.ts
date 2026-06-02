"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function parseSortOrder(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "").trim());

  if (Number.isNaN(number)) {
    return 0;
  }

  return number;
}

async function getAdminOptionLabel(groupKey: string, value: string | null) {
  if (!value) {
    return null;
  }

  const option = await prisma.adminOption.findFirst({
    where: {
      groupKey,
      value,
    },
  });

  return option?.label ?? value;
}

async function buildCrewMemberRoleText(formData: FormData) {
  const rolePositionValue = optionalString(formData.get("rolePositionValue"));
  const roleTextExtra = optionalString(formData.get("roleTextExtra"));

  const rolePositionLabel = await getAdminOptionLabel(
    "employee_position",
    rolePositionValue
  );

  if (rolePositionLabel && roleTextExtra) {
    return `${rolePositionLabel} · ${roleTextExtra}`;
  }

  return rolePositionLabel ?? roleTextExtra;
}

export async function createCrew(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Kolonnenname fehlt.");
  }

  const typeValue = optionalString(formData.get("typeValue"));
  const typeLabel = await getAdminOptionLabel("crew_type", typeValue);

  await prisma.crew.create({
    data: {
      name,
      typeValue,
      typeLabel,
      colorClass: optionalString(formData.get("colorClass")),
      notes: optionalString(formData.get("notes")),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      isActive: formData.get("isActive") === "on",
      isAsphaltDispatchCrew: formData.get("isAsphaltDispatchCrew") === "on",
    },
  });

  revalidatePath("/admin/crews");
  revalidatePath("/crew-dispatch");
  revalidatePath("/asphalt-dispatch");
}

export async function updateCrew(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!id) {
    throw new Error("Kolonnen-ID fehlt.");
  }

  if (!name) {
    throw new Error("Kolonnenname fehlt.");
  }

  const typeValue = optionalString(formData.get("typeValue"));
  const typeLabel = await getAdminOptionLabel("crew_type", typeValue);

  await prisma.crew.update({
    where: {
      id,
    },
    data: {
      name,
      typeValue,
      typeLabel,
      colorClass: optionalString(formData.get("colorClass")),
      notes: optionalString(formData.get("notes")),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      isActive: formData.get("isActive") === "on",
      isAsphaltDispatchCrew: formData.get("isAsphaltDispatchCrew") === "on",
    },
  });

  revalidatePath("/admin/crews");
  revalidatePath("/crew-dispatch");
  revalidatePath("/asphalt-dispatch");
}

export async function deleteCrew(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Kolonnen-ID fehlt.");
  }

  await prisma.crew.delete({
    where: {
      id,
    },
  });

  revalidatePath("/admin/crews");
  revalidatePath("/crew-dispatch");
  revalidatePath("/asphalt-dispatch");
}

export async function addCrewMember(formData: FormData) {
  const crewId = String(formData.get("crewId") ?? "").trim();
  const employeeId = String(formData.get("employeeId") ?? "").trim();

  if (!crewId) {
    throw new Error("Kolonnen-ID fehlt.");
  }

  if (!employeeId) {
    throw new Error("Mitarbeiter fehlt.");
  }

  const roleText = await buildCrewMemberRoleText(formData);

  await prisma.crewMember.upsert({
    where: {
      crewId_employeeId: {
        crewId,
        employeeId,
      },
    },
    update: {
      isActive: true,
      roleText,
      sortOrder: parseSortOrder(formData.get("sortOrder")),
    },
    create: {
      crewId,
      employeeId,
      roleText,
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      isActive: true,
    },
  });

  revalidatePath("/admin/crews");
  revalidatePath("/crew-dispatch");
  revalidatePath("/asphalt-dispatch");
}

export async function removeCrewMember(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Mitglied-ID fehlt.");
  }

  await prisma.crewMember.delete({
    where: {
      id,
    },
  });

  revalidatePath("/admin/crews");
  revalidatePath("/crew-dispatch");
  revalidatePath("/asphalt-dispatch");
}

export async function addCrewDefaultVehicle(formData: FormData) {
  const crewId = String(formData.get("crewId") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();

  if (!crewId) {
    throw new Error("Kolonnen-ID fehlt.");
  }

  if (!vehicleId) {
    throw new Error("Gerät/Fahrzeug fehlt.");
  }

  await prisma.crewDefaultVehicle.upsert({
    where: {
      crewId_vehicleId: {
        crewId,
        vehicleId,
      },
    },
    update: {
      isActive: true,
      notes: optionalString(formData.get("notes")),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
    },
    create: {
      crewId,
      vehicleId,
      notes: optionalString(formData.get("notes")),
      sortOrder: parseSortOrder(formData.get("sortOrder")),
      isActive: true,
    },
  });

  revalidatePath("/admin/crews");
  revalidatePath("/crew-dispatch");
  revalidatePath("/asphalt-dispatch");
}

export async function removeCrewDefaultVehicle(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Gerätezuordnung-ID fehlt.");
  }

  await prisma.crewDefaultVehicle.delete({
    where: {
      id,
    },
  });

  revalidatePath("/admin/crews");
  revalidatePath("/crew-dispatch");
  revalidatePath("/asphalt-dispatch");
}