"use server";

import { revalidatePath } from "next/cache";
import { inventoryCategoryAllowsAssignment } from "@/lib/inventory-assignment-policy";
import { prisma } from "@/lib/prisma";

const SORT_ORDER_STEP = 5;

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeSortOrder(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.ceil(value / SORT_ORDER_STEP) * SORT_ORDER_STEP);
}

function parseSortOrder(value: FormDataEntryValue | null, fallback = 0) {
  const text = String(value ?? "").trim();

  if (!text) {
    return fallback;
  }

  const number = Number(text);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return normalizeSortOrder(number);
}

async function getNextCrewSortOrder() {
  const result = await prisma.crew.aggregate({
    _max: {
      sortOrder: true,
    },
  });

  return normalizeSortOrder(result._max.sortOrder ?? 0) + SORT_ORDER_STEP;
}

async function getNextCrewMemberSortOrder(crewId: string) {
  const result = await prisma.crewMember.aggregate({
    where: {
      crewId,
    },
    _max: {
      sortOrder: true,
    },
  });

  return normalizeSortOrder(result._max.sortOrder ?? 0) + SORT_ORDER_STEP;
}

async function getNextCrewDefaultVehicleSortOrder(crewId: string) {
  const result = await prisma.crewDefaultVehicle.aggregate({
    where: {
      crewId,
    },
    _max: {
      sortOrder: true,
    },
  });

  return normalizeSortOrder(result._max.sortOrder ?? 0) + SORT_ORDER_STEP;
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
  const fallbackSortOrder = await getNextCrewSortOrder();

  await prisma.crew.create({
    data: {
      name,
      typeValue,
      typeLabel,
      colorClass: optionalString(formData.get("colorClass")),
      notes: optionalString(formData.get("notes")),
      sortOrder: parseSortOrder(formData.get("sortOrder"), fallbackSortOrder),
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
  const fallbackSortOrder = await getNextCrewMemberSortOrder(crewId);
  const sortOrder = parseSortOrder(formData.get("sortOrder"), fallbackSortOrder);

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
      sortOrder,
    },
    create: {
      crewId,
      employeeId,
      roleText,
      sortOrder,
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

  const inventoryItem = await prisma.inventoryItem.findFirst({
    where: {
      vehicleId,
    },
    select: {
      category: {
        select: {
          name: true,
          useInTeamManagement: true,
          parentCategory: {
            select: {
              name: true,
              useInTeamManagement: true,
            },
          },
        },
      },
    },
  });

  if (
    !inventoryCategoryAllowsAssignment(inventoryItem?.category)
  ) {
    throw new Error(
      "Dieses Gerät/Fahrzeug ist für eine Teamzuordnung nicht freigegeben."
    );
  }

  const [existingAssignment, existingInventoryAssignment] = await Promise.all([
    prisma.crewDefaultVehicle.findFirst({
      where: {
        vehicleId,
        crewId: {
          not: crewId,
        },
        isActive: true,
        crew: {
          isActive: true,
        },
      },
      select: {
        crew: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.inventoryItem.findFirst({
      where: {
        vehicleId,
        responsibleCrewId: {
          not: crewId,
        },
        responsibleCrew: {
          isActive: true,
        },
      },
      select: {
        responsibleCrew: {
          select: {
            name: true,
          },
        },
      },
    }),
  ]);

  const existingCrewName =
    existingAssignment?.crew.name ??
    existingInventoryAssignment?.responsibleCrew?.name;

  if (existingCrewName) {
    throw new Error(
      `Gerät/Fahrzeug ist bereits in Kolonne ${existingCrewName} vergeben.`
    );
  }

  const fallbackSortOrder = await getNextCrewDefaultVehicleSortOrder(crewId);
  const sortOrder = parseSortOrder(formData.get("sortOrder"), fallbackSortOrder);

  await prisma.$transaction(async (tx) => {
    await tx.crewDefaultVehicle.upsert({
      where: {
        crewId_vehicleId: {
          crewId,
          vehicleId,
        },
      },
      update: {
        isActive: true,
        notes: optionalString(formData.get("notes")),
        sortOrder,
      },
      create: {
        crewId,
        vehicleId,
        notes: optionalString(formData.get("notes")),
        sortOrder,
        isActive: true,
      },
    });

    await tx.inventoryItem.updateMany({
      where: {
        vehicleId,
      },
      data: {
        responsibleCrewId: crewId,
        responsibleEmployeeId: null,
        responsibleType: "CREW",
      },
    });
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

  await prisma.$transaction(async (tx) => {
    const assignment = await tx.crewDefaultVehicle.findUnique({
      where: {
        id,
      },
      select: {
        crewId: true,
        vehicleId: true,
      },
    });

    if (!assignment) {
      throw new Error("Gerätezuordnung wurde nicht gefunden.");
    }

    await tx.crewDefaultVehicle.delete({
      where: {
        id,
      },
    });

    await tx.inventoryItem.updateMany({
      where: {
        vehicleId: assignment.vehicleId,
        responsibleCrewId: assignment.crewId,
      },
      data: {
        responsibleCrewId: null,
        responsibleType: null,
      },
    });
  });

  revalidatePath("/admin/crews");
  revalidatePath("/crew-dispatch");
  revalidatePath("/asphalt-dispatch");
}
