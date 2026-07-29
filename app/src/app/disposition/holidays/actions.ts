"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function dateValue(raw: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Bitte ein gültiges Datum auswählen.");
  }
  return new Date(`${raw}T00:00:00.000Z`);
}

function refresh() {
  revalidatePath("/disposition/holidays");
  revalidatePath("/employee-dispatch");
  revalidatePath("/crew-dispatch");
  revalidatePath("/equipment-dispatch");
  revalidatePath("/special-vehicle-dispatch");
  revalidatePath("/truck-dispatch");
  revalidatePath("/asphalt-dispatch");
}

export async function setAutomaticHolidayState(formData: FormData) {
  const date = dateValue(value(formData, "date"));
  const name = value(formData, "name");
  if (!name) throw new Error("Bezeichnung fehlt.");

  await prisma.dispositionDayOff.upsert({
    where: { date_name: { date, name } },
    create: {
      date,
      name,
      kind: "PUBLIC_HOLIDAY",
      scopeLabel: value(formData, "scopeLabel") || null,
      sourceLabel: value(formData, "sourceLabel") || null,
      sourceUrl: value(formData, "sourceUrl") || null,
      sourceCheckedAt: new Date(),
      isAutomatic: true,
      isDayOff: formData.get("isDayOff") === "on",
    },
    update: {
      scopeLabel: value(formData, "scopeLabel") || null,
      sourceLabel: value(formData, "sourceLabel") || null,
      sourceUrl: value(formData, "sourceUrl") || null,
      sourceCheckedAt: new Date(),
      isAutomatic: true,
      isDayOff: formData.get("isDayOff") === "on",
    },
  });
  refresh();
}

export async function createManualDayOff(formData: FormData) {
  const date = dateValue(value(formData, "date"));
  const endDateRaw = value(formData, "endDate");
  const endDate = endDateRaw ? dateValue(endDateRaw) : date;
  const name = value(formData, "name");
  if (!name) throw new Error("Bezeichnung fehlt.");
  if (endDate < date) throw new Error("Das Bis-Datum darf nicht vor dem Von-Datum liegen.");

  await prisma.dispositionDayOff.create({
    data: {
      date,
      endDate,
      name,
      kind: value(formData, "kind") || "COMPANY",
      scopeLabel: value(formData, "scopeLabel") || "Betrieblich",
      sourceLabel: value(formData, "sourceLabel") || "Betriebliche Festlegung",
      sourceUrl: value(formData, "sourceUrl") || null,
      sourceCheckedAt: new Date(),
      isAutomatic: false,
      isDayOff: formData.get("isDayOff") === "on",
      notes: value(formData, "notes") || null,
    },
  });
  refresh();
}

export async function updateManualDayOff(formData: FormData) {
  const id = value(formData, "id");
  if (!id) throw new Error("Eintrag fehlt.");

  const date = dateValue(value(formData, "date"));
  const endDateRaw = value(formData, "endDate");
  const endDate = endDateRaw ? dateValue(endDateRaw) : date;
  if (endDate < date) throw new Error("Das Bis-Datum darf nicht vor dem Von-Datum liegen.");

  await prisma.dispositionDayOff.update({
    where: { id },
    data: {
      date,
      endDate,
      name: value(formData, "name"),
      kind: value(formData, "kind") || "COMPANY",
      scopeLabel: value(formData, "scopeLabel") || "Betrieblich",
      sourceLabel: value(formData, "sourceLabel") || "Betriebliche Festlegung",
      sourceUrl: value(formData, "sourceUrl") || null,
      sourceCheckedAt: new Date(),
      isDayOff: formData.get("isDayOff") === "on",
      notes: value(formData, "notes") || null,
    },
  });
  refresh();
}

export async function deleteManualDayOff(formData: FormData) {
  const id = value(formData, "id");
  if (!id) throw new Error("Eintrag fehlt.");
  await prisma.dispositionDayOff.delete({ where: { id } });
  refresh();
}
