"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

function parseDate(value: FormDataEntryValue | null, fieldName: string) {
  const text = String(value ?? "").trim();

  if (!text) {
    throw new Error(`${fieldName} fehlt.`);
  }

  const date = new Date(`${text}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} ist kein gültiges Datum.`);
  }

  return date;
}

function optionalString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim().replace(",", ".");

  if (!text) return null;

  const number = Number(text);

  if (Number.isNaN(number) || number < 0) {
    throw new Error("Menge muss eine Zahl größer oder gleich 0 sein.");
  }

  return Math.round(number * 100) / 100;
}

function normalizeTime(value: FormDataEntryValue | null, fallback: string) {
  const text = String(value ?? "").trim() || fallback;

  const match = text.match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    throw new Error("Uhrzeit ist nicht gültig.");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59) {
    throw new Error("Uhrzeit ist nicht gültig.");
  }

  if (hours === 24 && minutes !== 0) {
    throw new Error("24:00 ist nur als Ende erlaubt.");
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  if (value === "24:00") return 1440;

  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  return hours * 60 + minutes;
}

function assertValidTimeRange(startTime: string, endTime: string) {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new Error("Ende muss nach Beginn liegen.");
  }
}

function getIndexesFromFormData(formData: FormData, prefixes: string[]) {
  const indexes = new Set<number>();

  for (const key of formData.keys()) {
    for (const prefix of prefixes) {
      const match = key.match(new RegExp(`^${prefix}_(\\d+)$`));

      if (match) {
        indexes.add(Number(match[1]));
      }
    }
  }

  return Array.from(indexes).sort((a, b) => a - b);
}

function datesAreSameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function assertInputRowsDoNotOverlap(
  rows: {
    startTime: string;
    endTime: string;
    workDate: Date;
    rowNumber: number;
  }[],
) {
  for (let firstIndex = 0; firstIndex < rows.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < rows.length; secondIndex += 1) {
      const first = rows[firstIndex];
      const second = rows[secondIndex];

      if (!datesAreSameDay(first.workDate, second.workDate)) {
        continue;
      }

      const firstStart = timeToMinutes(first.startTime);
      const firstEnd = timeToMinutes(first.endTime);
      const secondStart = timeToMinutes(second.startTime);
      const secondEnd = timeToMinutes(second.endTime);

      if (firstStart < secondEnd && secondStart < firstEnd) {
        throw new Error(
          `Tour ${first.rowNumber} und Tour ${second.rowNumber} überschneiden sich zeitlich.`,
        );
      }
    }
  }
}

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function revalidateSpecialVehicleConsumers() {
  revalidatePath("/special-vehicle-dispatch");
  revalidatePath("/crew-dispatch");
  revalidatePath("/truck-dispatch/short-haul");
  revalidatePath("/equipment-dispatch");
}

async function getVehicle(vehicleId: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: {
      id: vehicleId,
    },
  });

  if (!vehicle) {
    throw new Error("Sonderfahrzeug wurde nicht gefunden.");
  }

  if (!vehicle.isSpecialVehicle) {
    throw new Error("Dieses Fahrzeug ist nicht als Sonderfahrzeug markiert.");
  }

  return vehicle;
}

async function getProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
  });

  if (!project) {
    throw new Error("Baustelle wurde nicht gefunden.");
  }

  return project;
}

async function getCrewOrNull(crewId: string | null) {
  if (!crewId) return null;

  const crew = await prisma.crew.findUnique({
    where: {
      id: crewId,
    },
  });

  if (!crew) {
    throw new Error("Kolonne wurde nicht gefunden.");
  }

  return crew;
}

async function getTransportVehicleOrNull(vehicleId: string | null) {
  if (!vehicleId) return null;

  const vehicle = await prisma.vehicle.findUnique({
    where: {
      id: vehicleId,
    },
  });

  if (!vehicle) {
    throw new Error("Transport-LKW wurde nicht gefunden.");
  }

  return vehicle;
}

