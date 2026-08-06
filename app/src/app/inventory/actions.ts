"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { syncDriverVehicleAssignmentForInventoryItem } from "@/lib/driver-vehicle-inventory-sync";
import { inventoryCategoryAllowsAssignment } from "@/lib/inventory-assignment-policy";
import {
  formatInventoryObjectNumber,
  getNextInventoryObjectNumber,
} from "@/lib/inventory-object-numbers";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSession } from "@/lib/auth-access";
import { deleteFile, deleteFolder, putFile } from "@/lib/storage";

const STORAGE_BUCKET = "uploads";

const allowedInventoryPhotoTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function requiredString(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value);
  if (!text) throw new Error(`${label} fehlt.`);
  return text;
}

function optionalId(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  return text === "__none" ? null : text;
}

function optionalInt(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value);
  if (!text) return null;

  const number = Number.parseInt(text, 10);

  if (!Number.isInteger(number)) {
    throw new Error(`${label} muss eine ganze Zahl sein.`);
  }

  return number;
}

function optionalTonsToKilograms(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value)?.replace(",", ".");
  if (!text) return null;

  const number = Number(text);

  if (Number.isNaN(number) || number < 0) {
    throw new Error(`${label} muss eine Zahl größer oder gleich 0 sein.`);
  }

  return Math.round(number * 1000);
}

function optionalObjectNumber(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  if (!text) return null;

  if (!/^\d{1,6}$/.test(text)) {
    throw new Error("Objekt-ID muss eine Zahl mit maximal 6 Stellen sein.");
  }

  return formatInventoryObjectNumber(Number.parseInt(text, 10));
}

function optionalMoneyCents(value: FormDataEntryValue | null) {
  const text = optionalString(value)?.replace(",", ".");
  if (!text) return null;

  const number = Number(text);

  if (Number.isNaN(number) || number < 0) {
    throw new Error("Der Verrechnungssatz muss eine Zahl größer oder gleich 0 sein.");
  }

  return Math.round(number * 100);
}

function requiredDate(value: FormDataEntryValue | null, label: string) {
  const date = optionalDate(value);

  if (!date) {
    throw new Error(`${label} fehlt.`);
  }

  return date;
}

function optionalStock(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value)?.replace(",", ".");
  if (!text) return null;

  const number = Number(text);

  if (Number.isNaN(number) || number < 0) {
    throw new Error(`${label} muss eine Zahl größer oder gleich 0 sein.`);
  }

  return Math.round(number * 1000) / 1000;
}

function requiredStock(value: FormDataEntryValue | null, label: string) {
  const number = optionalStock(value, label);

  if (number === null) {
    throw new Error(`${label} fehlt.`);
  }

  return number;
}

function optionalFloat(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value)?.replace(",", ".");
  if (!text) return null;

  const number = Number(text);

  if (Number.isNaN(number) || number < 0) {
    throw new Error(`${label} muss eine Zahl größer oder gleich 0 sein.`);
  }

  return Math.round(number * 100) / 100;
}

