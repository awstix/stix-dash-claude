"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeLicensePlate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().toUpperCase();
  return text.length > 0 ? text : null;
}

function parsePayloadTons(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");

  if (!text) {
    return 0;
  }

  const number = Number(text);

  if (Number.isNaN(number) || number < 0) {
    throw new Error("Die Nutzlast muss eine Zahl größer oder gleich 0 sein.");
  }

  return Math.round(number * 100) / 100;
}

function parseWorkMaterialTankLiters(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");

  if (!text) {
    return 0;
  }

  const number = Number(text);

  if (Number.isNaN(number) || number < 0) {
    throw new Error(
      "Der Arbeitsmitteltank muss eine Zahl größer oder gleich 0 sein."
    );
  }

  return Math.round(number * 100) / 100;
}

function revalidateVehicleConsumers() {
  revalidatePath("/admin/vehicles");
  revalidatePath("/asphalt-dispatch");
  revalidatePath("/truck-dispatch");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/truck-dispatch/long-haul");
  revalidatePath("/special-vehicle-dispatch");
  revalidatePath("/orders");
}

export async function createVehicle(formData: FormData) {
  const vehicleNumber = String(formData.get("vehicleNumber") ?? "").trim();
  const licensePlate = normalizeLicensePlate(formData.get("licensePlate"));
  const vehicleType = String(formData.get("vehicleType") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const asphaltPayloadTons = parsePayloadTons(
    formData.get("asphaltPayloadTons")
  );
  const tackCoatTankLiters = parseWorkMaterialTankLiters(
    formData.get("tackCoatTankLiters")
  );

  if (!vehicleNumber || !vehicleType || !category) {
    throw new Error(
      "Fahrzeugnummer, Fahrzeugtyp und Kategorie sind Pflichtfelder."
    );
  }

  const existingVehicleNumber = await prisma.vehicle.findUnique({
    where: {
      vehicleNumber,
    },
  });

  if (existingVehicleNumber) {
    throw new Error(`Die Fahrzeugnummer "${vehicleNumber}" ist bereits vergeben.`);
  }

  if (licensePlate) {
    const existingLicensePlate = await prisma.vehicle.findUnique({
      where: {
        licensePlate,
      },
    });

    if (existingLicensePlate) {
      throw new Error(`Das Kennzeichen "${licensePlate}" ist bereits vergeben.`);
    }
  }

  await prisma.vehicle.create({
    data: {
      vehicleNumber,
      licensePlate,
      vehicleType,
      category,
      asphaltPayloadTons,
      tackCoatTankLiters,
      isSpecialVehicle: formData.get("isSpecialVehicle") === "on",
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidateVehicleConsumers();
}

export async function updateVehicle(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const vehicleNumber = String(formData.get("vehicleNumber") ?? "").trim();
  const licensePlate = normalizeLicensePlate(formData.get("licensePlate"));
  const vehicleType = String(formData.get("vehicleType") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const asphaltPayloadTons = parsePayloadTons(
    formData.get("asphaltPayloadTons")
  );
  const tackCoatTankLiters = parseWorkMaterialTankLiters(
    formData.get("tackCoatTankLiters")
  );

  if (!id) {
    throw new Error("Fahrzeug-ID fehlt.");
  }

  if (!vehicleNumber || !vehicleType || !category) {
    throw new Error(
      "Fahrzeugnummer, Fahrzeugtyp und Kategorie sind Pflichtfelder."
    );
  }

  const existingVehicleNumber = await prisma.vehicle.findUnique({
    where: {
      vehicleNumber,
    },
  });

  if (existingVehicleNumber && existingVehicleNumber.id !== id) {
    throw new Error(`Die Fahrzeugnummer "${vehicleNumber}" ist bereits vergeben.`);
  }

  if (licensePlate) {
    const existingLicensePlate = await prisma.vehicle.findUnique({
      where: {
        licensePlate,
      },
    });

    if (existingLicensePlate && existingLicensePlate.id !== id) {
      throw new Error(`Das Kennzeichen "${licensePlate}" ist bereits vergeben.`);
    }
  }

  await prisma.vehicle.update({
    where: {
      id,
    },
    data: {
      vehicleNumber,
      licensePlate,
      vehicleType,
      category,
      asphaltPayloadTons,
      tackCoatTankLiters,
      isSpecialVehicle: formData.get("isSpecialVehicle") === "on",
      isActive: formData.get("isActive") === "on",
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidateVehicleConsumers();
}

export async function deleteVehicle(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  if (!id) {
    throw new Error("Fahrzeug-ID fehlt.");
  }

  await prisma.vehicle.delete({
    where: {
      id,
    },
  });

  revalidateVehicleConsumers();
}
