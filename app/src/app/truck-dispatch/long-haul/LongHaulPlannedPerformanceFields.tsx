"use client";

import { useEffect, useRef, useState } from "react";

type VehicleOption = {
  id: string;
  vehicleNumber: string;
  licensePlate: string | null;
  category: string;
  asphaltPayloadTons: number;
};

type DriverOption = {
  id: string;
  vehicleAssignments: {
    isPrimary: boolean;
    vehicle: {
      id: string;
      asphaltPayloadTons: number;
    };
  }[];
};

function parseNumber(value: string) {
  const number = Number(String(value).replace(",", "."));
  return Number.isNaN(number) ? 0 : number;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatInputNumber(value: number) {
  return String(Math.round(value * 100) / 100);
}

function getSuggestedTourCount(quantity: number, tonsPerTour: number) {
  if (quantity <= 0 || tonsPerTour <= 0) {
    return "1";
  }

  return String(Math.max(1, Math.ceil(quantity / tonsPerTour)));
}

function getPrimaryVehicle(driver: DriverOption | undefined) {
  if (!driver) {
    return undefined;
  }

  return (
    driver.vehicleAssignments.find((assignment) => assignment.isPrimary)
      ?.vehicle ?? driver.vehicleAssignments[0]?.vehicle
  );
}

export function LongHaulPlannedPerformanceFields({
  materialQuantity,
  vehicles,
  drivers,
  driverSelectName,
  vehicleSelectName,
  tourCountName,
  tonsPerTourName,
  startTimeName,
  endTimeName,
  notesName,
}: {
  materialQuantity: number;
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  driverSelectName: string;
  vehicleSelectName: string;
  tourCountName: string;
  tonsPerTourName: string;
  startTimeName: string;
  endTimeName: string;
  notesName: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [tourCount, setTourCount] = useState("1");
  const [tonsPerTour, setTonsPerTour] = useState("");
  const [tourCountWasEdited, setTourCountWasEdited] = useState(false);
  const [tonsPerTourWasEdited, setTonsPerTourWasEdited] = useState(false);

  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId);
  const effectiveVehicleId =
    selectedVehicleId || getPrimaryVehicle(selectedDriver)?.id || "";
  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === effectiveVehicleId,
  );
  const payloadTons = selectedVehicle?.asphaltPayloadTons ?? 0;
  const plannedCapacity = parseNumber(tourCount) * parseNumber(tonsPerTour);

  useEffect(() => {
    const root = rootRef.current;
    const form = root?.closest("form");

    if (!form) {
      return;
    }

    const driverField = form.elements.namedItem(
      driverSelectName,
    ) as HTMLSelectElement | null;
    const vehicleField = form.elements.namedItem(
      vehicleSelectName,
    ) as HTMLSelectElement | null;

    function syncSelection() {
      setSelectedDriverId(driverField?.value ?? "");
      setSelectedVehicleId(vehicleField?.value ?? "");
    }

    syncSelection();

    driverField?.addEventListener("change", syncSelection);
    vehicleField?.addEventListener("change", syncSelection);

    return () => {
      driverField?.removeEventListener("change", syncSelection);
      vehicleField?.removeEventListener("change", syncSelection);
    };
  }, [driverSelectName, vehicleSelectName]);

  useEffect(() => {
    if (payloadTons <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (!tonsPerTourWasEdited) {
        setTonsPerTour(formatInputNumber(payloadTons));
      }

      if (!tourCountWasEdited) {
        setTourCount(getSuggestedTourCount(materialQuantity, payloadTons));
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    materialQuantity,
    payloadTons,
    tonsPerTourWasEdited,
    tourCountWasEdited,
  ]);

  return (
    <div ref={rootRef} className="rounded-xl border border-orange-200 bg-orange-50 p-3">
      <div className="text-xs font-semibold text-orange-950">
        Geplante Leistung
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          name={tourCountName}
          type="number"
          min="1"
          value={tourCount}
          onChange={(event) => {
            setTourCount(event.target.value);
            setTourCountWasEdited(true);
          }}
          placeholder="Touren"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <input
          name={tonsPerTourName}
          type="number"
          min="0"
          step="0.01"
          value={tonsPerTour}
          onChange={(event) => {
            setTonsPerTour(event.target.value);
            setTonsPerTourWasEdited(true);
          }}
          placeholder="t / Tour"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <input
          name={startTimeName}
          type="time"
          defaultValue="06:30"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
        <input
          name={endTimeName}
          type="time"
          defaultValue="17:00"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </div>

      {payloadTons > 0 && materialQuantity > 0 ? (
        <div className="mt-2 rounded-lg border border-orange-200 bg-white p-2 text-xs text-orange-950">
          Vorschlag: {formatNumber(materialQuantity)} t /{" "}
          {formatNumber(payloadTons)} t Nutzlast ={" "}
          <strong>{tourCount} Touren</strong>
          {plannedCapacity > 0
            ? ` · Kapazität ${formatNumber(plannedCapacity)} t`
            : ""}
        </div>
      ) : null}

      <input
        name={notesName}
        placeholder="Bemerkung zur geplanten Leistung"
        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
      />
    </div>
  );
}
