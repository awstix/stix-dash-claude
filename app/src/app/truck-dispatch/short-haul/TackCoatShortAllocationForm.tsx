"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createTackCoatLoadAllocation } from "../tack-coat-load-actions";

type VehicleOption = {
  id: string;
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  tackCoatTankLiters: number;
};

type DriverOption = {
  id: string;
  firstName: string;
  lastName: string;
  vehicleAssignments: {
    isPrimary: boolean;
    vehicle: VehicleOption;
  }[];
};

type TackCoatPosition = {
  projectId: string | null;
  projectNumber: string;
  materialName: string;
  quantityUnit: string;
  openLiters: number;
  isFullyAllocated: boolean;
};

type WorkTimeSettings = {
  name: string;
  startTime: string;
  endTime: string;
};

type ConflictMap = Record<string, string>;

const fallbackWorkTime: WorkTimeSettings = {
  name: "Standard",
  startTime: "06:30",
  endTime: "17:00",
};

function formatLiters(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function getVehicleLabel(vehicle: VehicleOption) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.category,
    vehicle.vehicleType,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getPrimaryVehicle(driver: DriverOption | undefined) {
  if (!driver) return undefined;

  return (
    driver.vehicleAssignments.find((assignment) => assignment.isPrimary)?.vehicle ??
    driver.vehicleAssignments[0]?.vehicle
  );
}

export function TackCoatShortAllocationForm({
  workDate,
  position,
  drivers,
  vehicles,
  driverConflicts = {},
  vehicleConflicts = {},
}: {
  workDate: string;
  position: TackCoatPosition;
  drivers: DriverOption[];
  vehicles: VehicleOption[];
  driverConflicts?: ConflictMap;
  vehicleConflicts?: ConflictMap;
}) {
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [tourCount, setTourCount] = useState(1);
  const [litersPerTour, setLitersPerTour] = useState("");
  const [litersPerTourWasEdited, setLitersPerTourWasEdited] = useState(false);
  const [notes, setNotes] = useState("");
  const [workTime, setWorkTime] = useState<WorkTimeSettings>(fallbackWorkTime);
  const [startTime, setStartTime] = useState(fallbackWorkTime.startTime);
  const [endTime, setEndTime] = useState(fallbackWorkTime.endTime);
  const [fullWorkDay, setFullWorkDay] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadWorkTime() {
      try {
        const response = await fetch("/api/work-time", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as WorkTimeSettings;

        if (isMounted && data.startTime && data.endTime) {
          setWorkTime(data);
          setStartTime(data.startTime);
          setEndTime(data.endTime);
        }
      } catch {
        // Der Standard-Arbeitstag bleibt aktiv.
      }
    }

    loadWorkTime();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedDriver = drivers.find((driver) => driver.id === driverId);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);

  const selectedDriverConflict = selectedDriver
    ? driverConflicts[selectedDriver.id]
    : null;

  const selectedVehicleConflict = selectedVehicle
    ? vehicleConflicts[selectedVehicle.id]
    : null;

  const calculatedTotal = useMemo(() => {
    const liters = Number(String(litersPerTour).replace(/\./g, "").replace(",", "."));

    if (Number.isNaN(liters)) return 0;

    return Math.round(tourCount * liters * 100) / 100;
  }, [tourCount, litersPerTour]);

  const tankWarning =
    selectedVehicle &&
    selectedVehicle.tackCoatTankLiters > 0 &&
    Number(String(litersPerTour).replace(/\./g, "").replace(",", ".")) >
      selectedVehicle.tackCoatTankLiters;

  const openWarning = calculatedTotal > position.openLiters;
  const hasConflict = Boolean(selectedDriverConflict || selectedVehicleConflict);

  function resetForm() {
    setDriverId("");
    setVehicleId("");
    setTourCount(1);
    setLitersPerTour("");
    setLitersPerTourWasEdited(false);
    setNotes("");
    setFullWorkDay(true);
    setStartTime(workTime.startTime);
    setEndTime(workTime.endTime);
    setErrorText("");
  }

  function applyVehicleTank(vehicle: VehicleOption | undefined) {
    if (!vehicle || litersPerTourWasEdited) return;

    if (vehicle.tackCoatTankLiters > 0) {
      setLitersPerTour(String(vehicle.tackCoatTankLiters));
    }
  }

  function handleDriverChange(nextDriverId: string) {
    setErrorText("");

    const driver = drivers.find((item) => item.id === nextDriverId);

    if (!driver) {
      setDriverId("");
      setVehicleId("");
      return;
    }

    setDriverId(nextDriverId);

    const primaryVehicle = getPrimaryVehicle(driver);

    if (primaryVehicle && !vehicleConflicts[primaryVehicle.id]) {
      setVehicleId(primaryVehicle.id);
      applyVehicleTank(primaryVehicle);
    } else if (primaryVehicle && vehicleConflicts[primaryVehicle.id]) {
      setVehicleId("");
    }
  }

  function handleVehicleChange(nextVehicleId: string) {
    setVehicleId(nextVehicleId);
    setErrorText("");

    const vehicle = vehicles.find((item) => item.id === nextVehicleId);
    applyVehicleTank(vehicle);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorText("");

    if (hasConflict) {
      setErrorText(
        "Fahrer oder Fahrzeug ist bereits eingeplant. Bitte eine freie Kombination wählen oder die bestehende Einteilung bearbeiten.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      await createTackCoatLoadAllocation(formData);
      resetForm();
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Die Anspritzmittelmenge konnte nicht zugeteilt werden.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const effectiveStartTime = fullWorkDay ? workTime.startTime : startTime;
  const effectiveEndTime = fullWorkDay ? workTime.endTime : endTime;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="workDate" value={workDate} />
      <input type="hidden" name="sourceType" value="SHORT" />
      <input type="hidden" name="projectId" value={position.projectId ?? ""} />
      <input type="hidden" name="projectNumber" value={position.projectNumber} />
      <input type="hidden" name="materialName" value={position.materialName} />
      <input type="hidden" name="quantityUnit" value={position.quantityUnit} />
      <input type="hidden" name="startTime" value={effectiveStartTime} />
      <input type="hidden" name="endTime" value={effectiveEndTime} />

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        <label className="text-xs font-medium text-gray-700">
          Fahrer
          <select
            name="driverId"
            required
            value={driverId}
            disabled={position.isFullyAllocated || isSubmitting}
            onChange={(event) => handleDriverChange(event.target.value)}
            className={
              selectedDriverConflict
                ? "mt-1 w-full rounded-lg border border-yellow-400 bg-yellow-50 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                : "mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            }
          >
            <option value="" disabled>
              Fahrer wählen
            </option>

            {drivers.map((driver) => {
              const primaryVehicle = getPrimaryVehicle(driver);
              const driverConflict = driverConflicts[driver.id];
              const primaryVehicleConflict = primaryVehicle
                ? vehicleConflicts[primaryVehicle.id]
                : null;
              const conflict = driverConflict ?? primaryVehicleConflict;

              return (
                <option key={driver.id} value={driver.id} disabled={Boolean(conflict)}>
                  {conflict ? `belegt ${conflict} · ` : ""}
                  {driver.lastName}, {driver.firstName}
                  {primaryVehicle
                    ? ` · Hauptfahrzeug ${getVehicleLabel(primaryVehicle)}`
                    : " · kein Hauptfahrzeug"}
                </option>
              );
            })}
          </select>
        </label>

        <label className="text-xs font-medium text-gray-700">
          Fahrzeug
          <select
            name="vehicleId"
            required
            value={vehicleId}
            disabled={position.isFullyAllocated || isSubmitting}
            onChange={(event) => handleVehicleChange(event.target.value)}
            className={
              selectedVehicleConflict
                ? "mt-1 w-full rounded-lg border border-yellow-400 bg-yellow-50 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                : "mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            }
          >
            <option value="" disabled>
              Inventarobjekt wählen
            </option>

            {vehicles.map((vehicle) => {
              const conflict = vehicleConflicts[vehicle.id];

              return (
                <option key={vehicle.id} value={vehicle.id} disabled={Boolean(conflict)}>
                  {conflict ? `belegt ${conflict} · ` : ""}
                  {getVehicleLabel(vehicle)}
                  {vehicle.tackCoatTankLiters > 0
                    ? ` · Arbeitsmitteltank ${formatLiters(vehicle.tackCoatTankLiters)} l`
                    : " · kein Arbeitsmitteltank hinterlegt"}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {selectedDriverConflict ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-semibold text-yellow-900">
          Fahrer bereits eingeplant: {selectedDriverConflict}
        </div>
      ) : null}

      {selectedVehicleConflict ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-semibold text-yellow-900">
          Fahrzeug bereits eingeplant: {selectedVehicleConflict}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
        <label className="text-xs font-medium text-gray-700">
          Touren
          <input
            name="tourCount"
            type="number"
            min="1"
            value={tourCount}
            disabled={position.isFullyAllocated || isSubmitting}
            onChange={(event) => setTourCount(Math.max(1, Number(event.target.value)))}
            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </label>

        <label className="text-xs font-medium text-gray-700">
          l / Tour
          <input
            name="litersPerTour"
            type="number"
            min="0"
            step="0.01"
            value={litersPerTour}
            disabled={position.isFullyAllocated || isSubmitting}
            onChange={(event) => {
              setLitersPerTourWasEdited(true);
              setLitersPerTour(event.target.value);
            }}
            placeholder={
              selectedVehicle?.tackCoatTankLiters
                ? String(selectedVehicle.tackCoatTankLiters)
                : "z.B. 600"
            }
            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </label>

        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          <div className="font-medium text-gray-500">Gesamt</div>
          <div className="mt-1 font-bold text-gray-900">
            {formatLiters(calculatedTotal)} {position.quantityUnit}
          </div>
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs font-medium text-gray-700">
        <input
          type="checkbox"
          checked={fullWorkDay}
          disabled={position.isFullyAllocated || isSubmitting}
          onChange={(event) => {
            setFullWorkDay(event.target.checked);

            if (event.target.checked) {
              setStartTime(workTime.startTime);
              setEndTime(workTime.endTime);
            }
          }}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          Vollständigen Arbeitstag anzeigen
          <span className="block text-[11px] font-normal text-gray-500">
            {workTime.startTime} – {workTime.endTime} · Vorlage: {workTime.name}
          </span>
        </span>
      </label>

      {!fullWorkDay ? (
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
          <label className="text-xs font-medium text-gray-700">
            Beginn
            <input
              type="time"
              value={startTime}
              disabled={position.isFullyAllocated || isSubmitting}
              onChange={(event) => setStartTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </label>

          <label className="text-xs font-medium text-gray-700">
            Ende
            <input
              type="time"
              value={endTime}
              disabled={position.isFullyAllocated || isSubmitting}
              onChange={(event) => setEndTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </label>
        </div>
      ) : null}

      {selectedVehicle ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
          Arbeitsmitteltank laut Inventar:{" "}
          <strong>
            {selectedVehicle.tackCoatTankLiters > 0
              ? `${formatLiters(selectedVehicle.tackCoatTankLiters)} l`
              : "nicht hinterlegt"}
          </strong>
          . Die Handeingabe bei <strong>l / Tour</strong> hat Vorrang.
        </div>
      ) : null}

      {tankWarning ? (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-medium text-yellow-900">
          Hinweis: Die Handeingabe liegt über dem hinterlegten Arbeitsmitteltank.
          Speichern bleibt möglich.
        </div>
      ) : null}

      {openWarning ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs font-medium text-red-900">
          Die Gesamtmenge ist größer als die offene Anspritzmittelmenge.
        </div>
      ) : null}

      {errorText ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-xs font-medium text-red-900">
          {errorText}
        </div>
      ) : null}

      <input
        name="notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Bemerkung optional"
        disabled={position.isFullyAllocated || isSubmitting}
        className="w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
      />

      <button
        type="submit"
        disabled={
          position.isFullyAllocated ||
          isSubmitting ||
          !driverId ||
          !vehicleId ||
          !litersPerTour ||
          calculatedTotal <= 0 ||
          openWarning ||
          hasConflict
        }
        className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:bg-gray-300 disabled:text-gray-500"
      >
        {isSubmitting ? "Wird gespeichert..." : "Nachlieferung zuteilen"}
      </button>
    </form>
  );
}
