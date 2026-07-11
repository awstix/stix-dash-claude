import type { Prisma } from "@prisma/client";

export const vehicleInventoryLinkInclude = {
  inventoryItems: {
    orderBy: [{ objectNumber: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      objectNumber: true,
      inventoryNumber: true,
      licensePlate: true,
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
              name: true,
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

export const inventoryVehicleBridgeInclude = {
  category: {
    select: {
      dailyReportMachineLabel: true,
      name: true,
      parentCategory: {
        select: {
          name: true,
          useInTruckDispatchSelection: true,
        },
      },
      useInTruckDispatchSelection: true,
    },
  },
  currentProject: {
    select: {
      id: true,
      name: true,
      projectNumber: true,
    },
  },
  responsibleCrew: {
    select: {
      id: true,
      name: true,
    },
  },
  responsibleEmployee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  vehicle: {
    include: {
      driverAssignments: {
        where: {
          isActive: true,
        },
        include: {
          driver: true,
        },
      },
    },
  },
} satisfies Prisma.InventoryItemInclude;

export type InventoryVehicleBridgeItem = Prisma.InventoryItemGetPayload<{
  include: typeof inventoryVehicleBridgeInclude;
}>;

export type VehicleInventoryLink = {
  id: string;
  name: string;
  objectNumber: string | null;
  inventoryNumber: string | null;
  licensePlate?: string | null;
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
      name: string;
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

export function inventoryItemToVehicleWithInventoryLink(
  item: InventoryVehicleBridgeItem,
) {
  if (!item.vehicle) {
    return null;
  }

  const categoryName = item.category?.name ?? item.vehicle.category;
  const parentCategoryName = item.category?.parentCategory?.name;
  const categoryLabel = parentCategoryName
    ? `${parentCategoryName} / ${categoryName}`
    : categoryName;

  return {
    ...item.vehicle,
    asphaltPayloadTons:
      item.payloadKg !== null && item.payloadKg !== undefined
        ? item.payloadKg / 1000
        : item.vehicle.asphaltPayloadTons,
    category: categoryLabel,
    licensePlate: item.licensePlate ?? item.vehicle.licensePlate,
    tackCoatTankLiters:
      item.workMaterialTankLiters ?? item.vehicle.tackCoatTankLiters,
    vehicleNumber: item.objectNumber ?? item.vehicle.vehicleNumber,
    inventoryItems: [item],
  };
}

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