async function getDriverOrNull(driverId: string | null) {
  if (!driverId) return null;

  const driver = await prisma.driver.findUnique({
    where: {
      id: driverId,
    },
  });

  if (!driver) {
    throw new Error("Fahrer/Bediener wurde nicht gefunden.");
  }

  return driver;
}

function getVehicleName(vehicle: {
  vehicleNumber: string | null;
  licensePlate: string | null;
  vehicleType: string | null;
}) {
  return [vehicle.vehicleNumber, vehicle.licensePlate, vehicle.vehicleType]
    .filter(Boolean)
    .join(" · ");
}

function getDriverName(driver: { lastName: string; firstName: string }) {
  return `${driver.lastName}, ${driver.firstName}`;
}

async function assertSpecialVehicleTimeIsFree({
  vehicleId,
  workDate,
  startTime,
  endTime,
  ignoreId,
}: {
  vehicleId: string;
  workDate: Date;
  startTime: string;
  endTime: string;
  ignoreId?: string;
}) {
  const dayStart = new Date(workDate);
  dayStart.setUTCHours(0, 0, 0, 0);

  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const assignments = await prisma.specialVehicleDispatchAssignment.findMany({
    where: {
      vehicleId,
      workDate: {
        gte: dayStart,
        lt: dayEnd,
      },
      ...(ignoreId
        ? {
            id: {
              not: ignoreId,
            },
          }
        : {}),
    },
    orderBy: [{ startTime: "asc" }],
  });

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  const conflict = assignments.find((assignment) => {
    const existingStart = timeToMinutes(assignment.startTime);
    const existingEnd = timeToMinutes(assignment.endTime);

    return start < existingEnd && existingStart < end;
  });

  if (!conflict) {
    return;
  }

  throw new Error(
    `Sonderfahrzeug ist am ${formatGermanDate(workDate)} von ${conflict.startTime} bis ${conflict.endTime} bereits auf ${conflict.projectNumber} · ${conflict.projectName} eingeplant.`,
  );
}

function getAssignmentInput(formData: FormData) {
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const transportVehicleId = optionalString(formData.get("transportVehicleId"));
  const operatorDriverId = optionalString(formData.get("operatorDriverId"));
  const projectId = String(formData.get("projectId") ?? "").trim();
  const crewId = optionalString(formData.get("crewId"));
  const workDate = parseDate(formData.get("workDate"), "Datum");
  const startTime = normalizeTime(formData.get("startTime"), "07:00");
  const endTime = normalizeTime(formData.get("endTime"), "17:00");

  if (!vehicleId) {
    throw new Error("Bitte ein Sonderfahrzeug wählen.");
  }

  if (!projectId) {
    throw new Error("Bitte eine Baustelle wählen.");
  }

  assertValidTimeRange(startTime, endTime);

  return {
    vehicleId,
    transportVehicleId,
    operatorDriverId,
    projectId,
    crewId,
    workDate,
    startTime,
    endTime,
    taskText: optionalString(formData.get("taskText")) ?? "Sonderfahrzeug-Einsatz",
    materialName: optionalString(formData.get("materialName")),
    quantity: parseOptionalNumber(formData.get("quantity")),
    quantityUnit: optionalString(formData.get("quantityUnit")),
    notes: optionalString(formData.get("notes")),
  };
}

