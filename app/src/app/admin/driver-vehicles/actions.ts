"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function getPersonInput(formData: FormData) {
  return String(
    formData.get("driverPersonId") ?? formData.get("driverId") ?? "",
  ).trim();
}

async function resolveDriverForPersonInput(tx: any, personInput: string) {
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
          "Automatisch aus Fahrer-Fahrzeug-Zuordnung im Adminbereich erstellt.",
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
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/truck-dispatch/short-haul");
}

export async function createDriverVehicleAssignment(formData: FormData) {
  const personInput = getPersonInput(formData);
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const isPrimary = formData.get("isPrimary") === "on";

  if (!vehicleId) {
    throw new Error("Bitte ein Fahrzeug auswählen.");
  }

  await prisma.$transaction(async (tx) => {
    const driverId = await resolveDriverForPersonInput(tx, personInput);

    const vehicle = await tx.vehicle.findUnique({
      where: {
        id: vehicleId,
      },
    });

    if (!vehicle) {
      throw new Error("Fahrzeug wurde nicht gefunden.");
    }

    const existingAssignment = await tx.driverVehicleAssignment.findUnique({
      where: {
        driverId_vehicleId: {
          driverId,
          vehicleId,
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

    await tx.driverVehicleAssignment.create({
      data: {
        driverId,
        vehicleId,
        isPrimary,
        isActive: true,
        notes: optionalString(formData.get("notes")),
      },
    });
  });

  revalidateDriverVehicleConsumers();
}

export async function updateDriverVehicleAssignment(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const personInput = getPersonInput(formData);
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const isPrimary = formData.get("isPrimary") === "on";
  const isActive = formData.get("isActive") === "on";

  if (!id) {
    throw new Error("Zuordnungs-ID fehlt.");
  }

  if (!vehicleId) {
    throw new Error("Bitte ein Fahrzeug auswählen.");
  }

  await prisma.$transaction(async (tx) => {
    const existingAssignment = await tx.driverVehicleAssignment.findUnique({
      where: {
        id,
      },
    });

    if (!existingAssignment) {
      throw new Error("Zuordnung wurde nicht gefunden.");
    }

    const driverId = await resolveDriverForPersonInput(tx, personInput);

    const vehicle = await tx.vehicle.findUnique({
      where: {
        id: vehicleId,
      },
    });

    if (!vehicle) {
      throw new Error("Fahrzeug wurde nicht gefunden.");
    }

    const duplicateAssignment = await tx.driverVehicleAssignment.findUnique({
      where: {
        driverId_vehicleId: {
          driverId,
          vehicleId,
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

    await tx.driverVehicleAssignment.update({
      where: {
        id,
      },
      data: {
        driverId,
        vehicleId,
        isPrimary,
        isActive,
        notes: optionalString(formData.get("notes")),
      },
    });
  });

  revalidateDriverVehicleConsumers();
}

export async function deleteDriverVehicleAssignment(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Zuordnungs-ID fehlt.");
  }

  await prisma.driverVehicleAssignment.delete({
    where: {
      id,
    },
  });

  revalidateDriverVehicleConsumers();
}
