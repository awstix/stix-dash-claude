import type { VehicleWithInventoryLink } from "@/lib/inventory-vehicle-links";

type SelectableInventoryCategory = {
  useInTruckDispatchSelection?: boolean | null;
  parentCategory?: {
    useInTruckDispatchSelection?: boolean | null;
  } | null;
} | null | undefined;

type VehicleForTruckDispatchSelection = {
  category?: string | null;
  isSpecialVehicle?: boolean | null;
  vehicleType?: string | null;
} & VehicleWithInventoryLink;

type DriverForTruckDispatchSelection = {
  employee?: {
    positions?: {
      positionLabel?: string | null;
      positionValue?: string | null;
    }[];
  } | null;
  vehicleAssignments?: {
    vehicle: VehicleForTruckDispatchSelection;
  }[];
};

export function inventoryCategoryAllowsTruckDispatchSelection(
  category: SelectableInventoryCategory,
) {
  return Boolean(
    category?.useInTruckDispatchSelection ||
      category?.parentCategory?.useInTruckDispatchSelection,
  );
}

export function vehicleIsSelectableInTruckDispatch(
  vehicle: VehicleForTruckDispatchSelection,
) {
  const inventoryCategory = vehicle.inventoryItems?.[0]?.category;

  if (inventoryCategory) {
    return inventoryCategoryAllowsTruckDispatchSelection(inventoryCategory);
  }

  return isLegacyTruckOrSpecialVehicle(vehicle);
}

export function driverIsSelectableInTruckDispatch(
  driver: DriverForTruckDispatchSelection,
) {
  const positions = driver.employee?.positions ?? [];

  if (positions.length > 0 && !positions.some(isTruckDriverPosition)) {
    return false;
  }

  const assignments = driver.vehicleAssignments ?? [];

  if (assignments.length === 0) {
    return true;
  }

  return assignments.some((assignment) =>
    vehicleIsSelectableInTruckDispatch(assignment.vehicle),
  );
}

function isTruckDriverPosition(position: {
  positionLabel?: string | null;
  positionValue?: string | null;
}) {
  const text = `${position.positionLabel ?? ""} ${
    position.positionValue ?? ""
  }`.toLowerCase();

  return text.includes("lkw") && text.includes("fahrer");
}

function isLegacyTruckOrSpecialVehicle(vehicle: {
  category?: string | null;
  isSpecialVehicle?: boolean | null;
  vehicleType?: string | null;
}) {
  if (vehicle.isSpecialVehicle) {
    return true;
  }

  const text = `${vehicle.category ?? ""} ${vehicle.vehicleType ?? ""}`
    .trim()
    .toLowerCase();

  return (
    text.includes("lkw") ||
    text.includes("sattel") ||
    text.includes("kipper") ||
    text.includes("anspritz")
  );
}
