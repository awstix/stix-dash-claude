"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import {
  formatInventoryObjectNumber,
  getNextInventoryObjectNumber,
} from "@/lib/inventory-object-numbers";
import { prisma } from "@/lib/prisma";

const allowedInventoryPhotoTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
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
  return ["ACTIVE", "DEFECT", "IN_SERVICE", "LOCKED"].includes(text ?? "")
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
  const responsibleType = optionalString(formData.get("responsibleType"));

  if (responsibleType === "EMPLOYEE") {
    return {
      responsibleCrewId: null,
      responsibleEmployeeId: optionalId(formData.get("responsibleEmployeeId")),
      responsibleType,
    };
  }

  if (responsibleType === "CREW") {
    return {
      responsibleCrewId: optionalId(formData.get("responsibleCrewId")),
      responsibleEmployeeId: null,
      responsibleType,
    };
  }

  return {
    responsibleCrewId: null,
    responsibleEmployeeId: null,
    responsibleType: null,
  };
}

function revalidateInventory() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/storage");
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
    billingRateCents: optionalMoneyCents(formData.get("billingRate")),
    axleCount: optionalInt(formData.get("axleCount"), "Anzahl Achsen"),
    categoryId: optionalId(formData.get("categoryId")),
    constructionDate,
    constructionYear: constructionDate ? constructionDate.getUTCFullYear() : null,
    currentProjectId: optionalId(formData.get("currentProjectId")),
    currentStock: openingStock,
    driveType: inventoryDriveType(formData.get("driveType")),
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
    stockUnit: optionalString(formData.get("stockUnit")) ?? "Stk.",
    vehicleId: optionalId(formData.get("vehicleId")),
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
    vehicleId,
    ...payload
  } = getInventoryPayload(formData);

  return {
    ...payload,
    category: relationConnect(categoryId),
    currentProject: relationConnect(currentProjectId),
    parentItem: relationConnect(parentItemId),
    responsibleCrew: relationConnect(responsibleCrewId),
    responsibleEmployee: relationConnect(responsibleEmployeeId),
    vehicle: relationConnect(vehicleId),
  };
}

function getInventoryUpdateData(formData: FormData) {
  const {
    categoryId,
    currentProjectId,
    parentItemId,
    responsibleCrewId,
    responsibleEmployeeId,
    vehicleId,
    ...payload
  } = getInventoryPayload(formData);

  return {
    ...payload,
    category: relationUpdate(categoryId),
    currentProject: relationUpdate(currentProjectId),
    parentItem: relationUpdate(parentItemId),
    responsibleCrew: relationUpdate(responsibleCrewId),
    responsibleEmployee: relationUpdate(responsibleEmployeeId),
    vehicle: relationUpdate(vehicleId),
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

    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "inventory-items",
      itemId,
    );
    await mkdir(uploadDirectory, { recursive: true });

    const fileName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}.${extension}`;
    const absolutePath = path.join(uploadDirectory, fileName);
    const bytes = Buffer.from(await file.arrayBuffer());

    await writeFile(absolutePath, bytes);

    await prisma.inventoryPhoto.create({
      data: {
        fileName,
        isPrimary,
        itemId,
        mimeType: file.type,
        originalName: file.name,
        sizeBytes: file.size,
        url: `/uploads/inventory-items/${itemId}/${fileName}`,
      },
    });
  }
}

export async function createInventoryItem(formData: FormData) {
  const categoryId = optionalId(formData.get("categoryId"));
  const payload = getInventoryCreateData(formData);
  const contacts = getInventoryContacts(formData);

  const item = await prisma.$transaction(async (tx) => {
    const objectNumber =
      payload.objectNumber ?? (await getNextInventoryObjectNumber(tx, categoryId));

    return tx.inventoryItem.create({
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
  });

  await storeInventoryPhotos(item.id, formData);

  revalidateInventoryItem(item.id);
}

export async function updateInventoryItem(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  const payload = getInventoryUpdateData(formData);
  const contacts = getInventoryContacts(formData);

  await prisma.$transaction(async (tx) => {
    await tx.inventoryContact.deleteMany({
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
  });

  await storeInventoryPhotos(id, formData);

  revalidateInventoryItem(id);
}

export async function deleteInventoryItem(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  await prisma.inventoryItem.delete({
    where: {
      id,
    },
  });

  revalidateInventory();
}

export async function assignInventoryItemToContainer(formData: FormData) {
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
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Inventar-ID fehlt.");
  }

  const responsibleType = optionalString(formData.get("responsibleType"));
  const responsibleEmployeeId =
    responsibleType === "EMPLOYEE"
      ? optionalId(formData.get("responsibleEmployeeId"))
      : null;
  const responsibleCrewId =
    responsibleType === "CREW" ? optionalId(formData.get("responsibleCrewId")) : null;
  const currentProjectId = optionalId(formData.get("currentProjectId"));
  const transportedByEmployeeId = optionalId(
    formData.get("transportedByEmployeeId"),
  );
  const notes = optionalString(formData.get("notes"));

  await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: {
        id,
      },
      data: {
        currentProject: relationUpdate(currentProjectId),
        responsibleCrew: relationUpdate(responsibleCrewId),
        responsibleEmployee: relationUpdate(responsibleEmployeeId),
        responsibleType:
          responsibleEmployeeId || responsibleCrewId ? responsibleType : null,
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
        project: currentProjectId
          ? {
              connect: {
                id: currentProjectId,
              },
            }
          : undefined,
        transportedByEmployee: transportedByEmployeeId
          ? {
              connect: {
                id: transportedByEmployeeId,
              },
            }
          : undefined,
      },
    });
  });

  revalidateInventoryItem(id);
}

export async function recordInventoryStockMovement(formData: FormData) {
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

export async function deleteInventoryPhoto(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Foto-ID fehlt.");
  }

  const photo = await prisma.inventoryPhoto.delete({
    where: {
      id,
    },
  });

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
