"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ensureDriverForEmployee,
  normalizePrimaryAssignmentForDriver,
} from "@/lib/driver-vehicle-inventory-sync";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function getPersonInput(formData: FormData) {
  return String(
    formData.get("driverPersonId") ?? formData.get("driverId") ?? "",
  ).trim();
}

function getInventoryItemInput(formData: FormData) {
  return String(
    formData.get("inventoryItemId") ?? formData.get("vehicleId") ?? "",
  ).trim();
}

async function resolveDriverForPersonInput(
  tx: Prisma.TransactionClient,
  personInput: string,
) {
  if (!personInput) {
    throw new Error("Bitte einen Mitarbeiter/Fahrer auswählen.");
  }

  if (personInput.startsWith("employee:")) {
    const employeeId = personInput.replace("employee:", "").trim();

    if (!employeeId) {
      throw new Error("Mitarbeiter-ID fehlt.");
    }

    const employee = await tx.employee.findUnique({
      where: {
        id: employeeId,
      },
    });

    if (!employee) {
      throw new Error("Mitarbeiter wurde nicht gefunden.");
    }

    return ensureDriverForEmployee(tx, employee);
  }

  const driverId = personInput.startsWith("driver:")
    ? personInput.replace("driver:", "").trim()
    : personInput;

  if (!driverId) {
    throw new Error("Fahrer-ID fehlt.");
  }

  const driver = await tx.driver.findUnique({
    where: {
      id: driverId,
    },
  });

  if (!driver) {
    throw new Error("Fahrer wurde nicht gefunden.");
  }

  return driver.id;
}

function revalidateDriverVehicleConsumers() {
  revalidatePath("/admin/driver-vehicles");
  revalidatePath("/admin/drivers");
  revalidatePath("/admin/employees");
  revalidatePath("/employees");
  revalidatePath("/inventory");
  revalidatePath("/inventory/storage");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/truck-dispatch/short-haul");
}

function getReturnTo(formData: FormData) {
  const returnTo = String(formData.get("returnTo") ?? "").trim();

  if (!returnTo.startsWith("/admin/driver-vehicles")) {
    return null;
  }

  return returnTo;
}

function finishDriverVehicleAction(formData: FormData) {
  revalidateDriverVehicleConsumers();

  const returnTo = getReturnTo(formData);

  if (returnTo) {
    redirect(returnTo);
  }
}

async function syncInventoryResponsibleFromDriverVehicleAssignment(
  tx: Prisma.TransactionClient,
  inventoryItemId: string,
  driverId: string,
) {
  const driver = await tx.driver.findUnique({
    where: {
      id: driverId,
    },
    include: {
      employee: true,
    },
  });

  if (!driver?.employee) {
    return;
  }

  await tx.inventoryItem.update({
    where: {
      id: inventoryItemId,
    },
    data: {
      responsibleEmployee: {
        connect: {
          id: driver.employee.id,
        },
      },
      responsibleType: "EMPLOYEE",
    },
  });
}

async function clearInventoryResponsibleIfUnassigned(
  tx: Prisma.TransactionClient,
  inventoryItemId: string | null,
) {
  if (!inventoryItemId) {
    return;
  }

  const [activeAssignment, inventoryItem] = await Promise.all([
    tx.driverVehicleAssignment.findFirst({
      where: {
        inventoryItemId,
        isActive: true,
      },
    }),
    tx.inventoryItem.findUnique({
      where: {
        id: inventoryItemId,
      },
      select: {
        responsibleCrewId: true,
      },
    }),
  ]);

  if (activeAssignment) {
    return;
  }

  await tx.inventoryItem.update({
    where: {
      id: inventoryItemId,
    },
    data: {
      responsibleCrew: {
        disconnect: true,
      },
      responsibleEmployee: {
        disconnect: true,
      },
      responsibleType: inventoryItem?.responsibleCrewId ? "CREW" : null,
    },
  });
}

async function resolveInventoryVehicleAssignmentInput(
  tx: Prisma.TransactionClient,
  inventoryItemId: string,
) {
  if (!inventoryItemId) {
    throw new Error("Bitte ein Inventarobjekt auswählen.");
  }

  const inventoryItem = await tx.inventoryItem.findUnique({
    where: {
      id: inventoryItemId,
    },
    include: {
      vehicle: true,
    },
  });

  if (!inventoryItem) {
    throw new Error("Inventarobjekt wurde nicht gefunden.");
  }

  if (!inventoryItem.vehicleId || !inventoryItem.vehicle) {
    throw new Error(
      "Dieses Inventarobjekt ist noch nicht als Fahrzeug/Gerät für die Disposition verknüpft.",
    );
  }

  return {
    inventoryItem,
    vehicleId: inventoryItem.vehicleId,
  };
}

