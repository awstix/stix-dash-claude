import type { Prisma } from "@prisma/client";

export const vehicleInventoryLinkInclude = {
  inventoryItems: {
    orderBy: [{ objectNumber: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      objectNumber: true,
      inventoryNumber: true,
      manufacturer: true,
      model: true,
      fuelTankLiters: true,
      workMaterialTankLiters: true,
      isContainer: true,
      isStockManaged: true,
      status: true,
      currentLocationLabel: true,
      currentProject: {
        select: {
          id: true,
          name: true,
          projectNumber: true,
        },
      },
      category: {
        select: {
          dailyReportMachineLabel: true,
          name: true,
          parentCategory: {
            select: {
              useInTruckDispatchSelection: true,
            },
          },
          useInTruckDispatchSelection: true,
        },
      },
      responsibleEmployee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      responsibleCrew: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 1,
  },
} satisfies Prisma.VehicleInclude;

export type VehicleInventoryLink = {
  id: string;
  name: string;
  objectNumber: string | null;
  inventoryNumber: string | null;
  manufacturer?: string | null;
  model?: string | null;
  fuelTankLiters?: number | null;
  workMaterialTankLiters?: number | null;
  isContainer?: boolean;
  isStockManaged?: boolean;
  status: string;
  currentLocationLabel: string | null;
  currentProject?: {
    id: string;
    name: string;
    projectNumber: string;
  } | null;
  category?: {
    dailyReportMachineLabel: string | null;
    name: string;
    parentCategory?: {
      useInTruckDispatchSelection: boolean;
    } | null;
    useInTruckDispatchSelection: boolean;
  } | null;
  responsibleEmployee?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  responsibleCrew?: {
    id: string;
    name: string;
  } | null;
};

export type VehicleWithInventoryLink = {
  inventoryItems?: VehicleInventoryLink[];
};

export function getVehicleInventoryItem(vehicle: VehicleWithInventoryLink) {
  return vehicle.inventoryItems?.[0] ?? null;
}

export function getVehicleInventoryLabel(vehicle: VehicleWithInventoryLink) {
  const item = getVehicleInventoryItem(vehicle);

  if (!item) {
    return null;
  }

  return [item.objectNumber, item.inventoryNumber, item.name]
    .filter(Boolean)
    .join(" · ");
}

export function getVehicleInventoryResponsibleLabel(
  item: VehicleInventoryLink | null,
) {
  if (!item) {
    return null;
  }

  if (item.responsibleEmployee) {
    return [
      item.responsibleEmployee.lastName,
      item.responsibleEmployee.firstName,
    ]
      .filter(Boolean)
      .join(", ");
  }

  return item.responsibleCrew?.name ?? null;
}