function optionalRawFloat(value: FormDataEntryValue | null) {
  const text = optionalString(value)?.replace(",", ".");
  if (!text) return null;

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function optionalDate(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  if (!text) return null;

  const date = new Date(`${text}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Bitte ein gültiges Datum angeben.");
  }

  return date;
}

function inventoryStatus(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  return text && ["ACTIVE", "DEFECT", "IN_SERVICE", "LOCKED"].includes(text)
    ? text
    : "ACTIVE";
}

function inventoryDriveType(value: FormDataEntryValue | null) {
  const text = optionalString(value);
  return ["WHEEL", "TRACK", "WHEEL_AND_TRACK", "TRAILER", "OTHER"].includes(
    text ?? "",
  )
    ? text
    : null;
}

function getResponsibleFields(formData: FormData) {
  const requestedResponsibleType = optionalString(formData.get("responsibleType"));
  const responsibleEmployeeId = optionalId(formData.get("responsibleEmployeeId"));
  const responsibleCrewId = optionalId(formData.get("responsibleCrewId"));

  const responsibleType = responsibleEmployeeId
    ? "EMPLOYEE"
    : responsibleCrewId
      ? "CREW"
      : requestedResponsibleType === "EMPLOYEE" || requestedResponsibleType === "CREW"
        ? requestedResponsibleType
        : null;

  return {
    responsibleCrewId,
    responsibleEmployeeId,
    responsibleType: responsibleEmployeeId || responsibleCrewId ? responsibleType : null,
  };
}

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/archive");
  revalidatePath("/inventory/storage");
  revalidatePath("/admin/driver-vehicles");
  revalidatePath("/special-vehicle-dispatch");
}

async function syncDriverVehicleAssignmentForInventoryItemId(itemId: string) {
  await prisma.$transaction(async (tx) => {
    await syncDriverVehicleAssignmentForInventoryItem(tx, itemId);
  });
}

function revalidateInventoryItem(itemId?: string) {
  revalidateInventory();

  if (itemId) {
    revalidatePath(`/inventory/${itemId}`);
  }
}

function getInventoryPayload(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    throw new Error("Name ist ein Pflichtfeld.");
  }

  const isStockManaged = formData.get("isStockManaged") === "on";
  const openingStock = isStockManaged
    ? optionalStock(formData.get("openingStock"), "Anfangsbestand")
    : null;
  const constructionDate = optionalDate(formData.get("constructionDate"));

  return {
    attachmentType: optionalString(formData.get("attachmentType")),
    billingRateCents: optionalMoneyCents(formData.get("billingRate")),
    idleBillingRateCents: optionalMoneyCents(formData.get("idleBillingRate")),
    axleCount: optionalInt(formData.get("axleCount"), "Anzahl Achsen"),
    categoryId: optionalId(formData.get("categoryId")),
    constructionDate,
    constructionYear: constructionDate ? constructionDate.getUTCFullYear() : null,
    currentProjectId: optionalId(formData.get("currentProjectId")),
    currentStock: openingStock,
    driveType: inventoryDriveType(formData.get("driveType")),
    fuelTankLiters: optionalFloat(
      formData.get("fuelTankLiters"),
      "Kraftstofftank",
    ),
    grossWeightKg: optionalInt(
      formData.get("grossWeightKg"),
      "Zulässiges Gesamtgewicht",
    ),
    inventoryNumber: optionalString(formData.get("inventoryNumber")),
    objectNumber: optionalObjectNumber(formData.get("objectNumber")),
    isContainer: formData.get("isContainer") === "on",
    isStockManaged,
    deliveryNoteNumber: optionalString(formData.get("deliveryNoteNumber")),
    invoiceNumber: optionalString(formData.get("invoiceNumber")),
    licensePlate: optionalString(formData.get("licensePlate")),
    lastDguvInspectionDate: optionalDate(formData.get("lastDguvInspectionDate")),
    lastServiceAtDate: optionalDate(formData.get("lastServiceAtDate")),
    lastServiceMileageKm: optionalInt(
      formData.get("lastServiceMileageKm"),
      "Letzter Service KM",
    ),
    lastServiceOperatingHours: optionalFloat(
      formData.get("lastServiceOperatingHours"),
      "Letzter Service Betriebsstunden",
    ),
    lastTuvInspectionDate: optionalDate(formData.get("lastTuvInspectionDate")),
    lastTachographInspectionDate: optionalDate(
      formData.get("lastTachographInspectionDate"),
    ),
    lastSafetyInspectionDate: optionalDate(
      formData.get("lastSafetyInspectionDate"),
    ),
    lastAdrInspectionDate: optionalDate(
      formData.get("lastAdrInspectionDate"),
    ),
    manufacturer: optionalString(formData.get("manufacturer")),
    model: optionalString(formData.get("model")),
    name,
    nextDguvInspectionDate: optionalDate(formData.get("nextDguvInspectionDate")),
    nextServiceAtDate: optionalDate(formData.get("nextServiceAtDate")),
    nextServiceMileageKm: optionalInt(
      formData.get("nextServiceMileageKm"),
      "Nächster Service KM",
    ),
    nextServiceOperatingHours: optionalFloat(
      formData.get("nextServiceOperatingHours"),
      "Nächster Service Betriebsstunden",
    ),
    nextTuvInspectionDate: optionalDate(formData.get("nextTuvInspectionDate")),
    nextTachographInspectionDate: optionalDate(
      formData.get("nextTachographInspectionDate"),
    ),
    nextSafetyInspectionDate: optionalDate(
      formData.get("nextSafetyInspectionDate"),
    ),
    nextAdrInspectionDate: optionalDate(
      formData.get("nextAdrInspectionDate"),
    ),
    notes: optionalString(formData.get("notes")),
    openingStock,
    parentItemId: optionalId(formData.get("parentItemId")),
    payloadKg:
      optionalTonsToKilograms(formData.get("payloadTons"), "Nutzlast") ??
      optionalInt(formData.get("payloadKg"), "Nutzlast"),
    purchasedAt: optionalDate(formData.get("purchasedAt")),
    purchasedFrom: optionalString(formData.get("purchasedFrom")),
    receivedAt: optionalDate(formData.get("receivedAt")),
    serialNumber: optionalString(formData.get("serialNumber")),
    status: inventoryStatus(formData.get("status")),
    stixId: optionalString(formData.get("stixId")),
    stockUnit: optionalString(formData.get("stockUnit")) ?? "Stk.",
    workMaterialTankLiters: optionalFloat(
      formData.get("workMaterialTankLiters"),
      "Arbeitsmitteltank",
    ),
    ...getResponsibleFields(formData),
  };
}

function relationConnect(id: string | null) {
  return id
    ? {
        connect: {
          id,
        },
      }
    : undefined;
}

function relationUpdate(id: string | null) {
  return id
    ? {
        connect: {
          id,
        },
      }
    : {
        disconnect: true,
      };
}

function getInventoryCreateData(formData: FormData) {
  const {
    categoryId,
    currentProjectId,
    parentItemId,
    responsibleCrewId,
    responsibleEmployeeId,
    ...payload
  } = getInventoryPayload(formData);

  return {
    ...payload,
    category: relationConnect(categoryId),
    currentProject: relationConnect(currentProjectId),
    parentItem: relationConnect(parentItemId),
    responsibleCrew: relationConnect(responsibleCrewId),
    responsibleEmployee: relationConnect(responsibleEmployeeId),
  };
}

function getInventoryUpdateData(formData: FormData) {
  const {
    categoryId,
    currentProjectId,
    parentItemId,
    responsibleCrewId,
    responsibleEmployeeId,
    ...payload
  } = getInventoryPayload(formData);

  return {
    ...payload,
    category: relationUpdate(categoryId),
    currentProject: relationUpdate(currentProjectId),
    parentItem: relationUpdate(parentItemId),
    responsibleCrew: relationUpdate(responsibleCrewId),
    responsibleEmployee: relationUpdate(responsibleEmployeeId),
  };
}

function getInventoryContacts(formData: FormData) {
  const roles = formData.getAll("contactRole");
  const companies = formData.getAll("contactCompany");
  const salutations = formData.getAll("contactSalutation");
  const firstNames = formData.getAll("contactFirstName");
  const lastNames = formData.getAll("contactLastName");
  const phones = formData.getAll("contactPhone");
  const mobilePhones = formData.getAll("contactMobilePhone");
  const emails = formData.getAll("contactEmail");
  const websites = formData.getAll("contactWebsite");
  const notes = formData.getAll("contactNotes");

  return roles
    .map((roleValue, index) => {
      const role = optionalString(roleValue);
      const company = optionalString(companies[index] ?? null);
      const salutation = optionalString(salutations[index] ?? null);
      const firstName = optionalString(firstNames[index] ?? null);
      const lastName = optionalString(lastNames[index] ?? null);
      const phone = optionalString(phones[index] ?? null);
      const mobilePhone = optionalString(mobilePhones[index] ?? null);
      const email = optionalString(emails[index] ?? null);
      const website = optionalString(websites[index] ?? null);
      const contactNotes = optionalString(notes[index] ?? null);

      if (
        !role &&
        !company &&
        !salutation &&
        !firstName &&
        !lastName &&
        !phone &&
        !mobilePhone &&
        !email &&
        !website &&
        !contactNotes
      ) {
        return null;
      }

      return {
        company,
        email,
        firstName,
        lastName,
        mobilePhone,
        name: null,
        notes: contactNotes,
        phone,
        role: role ?? "Ansprechpartner",
        salutation,
        website,
      };
    })
    .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));
}

function getAdditionalEmployeeIds(formData: FormData) {
  const primaryEmployeeId = optionalId(formData.get("responsibleEmployeeId"));

  return Array.from(
    new Set(
      formData
        .getAll("additionalEmployeeIds")
        .map((value) => optionalId(value))
        .filter((id): id is string => Boolean(id))
        .filter((id) => id !== primaryEmployeeId),
    ),
  );
}

async function categoryAllowsInventoryAssignment(categoryId: string | null) {
  if (!categoryId) return false;

  const category = await prisma.inventoryCategory.findUnique({
    where: {
      id: categoryId,
    },
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
  });

  return inventoryCategoryAllowsAssignment(category);
}

function clearInventoryAssignmentFields(formData: FormData) {
  formData.set("responsibleType", "__none");
  formData.delete("responsibleEmployeeId");
  formData.delete("responsibleCrewId");
  formData.delete("additionalEmployeeIds");
}

function isSpecialVehicleInventoryItem(item: {
  category: {
    name: string;
  } | null;
  isStockManaged: boolean;
  manufacturer: string | null;
  model: string | null;
  name: string;
}) {
  if (item.isStockManaged) {
    return false;
  }

  const text = [
    item.category?.name,
    item.name,
    item.manufacturer,
    item.model,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");

  return [
    "sonder",
    "tieflader",
    "kehr",
    "fraese",
    "spritz",
    "traktor",
  ].some((keyword) => text.includes(keyword));
}

async function getUniqueVehicleNumber(baseValue: string, existingVehicleId?: string | null) {
  const base = baseValue.trim() || `INV-${randomUUID().slice(0, 8)}`;
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.vehicle.findUnique({
      where: {
        vehicleNumber: candidate,
      },
      select: {
        id: true,
      },
    });

    if (!existing || existing.id === existingVehicleId) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function syncVehicleLinkForInventoryItem(itemId: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: {
      id: itemId,
    },
    select: {
      category: {
        select: {
          name: true,
          parentCategory: {
            select: {
              dailyReportSection: true,
              useInDailyReports: true,
              useInSpecialVehicleDisposition: true,
              useInTeamManagement: true,
              useInTruckDispatchSelection: true,
            },
          },
          dailyReportSection: true,
          useInDailyReports: true,
          useInSpecialVehicleDisposition: true,
          useInTeamManagement: true,
          useInTruckDispatchSelection: true,
        },
      },
      id: true,
      inventoryNumber: true,
      isStockManaged: true,
      licensePlate: true,
      manufacturer: true,
      model: true,
      name: true,
      objectNumber: true,
      status: true,
      vehicleId: true,
      workMaterialTankLiters: true,
    },
  });

  if (!item) {
    return;
  }

  const categoryMarksSpecialVehicle =
    item.category?.useInSpecialVehicleDisposition ||
    item.category?.parentCategory?.useInSpecialVehicleDisposition;
  const categoryMarksVehicle =
    categoryMarksSpecialVehicle ||
    item.category?.useInTeamManagement ||
    item.category?.parentCategory?.useInTeamManagement ||
    item.category?.useInTruckDispatchSelection ||
    item.category?.parentCategory?.useInTruckDispatchSelection ||
    (item.category?.useInDailyReports &&
      item.category.dailyReportSection === "MACHINES") ||
    (item.category?.parentCategory?.useInDailyReports &&
      item.category.parentCategory.dailyReportSection === "MACHINES");

  if (!categoryMarksVehicle && !isSpecialVehicleInventoryItem(item)) {
    if (item.vehicleId) {
      await prisma.vehicle.update({
        where: {
          id: item.vehicleId,
        },
        data: {
          isActive: false,
          notes: [
            "Automatisch deaktiviert: Inventarobjekt ist nicht mehr als Fahrzeug/Gerät markiert.",
            item.name,
          ].join("\n"),
        },
      });
    }
    return;
  }

  const vehicleNumber = await getUniqueVehicleNumber(
    item.objectNumber ?? item.inventoryNumber ?? item.name,
    item.vehicleId,
  );
  const category = item.category?.name ?? "Inventarobjekt";
  const vehicleType = item.model ?? item.manufacturer ?? item.name;
  const notes = [
    `Inventarobjekt: ${item.objectNumber ?? item.inventoryNumber ?? item.name}`,
    item.name !== vehicleNumber ? item.name : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (item.vehicleId) {
    await prisma.vehicle.update({
      where: {
        id: item.vehicleId,
      },
      data: {
        category,
        isActive: item.status !== "LOCKED",
        isSpecialVehicle: Boolean(categoryMarksSpecialVehicle),
        licensePlate: item.licensePlate,
        notes,
        tackCoatTankLiters: item.workMaterialTankLiters ?? 0,
        vehicleNumber,
        vehicleType,
      },
    });
    return;
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      category,
      isActive: item.status !== "LOCKED",
      isSpecialVehicle: Boolean(categoryMarksSpecialVehicle),
      licensePlate: item.licensePlate,
      notes,
      tackCoatTankLiters: item.workMaterialTankLiters ?? 0,
      vehicleNumber,
      vehicleType,
    },
    select: {
      id: true,
    },
  });

  await prisma.inventoryItem.update({
    where: {
      id: item.id,
    },
    data: {
      vehicle: {
        connect: {
          id: vehicle.id,
        },
      },
    },
  });
}

async function syncAsphaltMaterialLinkForInventoryItem(itemId: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: {
      category: {
        select: {
          asphaltDispositionUsage: true,
          parentCategory: {
            select: {
              asphaltDispositionUsage: true,
            },
          },
        },
      },
      id: true,
      inventoryNumber: true,
      name: true,
      objectNumber: true,
      sourceId: true,
      sourceType: true,
      stockUnit: true,
    },
  });

  if (!item) return;

  const directUsage = item.category?.asphaltDispositionUsage ?? "NONE";
  const usage =
    directUsage !== "NONE"
      ? directUsage
      : item.category?.parentCategory?.asphaltDispositionUsage ?? "NONE";
  const referenceNumber =
    item.objectNumber ?? item.inventoryNumber ?? item.id.slice(-6);

  if (usage === "TACK_COAT") {
    const existing =
      item.sourceType === "MATERIAL" && item.sourceId
        ? await prisma.materialType.findUnique({
            where: { id: item.sourceId },
          })
        : await prisma.materialType.findFirst({
            where: {
              OR: [
                { materialNumber: referenceNumber },
                { category: "Anspritzmittel", name: item.name },
              ],
            },
          });
    const material = existing
      ? await prisma.materialType.update({
          where: { id: existing.id },
          data: {
            category: "Anspritzmittel",
            isActive: true,
            materialNumber: referenceNumber,
            name: item.name,
            unit: item.stockUnit || "l",
          },
        })
      : await prisma.materialType.create({
          data: {
            category: "Anspritzmittel",
            isActive: true,
            materialNumber: referenceNumber,
            name: item.name,
            unit: item.stockUnit || "l",
          },
        });

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        sourceId: material.id,
        sourceType: "MATERIAL",
      },
    });
    return;
  }

  if (usage === "ASPHALT_MIX") {
    const existing =
      item.sourceType === "ASPHALT_MIX" && item.sourceId
        ? await prisma.asphaltMixType.findUnique({
            where: { id: item.sourceId },
          })
        : await prisma.asphaltMixType.findUnique({
            where: { mixNumber: referenceNumber },
          });
    const asphaltMix = existing
      ? await prisma.asphaltMixType.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            mixNumber: referenceNumber,
            name: item.name,
            unit: item.stockUnit || "t",
          },
        })
      : await prisma.asphaltMixType.create({
          data: {
            isActive: true,
            mixNumber: referenceNumber,
            name: item.name,
            unit: item.stockUnit || "t",
          },
        });

    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        sourceId: asphaltMix.id,
        sourceType: "ASPHALT_MIX",
      },
    });
  }
}

async function storeInventoryPhotos(itemId: string, formData: FormData) {
  const files = formData
    .getAll("photos")
    .filter((file): file is File => file instanceof File && file.size > 0);
  const primaryExistingPhotoId = optionalId(formData.get("primaryExistingPhotoId"));
  const requestedPrimaryNewPhotoIndex = optionalInt(
    formData.get("primaryNewPhotoIndex"),
    "Hauptfoto",
  );
  const hasRequestedNewPrimary =
    requestedPrimaryNewPhotoIndex !== null &&
    requestedPrimaryNewPhotoIndex >= 0 &&
    requestedPrimaryNewPhotoIndex < files.length;
  const hasRequestedExistingPrimary = Boolean(primaryExistingPhotoId);

  if (hasRequestedExistingPrimary || hasRequestedNewPrimary) {
    await prisma.inventoryPhoto.updateMany({
      where: {
        itemId,
      },
      data: {
        isPrimary: false,
      },
    });
  }

  const existingPrimaryCount = await prisma.inventoryPhoto.count({
    where: {
      itemId,
      isPrimary: true,
    },
  });

  if (primaryExistingPhotoId) {
    await prisma.inventoryPhoto.updateMany({
      where: {
        id: primaryExistingPhotoId,
        itemId,
      },
      data: {
        isPrimary: true,
      },
    });
  }

  for (const [index, file] of files.entries()) {
    const isPrimary =
      (hasRequestedNewPrimary && requestedPrimaryNewPhotoIndex === index) ||
      (!hasRequestedExistingPrimary &&
        !hasRequestedNewPrimary &&
        existingPrimaryCount === 0 &&
        index === 0);

    const extension = allowedInventoryPhotoTypes.get(file.type);

    if (!extension) {
      throw new Error("Bitte Inventarfotos als JPG, PNG oder WebP hochladen.");
    }

    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const storagePath = `inventory-items/${itemId}/${fileName}`;

    const uploaded = await putFile(STORAGE_BUCKET, storagePath, bytes, file.type);

    await prisma.inventoryPhoto.create({
      data: {
        fileName,
        isPrimary,
        itemId,
        mimeType: file.type,
        originalName: file.name,
        sizeBytes: file.size,
        url: uploaded.publicUrl,
      },
    });
  }
}

export async function createInventoryItem(formData: FormData) {
  await requireSession();
  const categoryId = optionalId(formData.get("categoryId"));
  const allowsAssignment = await categoryAllowsInventoryAssignment(categoryId);
  if (!allowsAssignment) clearInventoryAssignmentFields(formData);
  const payload = getInventoryCreateData(formData);
  const contacts = getInventoryContacts(formData);
  const additionalEmployeeIds = getAdditionalEmployeeIds(formData);

  const item = await prisma.$transaction(async (tx) => {
    const objectNumber =
      payload.objectNumber ?? (await getNextInventoryObjectNumber(tx, categoryId));

    const createdItem = await tx.inventoryItem.create({
      data: {
        ...payload,
        objectNumber,
        contacts: contacts.length
          ? {
              create: contacts,
            }
          : undefined,
      },
    });

    if (additionalEmployeeIds.length > 0) {
      await tx.inventoryItemEmployeeAssignment.createMany({
        data: additionalEmployeeIds.map((employeeId) => ({
          employeeId,
          itemId: createdItem.id,
        })),
      });
    }

    return createdItem;
  });

  await syncVehicleLinkForInventoryItem(item.id);
  await syncAsphaltMaterialLinkForInventoryItem(item.id);
  await syncDriverVehicleAssignmentForInventoryItemId(item.id);
  await storeInventoryPhotos(item.id, formData);

  revalidateInventoryItem(item.id);
}

export async function updateInventoryItem(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  const categoryId = optionalId(formData.get("categoryId"));
  const allowsAssignment = await categoryAllowsInventoryAssignment(categoryId);
  if (!allowsAssignment) clearInventoryAssignmentFields(formData);
  const payload = getInventoryUpdateData(formData);
  const contacts = getInventoryContacts(formData);
  const additionalEmployeeIds = getAdditionalEmployeeIds(formData);

  await prisma.$transaction(async (tx) => {
    await tx.inventoryContact.deleteMany({
      where: {
        itemId: id,
      },
    });
    await tx.inventoryItemEmployeeAssignment.deleteMany({
      where: {
        itemId: id,
      },
    });

    await tx.inventoryItem.update({
      where: {
        id,
      },
      data: payload,
    });

    if (contacts.length > 0) {
      await tx.inventoryContact.createMany({
        data: contacts.map((contact) => ({
          ...contact,
          itemId: id,
        })),
      });
    }

    if (additionalEmployeeIds.length > 0) {
      await tx.inventoryItemEmployeeAssignment.createMany({
        data: additionalEmployeeIds.map((employeeId) => ({
          employeeId,
          itemId: id,
        })),
      });
    }
  });

  await syncVehicleLinkForInventoryItem(id);
  await syncAsphaltMaterialLinkForInventoryItem(id);
  await syncDriverVehicleAssignmentForInventoryItemId(id);
  await storeInventoryPhotos(id, formData);

  revalidateInventoryItem(id);
}

export async function deleteInventoryItem(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  await prisma.inventoryItem.update({
    where: {
      id,
    },
    data: {
      currentLocationLabel: null,
      currentLocationType: null,
      currentProjectId: null,
      parentItemId: null,
      responsibleCrewId: null,
      responsibleEmployeeId: null,
      responsibleType: null,
      status: "INACTIVE",
    },
  });

  revalidateInventoryItem(id);
}

export async function restoreInventoryItem(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  await prisma.inventoryItem.update({
    where: {
      id,
    },
    data: {
      status: "ACTIVE",
    },
  });

  revalidateInventoryItem(id);
}

export async function deleteInventoryItemPermanently(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({
      where: {
        id,
      },
      select: {
        categoryId: true,
        objectNumber: true,
        status: true,
      },
    });

    if (!item) {
      return;
    }

    if (item.status !== "INACTIVE" && item.status !== "DELETED") {
      throw new Error(
        "Inventarobjekte müssen zuerst archiviert werden, bevor sie endgültig gelöscht werden.",
      );
    }

    await tx.inventoryItem.delete({
      where: {
        id,
      },
    });

    const objectNumber = item.objectNumber
      ? Number.parseInt(item.objectNumber, 10)
      : Number.NaN;

    if (item.categoryId && Number.isInteger(objectNumber)) {
      const category = await tx.inventoryCategory.findUnique({
        where: {
          id: item.categoryId,
        },
        select: {
          nextObjectNumber: true,
          objectNumberStart: true,
        },
      });

      if (
        category?.objectNumberStart !== null &&
        category?.objectNumberStart !== undefined
      ) {
        const nextObjectNumber =
          category.nextObjectNumber ?? category.objectNumberStart;

        if (objectNumber < nextObjectNumber) {
          await tx.inventoryCategory.update({
            where: {
              id: item.categoryId,
            },
            data: {
              nextObjectNumber: Math.max(
                category.objectNumberStart,
                objectNumber,
              ),
            },
          });
        }
      }
    }
  });

  revalidateInventory();
}

export async function saveInventoryIdlePeriods(formData: FormData) {
  await requireSession();
  const itemId = String(formData.get("itemId") ?? "").trim();

  if (!itemId) {
    throw new Error("Inventar-ID fehlt.");
  }

  const starts = formData.getAll("idleStartsAt");
  const ends = formData.getAll("idleEndsAt");
  const notes = formData.getAll("idleNotes");

  const periods = starts
    .map((startValue, index) => {
      const startText = optionalString(startValue);
      const endText = optionalString(ends[index] ?? null);
      const note = optionalString(notes[index] ?? null);

      if (!startText && !endText && !note) {
        return null;
      }

      const startsAt = requiredDate(startValue, "Stillgelegt von");
      const endsAt = optionalDate(ends[index] ?? null);

      if (endsAt && endsAt < startsAt) {
        throw new Error("Stillgelegt bis darf nicht vor Stillgelegt von liegen.");
      }

      return {
        endsAt,
        itemId,
        notes: note,
        startsAt,
      };
    })
    .filter((period): period is NonNullable<typeof period> => Boolean(period));

  await prisma.$transaction(async (tx) => {
    await tx.inventoryIdlePeriod.deleteMany({
      where: {
        itemId,
      },
    });

    if (periods.length > 0) {
      await tx.inventoryIdlePeriod.createMany({
        data: periods,
      });
    }
  });

  revalidateInventoryItem(itemId);
}

export async function assignInventoryItemToContainer(formData: FormData) {
  await requireSession();
  const containerId = String(formData.get("containerId") ?? "").trim();
  const childItemId = String(formData.get("childItemId") ?? "").trim();

  if (!containerId || !childItemId) {
    throw new Error("Container oder Objekt fehlt.");
  }

  if (containerId === childItemId) {
    throw new Error("Ein Objekt kann nicht in sich selbst liegen.");
  }

  const container = await prisma.inventoryItem.findUnique({
    where: {
      id: containerId,
    },
    select: {
      isContainer: true,
    },
  });

  if (!container?.isContainer) {
    throw new Error("Das ausgewählte Ziel ist kein Containerobjekt.");
  }

  await prisma.inventoryItem.update({
    where: {
      id: childItemId,
    },
    data: {
      parentItem: {
        connect: {
          id: containerId,
        },
      },
    },
  });

  revalidateInventoryItem(containerId);
  revalidateInventoryItem(childItemId);
}

export async function updateInventoryAssignment(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  const item = await prisma.inventoryItem.findUnique({
    where: {
      id,
    },
    select: {
      category: {
        select: {
          name: true,
          useInEmployeeFile: true,
          useInTeamManagement: true,
          parentCategory: {
            select: {
              name: true,
              useInEmployeeFile: true,
              useInTeamManagement: true,
            },
          },
        },
      },
    },
  });

  if (
    !inventoryCategoryAllowsAssignment(item?.category)
  ) {
    redirect(
      `/inventory/${id}?noticeType=error&notice=${encodeURIComponent(
        "Mitarbeiter- und Kolonnenzuordnungen sind für diese Kategorie nicht freigegeben. Aktiviere in der Inventarkategorie „In Teams-Verwaltung wählbar“ oder „In Personalakte listen“.",
      )}`,
    );
  }

  const responsibleEmployeeId = optionalId(formData.get("responsibleEmployeeId"));
  const responsibleCrewId = optionalId(formData.get("responsibleCrewId"));
  const notes = optionalString(formData.get("notes"));

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: {
        id,
      },
      data: {
        responsibleCrew: relationUpdate(responsibleCrewId),
        responsibleEmployee: relationUpdate(responsibleEmployeeId),
        responsibleType:
          responsibleEmployeeId ? "EMPLOYEE" : responsibleCrewId ? "CREW" : null,
      },
    });

    await tx.inventoryUsageHistory.create({
      data: {
        employee: responsibleEmployeeId
          ? {
              connect: {
                id: responsibleEmployeeId,
              },
            }
          : undefined,
        eventType: "ASSIGNMENT",
        item: {
          connect: {
            id,
          },
        },
        notes,
      },
    });

    await syncDriverVehicleAssignmentForInventoryItem(tx, id);
  });

  revalidateInventoryItem(id);
}

export async function returnInventoryItemToBaseLocation(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const locationType = String(formData.get("locationType") ?? "").trim();
  const transportedByEmployeeId = optionalId(
    formData.get("transportedByEmployeeId"),
  );
  const notes = optionalString(formData.get("notes"));
  const allowedLocations = new Map([
    ["BAUHOF", "Bauhof"],
    ["WERKSTATT", "Werkstatt"],
    ["MISCHANLAGE", "Mischanlage"],
  ]);
  const locationLabel = allowedLocations.get(locationType);

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  if (!locationLabel) {
    throw new Error("Bitte Zielstandort auswählen.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: {
        id,
      },
      data: {
        currentProject: {
          disconnect: true,
        },
        responsibleCrew: {
          disconnect: true,
        },
        responsibleEmployee: {
          disconnect: true,
        },
        responsibleType: null,
      },
    });

    await tx.$executeRaw`
      UPDATE "InventoryItem"
      SET "currentLocationLabel" = ${locationLabel},
          "currentLocationType" = ${locationType}
      WHERE "id" = ${id}
    `;

    await tx.inventoryUsageHistory.create({
      data: {
        eventType: "RETURN_TO_BASE",
        item: {
          connect: {
            id,
          },
        },
        notes: [notes, `Rückgabe an ${locationLabel}`]
          .filter(Boolean)
          .join(" · "),
        transportedByEmployee: transportedByEmployeeId
          ? {
              connect: {
                id: transportedByEmployeeId,
              },
            }
          : undefined,
      },
    });

    await syncDriverVehicleAssignmentForInventoryItem(tx, id);
  });

  revalidateInventoryItem(id);
}

export async function recordInventoryStockMovement(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();
  const movementType = String(formData.get("movementType") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  if (!["ISSUE", "RETURN", "ADJUSTMENT"].includes(movementType)) {
    throw new Error("Lagerbewegung ist ungültig.");
  }

  const quantity = requiredStock(formData.get("quantity"), "Menge");
  const employeeId = optionalId(formData.get("employeeId"));
  const projectId = optionalId(formData.get("projectId"));
  const notes = optionalString(formData.get("notes"));

  await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({
      where: {
        id,
      },
      select: {
        currentStock: true,
        isStockManaged: true,
      },
    });

    if (!item?.isStockManaged) {
      throw new Error("Dieses Objekt ist kein Lagerobjekt.");
    }

    const stockBefore = item.currentStock ?? 0;
    const stockAfter =
      movementType === "ISSUE"
        ? stockBefore - quantity
        : movementType === "RETURN"
          ? stockBefore + quantity
          : quantity;

    if (stockAfter < 0) {
      throw new Error("Der Lagerbestand kann nicht negativ werden.");
    }

    await tx.inventoryItem.update({
      where: {
        id,
      },
      data: {
        currentStock: stockAfter,
      },
    });

    await tx.inventoryUsageHistory.create({
      data: {
        employee: employeeId
          ? {
              connect: {
                id: employeeId,
              },
            }
          : undefined,
        eventType: movementType,
        item: {
          connect: {
            id,
          },
        },
        notes,
        project: projectId
          ? {
              connect: {
                id: projectId,
              },
            }
          : undefined,
        quantity,
        receivedAt:
          movementType === "RETURN" || movementType === "ADJUSTMENT"
            ? new Date()
            : undefined,
        returnedAt: movementType === "ISSUE" ? new Date() : undefined,
        stockAfter,
        stockBefore,
      },
    });
  });

  revalidateInventoryItem(id);
}

export async function issuePersonalInventory(formData: FormData) {
  await requireSession();
  const itemId = requiredString(formData.get("itemId"), "Inventarobjekt");
  const employeeId = requiredString(formData.get("employeeId"), "Mitarbeiter");
  const quantity = requiredStock(formData.get("quantity"), "Menge");
  const signatureDataUrl = requiredString(
    formData.get("signatureDataUrl"),
    "Unterschrift des Mitarbeiters",
  );
  const issuedCondition = optionalString(formData.get("condition"));
  const issueNotes = optionalString(formData.get("notes"));
  const processedByEmployeeId = requiredString(
    formData.get("processedByEmployeeId"),
    "Ausgegeben durch",
  );

  await prisma.$transaction(async (tx) => {
    const manager = await tx.employee.findFirst({
      where: {
        id: processedByEmployeeId,
        statusValue: "active",
        canManagePersonalInventory: true,
      },
    });
    if (!manager) {
      throw new Error("Die ausgewählte Person darf persönliches Inventar nicht ausgeben.");
    }
    const item = await tx.inventoryItem.findUnique({
      include: {
        category: {
          include: { parentCategory: true },
        },
      },
      where: { id: itemId },
    });
    if (!item) throw new Error("Inventarobjekt wurde nicht gefunden.");
    const isPersonal =
      item.category?.isPersonalInventory ||
      item.category?.parentCategory?.isPersonalInventory;
    if (!isPersonal) {
      throw new Error(
        "Die Kategorie ist nicht als persönliches Inventar freigegeben.",
      );
    }
    if (!item.isStockManaged && quantity !== 1) {
      throw new Error("Ein Einzelobjekt kann nur einmal ausgegeben werden.");
    }
    if (!item.isStockManaged) {
      const existing = await tx.inventoryPersonalAssignment.count({
        where: { itemId, status: "ISSUED" },
      });
      if (existing > 0) {
        throw new Error("Dieses Einzelobjekt ist bereits ausgegeben.");
      }
    }

    const stockBefore = item.currentStock ?? 0;
    const stockAfter = item.isStockManaged ? stockBefore - quantity : null;
    if (item.isStockManaged && (stockAfter ?? 0) < 0) {
      throw new Error("Der Lagerbestand reicht für diese Ausgabe nicht aus.");
    }
    if (item.isStockManaged) {
      await tx.inventoryItem.update({
        data: { currentStock: stockAfter },
        where: { id: itemId },
      });
    }

    await tx.inventoryPersonalAssignment.create({
      data: {
        employeeId,
        issueNotes,
        issueSignatureDataUrl: signatureDataUrl,
        issuedByName: `${manager.lastName}, ${manager.firstName}`,
        issuedCondition,
        itemId,
        quantity,
      },
    });
    await tx.inventoryUsageHistory.create({
      data: {
        employeeId,
        eventType: "PERSONAL_ISSUE",
        itemId,
        notes: [issueNotes, "Ausgabe digital quittiert"].filter(Boolean).join(" · "),
        quantity,
        returnedAt: new Date(),
        stockAfter,
        stockBefore: item.isStockManaged ? stockBefore : null,
      },
    });
  });

  revalidateInventoryItem(itemId);
  revalidatePath(`/employees/certificates/${employeeId}`);
}

export async function returnPersonalInventory(formData: FormData) {
  await requireSession();
  const assignmentId = requiredString(formData.get("assignmentId"), "Ausgabe");
  const returnQuantity = requiredStock(formData.get("quantity"), "Rückgabemenge");
  const signatureDataUrl = requiredString(
    formData.get("signatureDataUrl"),
    "Rückgabeunterschrift",
  );
  const returnedCondition = optionalString(formData.get("condition"));
  const returnNotes = optionalString(formData.get("notes"));
  const processedByEmployeeId = requiredString(
    formData.get("processedByEmployeeId"),
    "Zurückgenommen durch",
  );

  const assignment = await prisma.$transaction(async (tx) => {
    const manager = await tx.employee.findFirst({
      where: {
        id: processedByEmployeeId,
        statusValue: "active",
        canManagePersonalInventory: true,
      },
    });
    if (!manager) {
      throw new Error(
        "Die ausgewählte Person darf persönliches Inventar nicht zurücknehmen.",
      );
    }
    const current = await tx.inventoryPersonalAssignment.findUnique({
      include: { item: true },
      where: { id: assignmentId },
    });
    if (!current || current.status !== "ISSUED") {
      throw new Error("Diese Ausgabe ist nicht mehr offen.");
    }
    const outstanding = current.quantity - current.returnedQuantity;
    if (Math.abs(returnQuantity - outstanding) > 0.000001) {
      throw new Error(
        "Eine quittierte Ausgabe muss vollständig zurückgenommen werden. Für Teilmengen bitte getrennte Ausgaben anlegen.",
      );
    }
    const returnedQuantity = current.returnedQuantity + returnQuantity;
    const stockBefore = current.item.currentStock ?? 0;
    const stockAfter = current.item.isStockManaged
      ? stockBefore + returnQuantity
      : null;

    if (current.item.isStockManaged) {
      await tx.inventoryItem.update({
        data: { currentStock: stockAfter },
        where: { id: current.itemId },
      });
    }
    const updated = await tx.inventoryPersonalAssignment.update({
      data: {
        returnNotes,
        returnSignatureDataUrl: signatureDataUrl,
        returnedAt: new Date(),
        returnedByName: `${manager.lastName}, ${manager.firstName}`,
        returnedCondition,
        returnedQuantity,
        status: "RETURNED",
      },
      where: { id: assignmentId },
    });
    await tx.inventoryUsageHistory.create({
      data: {
        employeeId: current.employeeId,
        eventType: "PERSONAL_RETURN",
        itemId: current.itemId,
        notes: [returnNotes, "Rückgabe digital quittiert"]
          .filter(Boolean)
          .join(" · "),
        quantity: returnQuantity,
        receivedAt: new Date(),
        stockAfter,
        stockBefore: current.item.isStockManaged ? stockBefore : null,
      },
    });
    return updated;
  });

  revalidateInventoryItem(assignment.itemId);
  revalidatePath(`/employees/certificates/${assignment.employeeId}`);
}

export async function deleteInventoryPhoto(formData: FormData) {
  await requireSession();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Foto-ID fehlt.");
  }

  const photo = await prisma.inventoryPhoto.delete({
    where: {
      id,
    },
  });

  await deleteFile(
    STORAGE_BUCKET,
    `inventory-items/${photo.itemId}/${photo.fileName}`,
  ).catch(() => undefined);

  if (photo.isPrimary) {
    const nextPrimaryPhoto = await prisma.inventoryPhoto.findFirst({
      where: {
        itemId: photo.itemId,
      },
      orderBy: [{ createdAt: "desc" }],
    });

    if (nextPrimaryPhoto) {
      await prisma.inventoryPhoto.update({
        where: {
          id: nextPrimaryPhoto.id,
        },
        data: {
          isPrimary: true,
        },
      });
    }
  }

  revalidateInventoryItem(photo.itemId);
}

export async function recordInventoryScan(formData: FormData) {
  await requireSession();
  const itemId = optionalString(formData.get("itemId"));

  if (!itemId) {
    throw new Error("Inventarobjekt fehlt.");
  }

  const item = await prisma.inventoryItem.findUnique({
    where: {
      id: itemId,
    },
    select: {
      id: true,
    },
  });

  if (!item) {
    throw new Error("Inventarobjekt wurde nicht gefunden.");
  }

  await prisma.inventoryScanLog.create({
    data: {
      accuracyMeters: optionalRawFloat(formData.get("accuracyMeters")),
      action: optionalString(formData.get("action")) ?? "VIEW",
      itemId,
      latitude: optionalRawFloat(formData.get("latitude")),
      longitude: optionalRawFloat(formData.get("longitude")),
      notes: optionalString(formData.get("notes")),
      rawValue: optionalString(formData.get("rawValue")),
      scannedByName: optionalString(formData.get("scannedByName")) ?? "Unbekannt",
      userAgent: optionalString(formData.get("userAgent")),
    },
  });

  revalidateInventoryItem(itemId);
}

export async function deleteCompleteInventory(formData: FormData) {
  await requireAdmin();
  const confirmation = String(formData.get("confirmation") ?? "")
    .trim()
    .toUpperCase();

  if (confirmation !== "INVENTAR LÖSCHEN") {
    throw new Error(
      "Zum vollständigen Löschen bitte „INVENTAR LÖSCHEN“ eingeben.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.deleteMany();

    const categories = await tx.inventoryCategory.findMany({
      select: {
        id: true,
        objectNumberStart: true,
      },
    });

    for (const category of categories) {
      await tx.inventoryCategory.update({
        where: {
          id: category.id,
        },
        data: {
          nextObjectNumber: category.objectNumberStart,
        },
      });
    }
  });

  await deleteFolder(STORAGE_BUCKET, "inventory-items").catch(() => undefined);

  revalidatePath("/inventory");
  revalidatePath("/inventory/storage");
  revalidatePath("/inventory/scanner");
  revalidatePath("/employees");
}
