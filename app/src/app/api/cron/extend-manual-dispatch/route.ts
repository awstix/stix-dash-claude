import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MANUAL_SPECIAL_VEHICLE_DISPATCH_NOTE =
  "Automatisch aus manueller Baustellen-Zuordnung (Inventarobjekt)";

/** Täglicher Cron-Job (siehe vercel.json), der die "offen bis umgebucht"
 * Kette für manuell zugeordnete Sondergeräte fortführt - siehe
 * syncManualSpecialVehicleDispatchAssignment in src/app/inventory/actions.ts
 * für den Hintergrund (SpecialVehicleDispatchAssignment ist ein
 * Tage-Modell, kann "offen" also nur durch tägliches Weiterschreiben
 * abbilden statt eines einzelnen offenen Datumsbereichs wie bei
 * EquipmentDispatchAssignment).
 *
 * Nimmt jeden automatisch angelegten "gestern"-Eintrag, prüft ob
 * InventoryItem.currentProjectId noch zu dessen Baustelle passt, und legt
 * dann den heutigen Tag an - die Kette endet von selbst, sobald die
 * Zuordnung am Objekt geändert oder entfernt wurde. */
export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.inventoryBookingSettings.findUnique({
    where: {
      id: "default",
    },
  });

  // Default an (true), solange nichts explizit gespeichert wurde - siehe
  // Admin > Inventar > Buchungsoptionen.
  if (settings?.specialVehicleAutoExtend === false) {
    return NextResponse.json({ ok: true, skipped: "specialVehicleAutoExtend is off" });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const yesterdaysAutoRows = await prisma.specialVehicleDispatchAssignment.findMany({
    where: {
      notes: MANUAL_SPECIAL_VEHICLE_DISPATCH_NOTE,
      workDate: yesterday,
    },
  });

  let extended = 0;
  let stopped = 0;

  for (const row of yesterdaysAutoRows) {
    if (!row.vehicleInventoryItemId) continue;

    const item = await prisma.inventoryItem.findUnique({
      select: {
        currentProjectId: true,
        vehicleId: true,
      },
      where: {
        id: row.vehicleInventoryItemId,
      },
    });

    if (!item?.vehicleId || item.currentProjectId !== row.projectId) {
      stopped += 1;
      continue;
    }

    const alreadyToday = await prisma.specialVehicleDispatchAssignment.findFirst({
      where: {
        notes: MANUAL_SPECIAL_VEHICLE_DISPATCH_NOTE,
        vehicleInventoryItemId: row.vehicleInventoryItemId,
        workDate: today,
      },
    });

    if (alreadyToday) continue;

    await prisma.specialVehicleDispatchAssignment.create({
      data: {
        notes: MANUAL_SPECIAL_VEHICLE_DISPATCH_NOTE,
        projectId: row.projectId,
        projectName: row.projectName,
        projectNumber: row.projectNumber,
        taskText: row.taskText,
        vehicleId: item.vehicleId,
        vehicleInventoryItemId: row.vehicleInventoryItemId,
        vehicleName: row.vehicleName,
        workDate: today,
      },
    });
    extended += 1;
  }

  return NextResponse.json({
    checked: yesterdaysAutoRows.length,
    extended,
    ok: true,
    stopped,
  });
}
