import { prisma } from "@/lib/prisma";

export function timeToMinutes(value: string) {
  if (value === "24:00") return 1440;

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;

  return hours * 60 + minutes;
}

export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) {
  return (
    timeToMinutes(aStart) < timeToMinutes(bEnd) &&
    timeToMinutes(bStart) < timeToMinutes(aEnd)
  );
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getDayRange(workDate: Date) {
  return {
    gte: workDate,
    lt: addDays(workDate, 1),
  };
}

function formatWindow(startTime: string, endTime: string) {
  return `${startTime}–${endTime} Uhr`;
}

// Blockt nur, wenn sich die Uhrzeiten wirklich überschneiden - ein Fahrer/
// Fahrzeug, das z.B. 07:00-11:00 verplant ist, muss ab 11:00 weiterhin
// einteilbar sein (statt für den ganzen Tag gesperrt zu werden).
export async function assertShortSourceAvailability({
  driverId,
  vehicleId,
  workDate,
  startTime,
  endTime,
  excludeAsphaltAllocationId,
  excludeTackCoatAllocationId,
}: {
  driverId: string | null;
  vehicleId: string | null;
  workDate: Date;
  startTime: string;
  endTime: string;
  excludeAsphaltAllocationId?: string;
  excludeTackCoatAllocationId?: string;
}) {
  const orConditions = [];

  if (driverId) orConditions.push({ driverId });
  if (vehicleId) orConditions.push({ vehicleId });

  if (orConditions.length === 0) return;

  const dayRange = getDayRange(workDate);

  const existingShortHauls = await prisma.shortHaulAssignment.findMany({
    where: {
      workDate: dayRange,
      OR: orConditions,
    },
    include: {
      tours: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  for (const assignment of existingShortHauls) {
    const conflictingTour = assignment.tours.find((tour) =>
      timeRangesOverlap(startTime, endTime, tour.startTime, tour.endTime),
    );

    if (!conflictingTour) continue;

    const window = formatWindow(
      conflictingTour.startTime,
      conflictingTour.endTime,
    );

    if (driverId && assignment.driverId === driverId) {
      throw new Error(
        `Fahrer ${assignment.driverName ?? ""} ist an diesem Tag von ${window} bereits in der Kurzstrecke eingeplant. Bitte den bestehenden Kurzstrecken-Eintrag öffnen und dort weitere Touren ergänzen, oder eine andere Uhrzeit wählen.`,
      );
    }

    if (vehicleId && assignment.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          assignment.licensePlate ?? assignment.vehicleNumber ?? ""
        } ist an diesem Tag von ${window} bereits in der Kurzstrecke eingeplant. Bitte den bestehenden Kurzstrecken-Eintrag öffnen und dort weitere Touren ergänzen, oder eine andere Uhrzeit wählen.`,
      );
    }
  }

  const existingAsphaltAllocations = await prisma.asphaltLoadAllocation.findMany({
    where: {
      sourceType: "SHORT",
      workDate: dayRange,
      OR: orConditions,
      ...(excludeAsphaltAllocationId
        ? { NOT: { id: excludeAsphaltAllocationId } }
        : {}),
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const conflictingAsphalt = existingAsphaltAllocations.find((allocation) =>
    timeRangesOverlap(startTime, endTime, allocation.startTime, allocation.endTime),
  );

  if (conflictingAsphalt) {
    const window = formatWindow(
      conflictingAsphalt.startTime,
      conflictingAsphalt.endTime,
    );

    if (driverId && conflictingAsphalt.driverId === driverId) {
      throw new Error(
        `Fahrer ${conflictingAsphalt.driverName ?? ""} ist an diesem Tag von ${window} bereits über eine Asphaltmenge eingeplant. Bitte die bestehende Zuteilung bearbeiten oder eine andere Uhrzeit wählen.`,
      );
    }

    if (vehicleId && conflictingAsphalt.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          conflictingAsphalt.licensePlate ?? conflictingAsphalt.vehicleNumber ?? ""
        } ist an diesem Tag von ${window} bereits über eine Asphaltmenge eingeplant. Bitte die bestehende Zuteilung bearbeiten oder eine andere Uhrzeit wählen.`,
      );
    }
  }

  const existingTackCoatAllocations = await prisma.tackCoatLoadAllocation.findMany({
    where: {
      sourceType: "SHORT",
      workDate: dayRange,
      OR: orConditions,
      ...(excludeTackCoatAllocationId
        ? { NOT: { id: excludeTackCoatAllocationId } }
        : {}),
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const conflictingTackCoat = existingTackCoatAllocations.find((allocation) =>
    timeRangesOverlap(startTime, endTime, allocation.startTime, allocation.endTime),
  );

  if (conflictingTackCoat) {
    const window = formatWindow(
      conflictingTackCoat.startTime,
      conflictingTackCoat.endTime,
    );

    if (driverId && conflictingTackCoat.driverId === driverId) {
      throw new Error(
        `Fahrer ${conflictingTackCoat.driverName ?? ""} ist an diesem Tag von ${window} bereits über eine Anspritzmittel-Nachlieferung eingeplant. Bitte die bestehende Zuteilung bearbeiten oder eine andere Uhrzeit wählen.`,
      );
    }

    if (vehicleId && conflictingTackCoat.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          conflictingTackCoat.licensePlate ?? conflictingTackCoat.vehicleNumber ?? ""
        } ist an diesem Tag von ${window} bereits über eine Anspritzmittel-Nachlieferung eingeplant. Bitte die bestehende Zuteilung bearbeiten oder eine andere Uhrzeit wählen.`,
      );
    }
  }

  // Langstrecke bindet Fahrer/Fahrzeug bewusst für den ganzen Tag an eine
  // Maßnahme - hier bleibt es beim vollen Tagesblock.
  const existingLongHaul = await prisma.truckLongHaulTruckAssignment.findFirst({
    where: {
      ownerType: "OWN",
      OR: orConditions,
      entry: {
        workDate: dayRange,
      },
    },
    include: {
      entry: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingLongHaul) {
    if (driverId && existingLongHaul.driverId === driverId) {
      throw new Error(
        `Fahrer ${
          existingLongHaul.driverName ?? ""
        } ist an diesem Tag bereits in der Langstrecke bei Maßnahme ${
          existingLongHaul.entry.projectNumber
        } · ${existingLongHaul.entry.projectName} geplant. Bitte bewusst prüfen und dort ändern.`,
      );
    }

    if (vehicleId && existingLongHaul.vehicleId === vehicleId) {
      throw new Error(
        `Fahrzeug ${
          existingLongHaul.licensePlate ?? existingLongHaul.vehicleNumber ?? ""
        } ist an diesem Tag bereits in der Langstrecke bei Maßnahme ${
          existingLongHaul.entry.projectNumber
        } · ${existingLongHaul.entry.projectName} geplant. Bitte bewusst prüfen und dort ändern.`,
      );
    }
  }
}