export async function createSpecialVehicleDispatchAssignment(formData: FormData) {
  const input = getAssignmentInput(formData);

  const [vehicle, project, crew, transportVehicle, operatorDriver] = await Promise.all([
    getVehicle(input.vehicleId),
    getProject(input.projectId),
    getCrewOrNull(input.crewId),
    getTransportVehicleOrNull(input.transportVehicleId),
    getDriverOrNull(input.operatorDriverId),
  ]);

  await assertSpecialVehicleTimeIsFree({
    vehicleId: vehicle.id,
    workDate: input.workDate,
    startTime: input.startTime,
    endTime: input.endTime,
  });

  await prisma.specialVehicleDispatchAssignment.create({
    data: {
      workDate: input.workDate,
      startTime: input.startTime,
      endTime: input.endTime,
      vehicle: {
        connect: {
          id: vehicle.id,
        },
      },
      vehicleName: getVehicleName(vehicle),
      ...(transportVehicle
        ? {
            transportVehicle: {
              connect: {
                id: transportVehicle.id,
              },
            },
            transportVehicleName: getVehicleName(transportVehicle),
          }
        : {}),
      ...(operatorDriver
        ? {
            operatorDriver: {
              connect: {
                id: operatorDriver.id,
              },
            },
            operatorDriverName: getDriverName(operatorDriver),
          }
        : {}),
      project: {
        connect: {
          id: project.id,
        },
      },
      projectNumber: project.projectNumber,
      projectName: project.name,
      ...(crew
        ? {
            crew: {
              connect: {
                id: crew.id,
              },
            },
            crewName: crew.name,
          }
        : {}),
      taskText: input.taskText,
      materialName: input.materialName,
      quantity: input.quantity,
      quantityUnit: input.quantityUnit,
      notes: input.notes,
    },
  });

  revalidateSpecialVehicleConsumers();
}

