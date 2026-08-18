import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Every InventoryItem whose category is flagged for truck-dispatch
 * selection needs a linked `Vehicle` row - the whole
 * Inventory-Verantwortlicher <-> Fahrer-Fahrzeug-Zuordnung <-> LKW-Dispo
 * sync chain is keyed off `InventoryItem.vehicleId`, which nothing else
 * ever sets. Call this before syncDriverVehicleAssignmentForInventoryItem
 * so that chain actually has something to work with. */
export async function ensureVehicleForInventoryItem(
  tx: Prisma.TransactionClient,
  itemId: string,
) {
  const item = await tx.inventoryItem.findUnique({
    where: {
      id: itemId,
    },
    include: {
      category: {
        include: {
          parentCategory: true,
        },
      },
    },
  });

  if (!item || item.status === "DELETED" || !item.objectNumber) {
    return;
  }

  // All three flags need a synced Vehicle row - LKW-Dispo/Fahrer-Zuordnung
  // via useInTruckDispatchSelection, Gerätedisposition via
  // useInEquipmentDispatch, Kolonnen/Teams-Verwaltung (Geräte/Mitarbeiter
  // zuweisen) via useInTeamManagement. Which of these is set determines
  // whether the item is ALSO eligible for driver-assignment sync, checked
  // separately in syncDriverVehicleAssignmentForInventoryItem below.
  const allowsVehicleSync = Boolean(
    item.category?.useInTruckDispatchSelection ||
      item.category?.parentCategory?.useInTruckDispatchSelection ||
      item.category?.useInEquipmentDispatch ||
      item.category?.parentCategory?.useInEquipmentDispatch ||
      item.category?.useInTeamManagement ||
      item.category?.parentCategory?.useInTeamManagement,
  );

  if (!allowsVehicleSync) {
    return;
  }

  const isSpecialVehicle = Boolean(
    item.category?.useInSpecialVehicleDisposition ||
      item.category?.parentCategory?.useInSpecialVehicleDisposition,
  );
  const categoryName = item.category?.name ?? "Fahrzeug";
  const vehicleType = item.model || item.manufacturer || categoryName;
  const dailyReportMachineLabel =
    item.category?.dailyReportMachineLabel ??
    item.category?.parentCategory?.dailyReportMachineLabel ??
    null;
  const asphaltPayloadTons = item.payloadKg ? item.payloadKg / 1000 : 0;
  const tackCoatTankLiters = item.workMaterialTankLiters ?? 0;
  const isActive = item.status !== "INACTIVE";

  // licensePlate is unique on Vehicle - guard against two inventory items
  // sharing one (a real data issue, not something this sync should crash
  // on) by only carrying it over when no other vehicle already claims it.
  let licensePlate = item.licensePlate || null;
  if (licensePlate) {
    const conflict = await tx.vehicle.findFirst({
      where: {
        licensePlate,
        NOT: { vehicleNumber: item.objectNumber },
      },
      select: { id: true },
    });
    if (conflict) {
      licensePlate = null;
    }
  }

  const vehicle = await tx.vehicle.upsert({
    where: {
      vehicleNumber: item.objectNumber,
    },
    create: {
      vehicleNumber: item.objectNumber,
      licensePlate,
      vehicleType,
      category: categoryName,
      isSpecialVehicle,
      isActive,
      dailyReportMachineLabel,
      asphaltPayloadTons,
      tackCoatTankLiters,
      notes: "Automatisch aus Inventarobjekt erstellt.",
    },
    update: {
      licensePlate,
      vehicleType,
      category: categoryName,
      isSpecialVehicle,
      isActive,
      dailyReportMachineLabel,
      asphaltPayloadTons,
      tackCoatTankLiters,
    },
  });

  if (item.vehicleId !== vehicle.id) {
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { vehicleId: vehicle.id },
    });
  }
}

export async function ensureDriverForEmployee(
  tx: Prisma.TransactionClient,
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    mobilePhone: string | null;
    statusValue: string;
    driverId: string | null;
  },
) {
  if (employee.driverId) {
    await tx.driver.update({
      where: {
        id: employee.driverId,
      },
      data: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        phone: employee.mobilePhone,
        isActive: employee.statusValue === "active",
      },
    });

    return employee.driverId;
  }

  const driver = await tx.driver.create({
    data: {
      firstName: employee.firstName,
      lastName: employee.lastName,
      phone: employee.mobilePhone,
      isActive: employee.statusValue === "active",
      notes:
        "Automatisch aus Inventar-Verantwortlichem in der Fahrer-Fahrzeug-Zuordnung erstellt.",
    },
  });

  await tx.employee.update({
    where: {
      id: employee.id,
    },
    data: {
      driverId: driver.id,
    },
  });

  return driver.id;
}

