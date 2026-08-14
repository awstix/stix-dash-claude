import {
  getVehicleInventoryItem,
  type VehicleWithInventoryLink,
} from "@/lib/inventory-vehicle-links";

export function getVehicleLabel(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
}) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.category,
    vehicle.vehicleType,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function getEquipmentVehicleSelectLabel(
  vehicle: {
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
  } & VehicleWithInventoryLink,
) {
  const inventoryItem = getVehicleInventoryItem(vehicle);

  if (!inventoryItem) {
    return getVehicleLabel(vehicle);
  }

  return [
    inventoryItem.objectNumber ?? vehicle.vehicleNumber,
    inventoryItem.name,
    inventoryItem.manufacturer,
    inventoryItem.model,
    inventoryItem.licensePlate ?? vehicle.licensePlate,
    inventoryItem.category?.parentCategory?.name,
    inventoryItem.category?.name,
  ]
    .filter(Boolean)
    .join(" · ");
}
