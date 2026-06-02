import { prisma } from "@/lib/prisma";

export type WorkTimeSettings = {
  name: string;
  startTime: string;
  endTime: string;
};

export const fallbackWorkTime: WorkTimeSettings = {
  name: "Standard",
  startTime: "06:30",
  endTime: "17:00",
};

export async function ensureDefaultWorkTimePresets() {
  const count = await prisma.workTimePreset.count();

  if (count > 0) {
    return;
  }

  await prisma.workTimePreset.createMany({
    data: [
      {
        name: "Sommer",
        startTime: "06:30",
        endTime: "17:00",
        isDefault: true,
        isActive: true,
        sortOrder: 10,
      },
      {
        name: "Winter",
        startTime: "07:30",
        endTime: "16:30",
        isDefault: false,
        isActive: true,
        sortOrder: 20,
      },
      {
        name: "Standard",
        startTime: "07:00",
        endTime: "16:30",
        isDefault: false,
        isActive: true,
        sortOrder: 30,
      },
    ],
  });
}

export async function getDefaultWorkTime() {
  await ensureDefaultWorkTimePresets();

  const defaultPreset = await prisma.workTimePreset.findFirst({
    where: {
      isDefault: true,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (defaultPreset) {
    return {
      name: defaultPreset.name,
      startTime: defaultPreset.startTime,
      endTime: defaultPreset.endTime,
    };
  }

  const firstActivePreset = await prisma.workTimePreset.findFirst({
    where: {
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  if (firstActivePreset) {
    return {
      name: firstActivePreset.name,
      startTime: firstActivePreset.startTime,
      endTime: firstActivePreset.endTime,
    };
  }

  return fallbackWorkTime;
}