export async function normalizePrimaryAssignmentForDriver(
  tx: Prisma.TransactionClient,
  driverId: string,
  preferredAssignmentId?: string,
) {
  const assignments = await tx.driverVehicleAssignment.findMany({
    where: {
      driverId,
      isActive: true,
    },
    orderBy: [
      { isPrimary: "desc" },
      { updatedAt: "desc" },
      { createdAt: "asc" },
    ],
  });

  if (assignments.length <= 1) {
    return;
  }

  const preferredAssignment = preferredAssignmentId
    ? assignments.find((assignment) => assignment.id === preferredAssignmentId)
    : null;
  const primaryAssignments = assignments.filter(
    (assignment) => assignment.isPrimary,
  );

  if (!preferredAssignment && primaryAssignments.length <= 1) {
    return;
  }

  const primaryAssignment =
    preferredAssignment ?? primaryAssignments[0] ?? assignments[0];

  await tx.driverVehicleAssignment.updateMany({
    where: {
      driverId,
      isActive: true,
      NOT: {
        id: primaryAssignment.id,
      },
    },
    data: {
      isPrimary: false,
    },
  });

  if (!primaryAssignment.isPrimary) {
    await tx.driverVehicleAssignment.update({
      where: {
        id: primaryAssignment.id,
      },
      data: {
        isPrimary: true,
      },
    });
  }
}

export async function syncDriverVehicleAssignmentForInventoryItem(
  tx: Prisma.TransactionClient,
  itemId: string,
) {
  const item = await tx.inventoryItem.findUnique({
    where: {
      id: itemId,
    },
    include: {
      category: {
        include: {
          parentCategory: true,
        },
      },
      responsibleEmployee: true,
    },
  });

  if (!item?.vehicleId) {
    return;
  }

  // Deliberately narrower than ensureVehicleForInventoryItem's vehicle-sync
  // gate: a Vehicle row can now also exist purely for Gerätedisposition
  // (useInEquipmentDispatch), and those items must NOT turn into driver
  // assignments in LKW-Dispo / Fahrer-Fahrzeug-Zuordnung.
  const allowsTruckDispatchSelection = Boolean(
    item.category?.useInTruckDispatchSelection ||
      item.category?.parentCategory?.useInTruckDispatchSelection,
  );

  if (!allowsTruckDispatchSelection) {
    return;
  }

  const existingAssignments = await tx.driverVehicleAssignment.findMany({
    where: {
      inventoryItemId: item.id,
      isActive: true,
    },
  });

  if (
    item.status === "DELETED" ||
    item.responsibleType !== "EMPLOYEE" ||
    !item.responsibleEmployee
  ) {
    for (const assignment of existingAssignments) {
      await tx.driverVehicleAssignment.delete({
        where: {
          id: assignment.id,
        },
      });
    }

    for (const assignment of existingAssignments) {
      await normalizePrimaryAssignmentForDriver(tx, assignment.driverId);
    }

    return;
  }

  const driverId = await ensureDriverForEmployee(tx, item.responsibleEmployee);
  const existingForItem = existingAssignments[0] ?? null;
  const existingForVehicle = existingForItem
    ? null
    : await tx.driverVehicleAssignment.findFirst({
        where: {
          vehicleId: item.vehicleId,
          isActive: true,
        },
      });
  const existingAssignment = existingForItem ?? existingForVehicle;
  const hasPrimaryAssignment = await tx.driverVehicleAssignment.findFirst({
    where: {
      driverId,
      isActive: true,
      isPrimary: true,
      NOT: {
        id: existingAssignment?.id ?? "",
      },
    },
  });
  const shouldBePrimary =
    existingAssignment?.isPrimary ?? !hasPrimaryAssignment;

  if (existingAssignment) {
    await tx.driverVehicleAssignment.update({
      where: {
        id: existingAssignment.id,
      },
      data: {
        driverId,
        inventoryItemId: item.id,
        isPrimary: shouldBePrimary,
        vehicleId: item.vehicleId,
      },
    });
  } else {
    await tx.driverVehicleAssignment.create({
      data: {
        driverId,
        inventoryItemId: item.id,
        isActive: true,
        isPrimary: shouldBePrimary,
        notes: "Automatisch aus Inventar-Verantwortlichem übernommen.",
        vehicleId: item.vehicleId,
      },
    });
  }

  await normalizePrimaryAssignmentForDriver(tx, driverId);
}

/** Lazy backfill, same pattern as syncDriversFromEmployees() on
 * /admin/drivers: runs on every /admin/driver-vehicles page load so
 * inventory items that predate this sync (or were touched by a script)
 * still end up with a linked Vehicle and, where applicable, a
 * DriverVehicleAssignment. One transaction per item, not one giant
 * transaction, to avoid the timeout issues bulk operations hit earlier. */
export async function syncVehiclesFromInventory() {
  const items = await prisma.inventoryItem.findMany({
    where: {
      status: { not: "DELETED" },
      objectNumber: { not: null },
      OR: [
        { category: { useInTruckDispatchSelection: true } },
        {
          category: {
            parentCategory: { useInTruckDispatchSelection: true },
          },
        },
        { category: { useInEquipmentDispatch: true } },
        {
          category: {
            parentCategory: { useInEquipmentDispatch: true },
          },
        },
        { category: { useInTeamManagement: true } },
        {
          category: {
            parentCategory: { useInTeamManagement: true },
          },
        },
      ],
    },
    select: { id: true },
  });

  for (const item of items) {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await ensureVehicleForInventoryItem(tx, item.id);
      await syncDriverVehicleAssignmentForInventoryItem(tx, item.id);
    });
  }

  return items.length;
}