export async function createDriverVehicleAssignment(formData: FormData) {
  await requireAdmin();
  const personInput = getPersonInput(formData);
  const inventoryItemId = getInventoryItemInput(formData);
  const isPrimary = formData.get("isPrimary") === "on";

  if (!inventoryItemId) {
    throw new Error("Bitte ein Inventarobjekt auswählen.");
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const driverId = await resolveDriverForPersonInput(tx, personInput);
    const inventoryAssignment = await resolveInventoryVehicleAssignmentInput(
      tx,
      inventoryItemId,
    );

    const existingAssignment = await tx.driverVehicleAssignment.findUnique({
      where: {
        driverId_vehicleId: {
          driverId,
          vehicleId: inventoryAssignment.vehicleId,
        },
      },
    });

    if (existingAssignment) {
      throw new Error("Diese Fahrer-Fahrzeug-Zuordnung existiert bereits.");
    }

    if (isPrimary) {
      await tx.driverVehicleAssignment.updateMany({
        where: {
          driverId,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const assignment = await tx.driverVehicleAssignment.create({
      data: {
        driverId,
        vehicleId: inventoryAssignment.vehicleId,
        inventoryItemId: inventoryAssignment.inventoryItem.id,
        isPrimary,
        isActive: true,
        notes: optionalString(formData.get("notes")),
      },
    });

    await normalizePrimaryAssignmentForDriver(
      tx,
      driverId,
      isPrimary ? assignment.id : undefined,
    );
    if (isPrimary) {
      await syncInventoryResponsibleFromDriverVehicleAssignment(
        tx,
        inventoryAssignment.inventoryItem.id,
        driverId,
      );
    }
  });

  finishDriverVehicleAction(formData);
}

export async function updateDriverVehicleAssignment(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const personInput = getPersonInput(formData);
  const inventoryItemId = getInventoryItemInput(formData);
  const isPrimary = formData.get("isPrimary") === "on";

  if (!id) {
    throw new Error("Zuordnungs-ID fehlt.");
  }

  if (!inventoryItemId) {
    throw new Error("Bitte ein Inventarobjekt auswählen.");
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existingAssignment = await tx.driverVehicleAssignment.findUnique({
      where: {
        id,
      },
    });

    if (!existingAssignment) {
      throw new Error("Zuordnung wurde nicht gefunden.");
    }

    const driverId = await resolveDriverForPersonInput(tx, personInput);
    const inventoryAssignment = await resolveInventoryVehicleAssignmentInput(
      tx,
      inventoryItemId,
    );

    const duplicateAssignment = await tx.driverVehicleAssignment.findUnique({
      where: {
        driverId_vehicleId: {
          driverId,
          vehicleId: inventoryAssignment.vehicleId,
        },
      },
    });

    if (duplicateAssignment && duplicateAssignment.id !== id) {
      throw new Error("Diese Fahrer-Fahrzeug-Zuordnung existiert bereits.");
    }

    if (isPrimary) {
      await tx.driverVehicleAssignment.updateMany({
        where: {
          driverId,
          NOT: {
            id,
          },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    const assignment = await tx.driverVehicleAssignment.update({
      where: {
        id,
      },
      data: {
        driverId,
        vehicleId: inventoryAssignment.vehicleId,
        inventoryItemId: inventoryAssignment.inventoryItem.id,
        isPrimary,
        notes: optionalString(formData.get("notes")),
      },
    });

    if (existingAssignment.driverId !== driverId) {
      await normalizePrimaryAssignmentForDriver(tx, existingAssignment.driverId);
    }

    if (
      existingAssignment.inventoryItemId &&
      existingAssignment.inventoryItemId !== inventoryAssignment.inventoryItem.id
    ) {
      await clearInventoryResponsibleIfUnassigned(
        tx,
        existingAssignment.inventoryItemId,
      );
    }

    await normalizePrimaryAssignmentForDriver(
      tx,
      driverId,
      isPrimary ? assignment.id : undefined,
    );
    if (isPrimary) {
      await syncInventoryResponsibleFromDriverVehicleAssignment(
        tx,
        inventoryAssignment.inventoryItem.id,
        driverId,
      );
    }
  });

  finishDriverVehicleAction(formData);
}

export async function deleteDriverVehicleAssignment(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Zuordnungs-ID fehlt.");
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const assignment = await tx.driverVehicleAssignment.findUnique({
      where: {
        id,
      },
      select: {
        driverId: true,
        inventoryItemId: true,
      },
    });

    await tx.driverVehicleAssignment.delete({
      where: {
        id,
      },
    });

    await clearInventoryResponsibleIfUnassigned(tx, assignment?.inventoryItemId ?? null);

    if (assignment?.driverId) {
      await normalizePrimaryAssignmentForDriver(tx, assignment.driverId);
    }
  });

  finishDriverVehicleAction(formData);
}

export async function normalizeDriverVehicleAssignments(formData: FormData) {
  await requireAdmin();
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const duplicateDrivers = await tx.driverVehicleAssignment.groupBy({
      by: ["driverId"],
      where: {
        isActive: true,
        isPrimary: true,
      },
      _count: {
        id: true,
      },
      having: {
        id: {
          _count: {
            gt: 1,
          },
        },
      },
    });

    for (const group of duplicateDrivers) {
      await normalizePrimaryAssignmentForDriver(tx, group.driverId);
    }
  });

  finishDriverVehicleAction(formData);
}
