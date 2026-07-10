import type { Prisma } from "@prisma/client";

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
      responsibleEmployee: true,
    },
  });

  if (!item?.vehicleId) {
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