export async function createSpecialVehicleDispatchTourAssignments(formData: FormData) {
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const transportVehicleId = optionalString(formData.get("transportVehicleId"));
  const operatorDriverId = optionalString(formData.get("operatorDriverId"));
  const crewId = optionalString(formData.get("crewId"));
  const fallbackWorkDate = parseDate(formData.get("workDate"), "Datum");

  if (!vehicleId) {
    throw new Error("Bitte ein Sonderfahrzeug wählen.");
  }

  const [vehicle, crew, transportVehicle, operatorDriver] = await Promise.all([
    getVehicle(vehicleId),
    getCrewOrNull(crewId),
    getTransportVehicleOrNull(transportVehicleId),
    getDriverOrNull(operatorDriverId),
  ]);

  const indexes = getIndexesFromFormData(formData, [
    "tourProjectId",
    "tourStartTime",
    "tourEndTime",
    "tourTaskText",
    "tourMaterialName",
    "tourQuantity",
    "tourQuantityUnit",
    "tourNotes",
  ]);

  const inputs = [];

  for (const index of indexes) {
    const projectId = String(formData.get(`tourProjectId_${index}`) ?? "").trim();
    const taskText = optionalString(formData.get(`tourTaskText_${index}`));
    const materialName = optionalString(formData.get(`tourMaterialName_${index}`));
    const quantity = parseOptionalNumber(formData.get(`tourQuantity_${index}`));
    const quantityUnit = optionalString(formData.get(`tourQuantityUnit_${index}`));
    const notes = optionalString(formData.get(`tourNotes_${index}`));

    const rowWasTouched = Boolean(
      projectId ||
        taskText ||
        materialName ||
        quantity !== null ||
        quantityUnit ||
        notes,
    );

    if (!rowWasTouched) {
      continue;
    }

    if (!projectId) {
      throw new Error(`Tour ${inputs.length + 1}: Bitte eine Baustelle wählen.`);
    }

    const startTime = normalizeTime(
      formData.get(`tourStartTime_${index}`),
      inputs.length === 0 ? "07:00" : inputs[inputs.length - 1].endTime,
    );
    const endTime = normalizeTime(formData.get(`tourEndTime_${index}`), "17:00");

    assertValidTimeRange(startTime, endTime);

    inputs.push({
      projectId,
      workDate: fallbackWorkDate,
      startTime,
      endTime,
      taskText: taskText ?? "Sonderfahrzeug-Einsatz",
      materialName,
      quantity,
      quantityUnit,
      notes,
      rowNumber: inputs.length + 1,
    });
  }

  if (inputs.length === 0) {
    throw new Error("Bitte mindestens eine Tour mit Baustelle und Uhrzeit eintragen.");
  }

  assertInputRowsDoNotOverlap(inputs);

  for (const input of inputs) {
    const project = await getProject(input.projectId);

    await assertSpecialVehicleTimeIsFree({
      vehicleId: vehicle.id,
      workDate: input.workDate,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    await prisma.specialVehicleDispatchAssignment.create({
      data: {
        workDate: input.workDate,
        startTime: input.startTime,
        endTime: input.endTime,
        vehicle: {
          connect: {
            id: vehicle.id,
          },
        },
        vehicleName: getVehicleName(vehicle),
        ...(transportVehicle
          ? {
              transportVehicle: {
                connect: {
                  id: transportVehicle.id,
                },
              },
              transportVehicleName: getVehicleName(transportVehicle),
            }
          : {}),
        ...(operatorDriver
          ? {
              operatorDriver: {
                connect: {
                  id: operatorDriver.id,
                },
              },
              operatorDriverName: getDriverName(operatorDriver),
            }
          : {}),
        project: {
          connect: {
            id: project.id,
          },
        },
        projectNumber: project.projectNumber,
        projectName: project.name,
        ...(crew
          ? {
              crew: {
                connect: {
                  id: crew.id,
                },
              },
              crewName: crew.name,
            }
          : {}),
        taskText: input.taskText,
        materialName: input.materialName,
        quantity: input.quantity,
        quantityUnit: input.quantityUnit,
        notes: input.notes,
      },
    });
  }

  revalidateSpecialVehicleConsumers();
}

export async function updateSpecialVehicleDispatchAssignment(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Sonderfahrzeug-Einsatz-ID fehlt.");
  }

  const input = getAssignmentInput(formData);

  const [vehicle, project, crew, transportVehicle, operatorDriver] = await Promise.all([
    getVehicle(input.vehicleId),
    getProject(input.projectId),
    getCrewOrNull(input.crewId),
    getTransportVehicleOrNull(input.transportVehicleId),
    getDriverOrNull(input.operatorDriverId),
  ]);

  await assertSpecialVehicleTimeIsFree({
    vehicleId: vehicle.id,
    workDate: input.workDate,
    startTime: input.startTime,
    endTime: input.endTime,
    ignoreId: id,
  });

  await prisma.specialVehicleDispatchAssignment.update({
    where: {
      id,
    },
    data: {
      workDate: input.workDate,
      startTime: input.startTime,
      endTime: input.endTime,
      vehicle: {
        connect: {
          id: vehicle.id,
        },
      },
      vehicleName: getVehicleName(vehicle),
      transportVehicle: transportVehicle
        ? {
            connect: {
              id: transportVehicle.id,
            },
          }
        : {
            disconnect: true,
          },
      transportVehicleName: transportVehicle ? getVehicleName(transportVehicle) : null,
      operatorDriver: operatorDriver
        ? {
            connect: {
              id: operatorDriver.id,
            },
          }
        : {
            disconnect: true,
          },
      operatorDriverName: operatorDriver ? getDriverName(operatorDriver) : null,
      project: {
        connect: {
          id: project.id,
        },
      },
      projectNumber: project.projectNumber,
      projectName: project.name,
      crew: crew
        ? {
            connect: {
              id: crew.id,
            },
          }
        : {
            disconnect: true,
          },
      crewName: crew?.name ?? null,
      taskText: input.taskText,
      materialName: input.materialName,
      quantity: input.quantity,
      quantityUnit: input.quantityUnit,
      notes: input.notes,
    },
  });

  revalidateSpecialVehicleConsumers();
}

export async function deleteSpecialVehicleDispatchAssignment(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    throw new Error("Sonderfahrzeug-Einsatz-ID fehlt.");
  }

  await prisma.specialVehicleDispatchAssignment.delete({
    where: {
      id,
    },
  });

  revalidateSpecialVehicleConsumers();
}
