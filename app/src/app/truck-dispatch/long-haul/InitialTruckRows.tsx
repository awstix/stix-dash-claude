"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type DriverWithVehicles = {
  id: string;
  firstName: string;
  lastName: string;
  shortcut: string | null;
  vehicleAssignments: {
    isPrimary: boolean;
    vehicle: {
      id: string;
      vehicleNumber: string;
      licensePlate: string | null;
      vehicleType: string;
      category: string;
      asphaltPayloadTons: number;
    };
  }[];
};

type VehicleWithDriver = {
  id: string;
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  asphaltPayloadTons: number;
  driverAssignments: {
    driver: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }[];
};

type BusyMap = Record<string, string>;

type OwnRow = {
  rowId: number;
  driverId: string;
  vehicleId: string;
  notes: string;
  tourCount: string;
  tonsPerTour: string;
  tourCountWasEdited: boolean;
  tonsPerTourWasEdited: boolean;
  startTime: string;
  endTime: string;
  asphaltNotes: string;
};

type SubRow = {
  rowId: number;
  vehicleCategory: string;
  subcontractorName: string;
  subcontractorNameCustom: string;
  notes: string;
  tourCount: string;
  tonsPerTour: string;
  startTime: string;
  endTime: string;
  asphaltNotes: string;
};

type Suggestion = {
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleLabel: string;
  payloadTons: number;
  tourCount: number;
  capacityTons: number;
  allocatedTons: number;
  overCapacityTons: number;
};

function formatTons(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseNumber(value: string) {
  const number = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isNaN(number) ? 0 : number;
}

function roundTons(value: number) {
  return Math.round(value * 100) / 100;
}

function getTotalTons(tourCount: string, tonsPerTour: string) {
  const tours = Math.max(0, Number.parseInt(tourCount || "0", 10) || 0);
  const tons = Math.max(0, parseNumber(tonsPerTour || "0"));

  return roundTons(tours * tons);
}

function getSuggestedTourCount(openTons: number, tonsPerTour: number) {
  if (openTons <= 0 || tonsPerTour <= 0) {
    return "1";
  }

  return String(Math.max(1, Math.ceil(openTons / tonsPerTour)));
}

function getPrimaryVehicle(driver: DriverWithVehicles | undefined) {
  if (!driver) {
    return undefined;
  }

  return (
    driver.vehicleAssignments.find((assignment) => assignment.isPrimary)
      ?.vehicle ?? driver.vehicleAssignments[0]?.vehicle
  );
}

function getPrimaryVehicleLabel(driver: DriverWithVehicles) {
  const vehicle = getPrimaryVehicle(driver);

  if (!vehicle) {
    return "kein Hauptfahrzeug";
  }

  return `${vehicle.licensePlate ?? "-"} · ${vehicle.category}`;
}

function getVehicleAssignment(vehicle: VehicleWithDriver | undefined) {
  return vehicle?.driverAssignments[0]?.driver;
}

function getVehicleAssignmentLabel(vehicle: VehicleWithDriver) {
  const assignedDriver = getVehicleAssignment(vehicle);

  if (!assignedDriver) {
    return "frei";
  }

  return `Stamm: ${assignedDriver.lastName}, ${assignedDriver.firstName}`;
}

function getVehicleLabel(vehicle: VehicleWithDriver | undefined) {
  if (!vehicle) {
    return "";
  }

  return `${vehicle.vehicleNumber} · ${vehicle.licensePlate ?? "-"} · ${
    vehicle.category
  } · ${vehicle.vehicleType}`;
}

function findDriverByName({
  drivers,
  firstName,
  lastName,
}: {
  drivers: DriverWithVehicles[];
  firstName: string;
  lastName: string;
}) {
  return drivers.find(
    (driver) => driver.firstName === firstName && driver.lastName === lastName,
  );
}

function getAssignedDriverForVehicle({
  vehicle,
  drivers,
}: {
  vehicle: VehicleWithDriver;
  drivers: DriverWithVehicles[];
}) {
  const assignedDriver = getVehicleAssignment(vehicle);

  if (assignedDriver?.id) {
    return drivers.find((driver) => driver.id === assignedDriver.id) ?? null;
  }

  if (assignedDriver) {
    return (
      findDriverByName({
        drivers,
        firstName: assignedDriver.firstName,
        lastName: assignedDriver.lastName,
      }) ?? null
    );
  }

  return (
    drivers.find((driver) => getPrimaryVehicle(driver)?.id === vehicle.id) ??
    null
  );
}

function DriverOptions({
  drivers,
  busyDrivers,
  busyVehicles,
  shortDriverConflicts = {},
  shortVehicleConflicts = {},
  unavailableDriverIds = new Set<string>(),
}: {
  drivers: DriverWithVehicles[];
  busyDrivers: BusyMap;
  busyVehicles: BusyMap;
  shortDriverConflicts?: BusyMap;
  shortVehicleConflicts?: BusyMap;
  unavailableDriverIds?: Set<string>;
}) {
  return (
    <>
      {drivers.map((driver) => {
        const driverConflict = busyDrivers[driver.id];
        const primaryVehicle = getPrimaryVehicle(driver);
        const primaryVehicleConflict = primaryVehicle
          ? busyVehicles[primaryVehicle.id]
          : undefined;

        const shortDriverConflict = shortDriverConflicts[driver.id];
        const shortVehicleConflict = primaryVehicle
          ? shortVehicleConflicts[primaryVehicle.id]
          : undefined;

        const duplicateConflict = unavailableDriverIds.has(driver.id)
          ? "bereits in dieser Einteilung"
          : undefined;

        const conflict =
          driverConflict ??
          primaryVehicleConflict ??
          shortDriverConflict ??
          shortVehicleConflict ??
          duplicateConflict;

        return (
          <option
            key={driver.id}
            value={driver.id}
            disabled={Boolean(conflict)}
          >
            {conflict ? "! " : ""}
            {driver.lastName}, {driver.firstName} ·{" "}
            {getPrimaryVehicleLabel(driver)}
            {driverConflict ? ` · bereits Langstrecke ${driverConflict}` : ""}
            {!driverConflict && primaryVehicleConflict
              ? ` · Hauptfahrzeug bereits Langstrecke ${primaryVehicleConflict}`
              : ""}
            {shortDriverConflict
              ? ` · bereits Kurzstrecke ${shortDriverConflict}`
              : ""}
            {!shortDriverConflict && shortVehicleConflict
              ? ` · Hauptfahrzeug bereits Kurzstrecke ${shortVehicleConflict}`
              : ""}
            {duplicateConflict ? ` · ${duplicateConflict}` : ""}
          </option>
        );
      })}
    </>
  );
}

function VehicleOptions({
  vehicles,
  busyVehicles,
  shortVehicleConflicts = {},
  unavailableVehicleIds = new Set<string>(),
}: {
  vehicles: VehicleWithDriver[];
  busyVehicles: BusyMap;
  shortVehicleConflicts?: BusyMap;
  unavailableVehicleIds?: Set<string>;
}) {
  return (
    <>
      {vehicles.map((vehicle) => {
        const vehicleConflict = busyVehicles[vehicle.id];
        const shortVehicleConflict = shortVehicleConflicts[vehicle.id];
        const duplicateConflict = unavailableVehicleIds.has(vehicle.id)
          ? "bereits in dieser Einteilung"
          : undefined;
        const conflict =
          vehicleConflict ?? shortVehicleConflict ?? duplicateConflict;
        const payloadText =
          vehicle.asphaltPayloadTons > 0
            ? ` · Nutzlast ${formatTons(vehicle.asphaltPayloadTons)} t`
            : "";

        return (
          <option
            key={vehicle.id}
            value={vehicle.id}
            disabled={Boolean(conflict)}
          >
            {conflict ? "! " : ""}
            {vehicleConflict ? `bereits Langstrecke ${vehicleConflict} · ` : ""}
            {!vehicleConflict && shortVehicleConflict
              ? `bereits Kurzstrecke ${shortVehicleConflict} · `
              : ""}
            {duplicateConflict ? `${duplicateConflict} · ` : ""}
            {getVehicleAssignmentLabel(vehicle)} · {vehicle.category} ·{" "}
            {vehicle.licensePlate ?? "-"} · Nr. {vehicle.vehicleNumber}
            {payloadText}
          </option>
        );
      })}
    </>
  );
}

function createEmptyOwnRow(rowId: number): OwnRow {
  return {
    rowId,
    driverId: "",
    vehicleId: "",
    notes: "",
    tourCount: "1",
    tonsPerTour: "",
    tourCountWasEdited: false,
    tonsPerTourWasEdited: false,
    startTime: "06:30",
    endTime: "17:00",
    asphaltNotes: "",
  };
}

function createEmptySubRow(rowId: number): SubRow {
  return {
    rowId,
    vehicleCategory: "",
    subcontractorName: "",
    subcontractorNameCustom: "",
    notes: "",
    tourCount: "1",
    tonsPerTour: "",
    startTime: "06:30",
    endTime: "17:00",
    asphaltNotes: "",
  };
}

export function InitialTruckRows({
  drivers,
  vehicles,
  vehicleCategories,
  subcontractors,
  busyDrivers = {},
  busyVehicles = {},
  shortDriverConflicts = {},
  shortVehicleConflicts = {},
}: {
  drivers: DriverWithVehicles[];
  vehicles: VehicleWithDriver[];
  vehicleCategories: string[];
  subcontractors: string[];
  busyDrivers?: BusyMap;
  busyVehicles?: BusyMap;
  shortDriverConflicts?: BusyMap;
  shortVehicleConflicts?: BusyMap;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [ownRows, setOwnRows] = useState<OwnRow[]>([createEmptyOwnRow(0)]);
  const [subRows, setSubRows] = useState<SubRow[]>([createEmptySubRow(0)]);
  const [selectedAsphaltOpenTons, setSelectedAsphaltOpenTons] = useState(0);
  const [selectedMaterialQuantity, setSelectedMaterialQuantity] = useState(0);
  const [autoPrefilledOpenTons, setAutoPrefilledOpenTons] = useState(0);

  const driversById = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers],
  );

  const vehiclesById = useMemo(
    () => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    [vehicles],
  );

  function readSelectedAsphaltOpenTonsFromForm() {
    const form = rootRef.current?.closest("form");
    const field = form?.elements.namedItem(
      "selectedAsphaltOpenTons",
    ) as HTMLInputElement | null;

    if (!field) {
      return 0;
    }

    return parseNumber(field.value || "0");
  }

  function readSelectedMaterialQuantityFromForm() {
    const form = rootRef.current?.closest("form");
    const field = form?.elements.namedItem(
      "materialQuantity",
    ) as HTMLInputElement | null;

    if (!field) {
      return 0;
    }

    return parseNumber(field.value || "0");
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSelectedAsphaltOpenTons(readSelectedAsphaltOpenTonsFromForm());
      setSelectedMaterialQuantity(readSelectedMaterialQuantityFromForm());
    }, 0);
    const form = rootRef.current?.closest("form");
    const materialQuantityField = form?.elements.namedItem(
      "materialQuantity",
    ) as HTMLInputElement | null;

    function handleOpenTonsChange(event: Event) {
      const customEvent = event as CustomEvent<{ openTons: number }>;
      setSelectedAsphaltOpenTons(
        roundTons(Number(customEvent.detail?.openTons ?? 0)),
      );
    }

    function handleMaterialQuantityChange() {
      setSelectedMaterialQuantity(
        roundTons(readSelectedMaterialQuantityFromForm()),
      );
    }

    window.addEventListener(
      "longhaul-asphalt-open-tons-change",
      handleOpenTonsChange,
    );
    materialQuantityField?.addEventListener(
      "input",
      handleMaterialQuantityChange,
    );
    materialQuantityField?.addEventListener(
      "change",
      handleMaterialQuantityChange,
    );

    return () => {
      window.removeEventListener(
        "longhaul-asphalt-open-tons-change",
        handleOpenTonsChange,
      );
      window.clearTimeout(timeoutId);
      materialQuantityField?.removeEventListener(
        "input",
        handleMaterialQuantityChange,
      );
      materialQuantityField?.removeEventListener(
        "change",
        handleMaterialQuantityChange,
      );
    };
  }, []);

  function getNextOwnRowId(rows: OwnRow[]) {
    return rows.length === 0
      ? 0
      : Math.max(...rows.map((row) => row.rowId)) + 1;
  }

  function getNextSubRowId(rows: SubRow[]) {
    return rows.length === 0
      ? 0
      : Math.max(...rows.map((row) => row.rowId)) + 1;
  }

  function addOwnRow() {
    setOwnRows((rows) => [...rows, createEmptyOwnRow(getNextOwnRowId(rows))]);
  }

  function addSubRow() {
    setSubRows((rows) => [...rows, createEmptySubRow(getNextSubRowId(rows))]);
  }

  function removeOwnRow(rowId: number) {
    setOwnRows((rows) =>
      rows.length === 1 ? rows : rows.filter((row) => row.rowId !== rowId),
    );
  }

  function removeSubRow(rowId: number) {
    setSubRows((rows) =>
      rows.length === 1 ? rows : rows.filter((row) => row.rowId !== rowId),
    );
  }

  function updateOwnRow(rowId: number, patch: Partial<OwnRow>) {
    setOwnRows((rows) =>
      rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  }

  function updateSubRow(rowId: number, patch: Partial<SubRow>) {
    setSubRows((rows) =>
      rows.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  }

  function getUnavailableDriverIds(currentRowId: number) {
    return new Set(
      ownRows
        .filter((row) => row.rowId !== currentRowId)
        .map((row) => row.driverId)
        .filter(Boolean),
    );
  }

  function getUnavailableVehicleIds(currentRowId: number) {
    return new Set(
      ownRows
        .filter((row) => row.rowId !== currentRowId)
        .map((row) => row.vehicleId)
        .filter(Boolean),
    );
  }

  function getEffectiveSelectedAsphaltOpenTons() {
    return roundTons(selectedAsphaltOpenTons);
  }

  function getEffectivePlanningTons() {
    const asphaltOpenTons = getEffectiveSelectedAsphaltOpenTons();

    if (asphaltOpenTons > 0) {
      return asphaltOpenTons;
    }

    return roundTons(selectedMaterialQuantity);
  }

  function getSuggestedOwnPerformancePatch({
    row,
    payloadTons,
  }: {
    row: OwnRow | undefined;
    payloadTons: number;
  }) {
    const planningTons = getEffectivePlanningTons();

    return {
      tonsPerTour:
        payloadTons > 0 && !row?.tonsPerTourWasEdited
          ? String(payloadTons)
          : row?.tonsPerTour ?? "",
      tourCount:
        payloadTons > 0 && planningTons > 0 && !row?.tourCountWasEdited
          ? getSuggestedTourCount(planningTons, payloadTons)
          : row?.tourCount ?? "1",
    };
  }

  function getAssignedOwnCapacityTons(rows: OwnRow[]) {
    return roundTons(
      rows.reduce((sum, row) => {
        if (!row.driverId || !row.vehicleId) {
          return sum;
        }

        return sum + getTotalTons(row.tourCount, row.tonsPerTour);
      }, 0),
    );
  }

  function getRemainingAsphaltOpenTons(rows: OwnRow[]) {
    const openTons = getEffectiveSelectedAsphaltOpenTons();
    const assignedCapacityTons = getAssignedOwnCapacityTons(rows);

    return roundTons(Math.max(0, openTons - assignedCapacityTons));
  }

  function buildBestSuggestionForOpenTons({
    rows,
    openTons,
  }: {
    rows: OwnRow[];
    openTons: number;
  }): Suggestion | null {
    if (openTons <= 0) {
      return null;
    }

    const selectedDriverIds = new Set(rows.map((row) => row.driverId).filter(Boolean));
    const selectedVehicleIds = new Set(rows.map((row) => row.vehicleId).filter(Boolean));

    const suggestions = vehicles
      .filter((vehicle) => vehicle.asphaltPayloadTons > 0)
      .filter((vehicle) => !busyVehicles[vehicle.id])
      .filter((vehicle) => !shortVehicleConflicts[vehicle.id])
      .filter((vehicle) => !selectedVehicleIds.has(vehicle.id))
      .map((vehicle) => {
        const assignedDriver = getAssignedDriverForVehicle({ vehicle, drivers });

        if (!assignedDriver) {
          return null;
        }

        if (
          busyDrivers[assignedDriver.id] ||
          shortDriverConflicts[assignedDriver.id] ||
          selectedDriverIds.has(assignedDriver.id)
        ) {
          return null;
        }

        const payloadTons = roundTons(vehicle.asphaltPayloadTons);
        const tourCount = Math.max(1, Math.ceil(openTons / payloadTons));
        const capacityTons = roundTons(tourCount * payloadTons);
        const allocatedTons = roundTons(Math.min(openTons, capacityTons));
        const overCapacityTons = roundTons(Math.max(0, capacityTons - openTons));

        return {
          driverId: assignedDriver.id,
          driverName: `${assignedDriver.lastName}, ${assignedDriver.firstName}`,
          vehicleId: vehicle.id,
          vehicleLabel: getVehicleLabel(vehicle),
          payloadTons,
          tourCount,
          capacityTons,
          allocatedTons,
          overCapacityTons,
        } satisfies Suggestion;
      })
      .filter((suggestion): suggestion is Suggestion => suggestion !== null)
      .sort((a, b) => {
        if (a.tourCount !== b.tourCount) return a.tourCount - b.tourCount;
        if (a.overCapacityTons !== b.overCapacityTons) {
          return a.overCapacityTons - b.overCapacityTons;
        }
        if (a.payloadTons !== b.payloadTons) return b.payloadTons - a.payloadTons;
        return a.vehicleLabel.localeCompare(b.vehicleLabel, "de-DE");
      });

    return suggestions[0] ?? null;
  }

  const remainingAsphaltOpenTons = getRemainingAsphaltOpenTons(ownRows);

  const visibleSuggestion = buildBestSuggestionForOpenTons({
    rows: ownRows,
    openTons: remainingAsphaltOpenTons,
  });

  const firstOwnRow = ownRows[0];
  const firstRowDriver = firstOwnRow?.driverId
    ? driversById.get(firstOwnRow.driverId)
    : undefined;
  const firstRowVehicle = firstOwnRow?.vehicleId
    ? vehiclesById.get(firstOwnRow.vehicleId)
    : undefined;
  const firstRowCapacityTons = firstOwnRow
    ? getTotalTons(firstOwnRow.tourCount, firstOwnRow.tonsPerTour)
    : 0;
  const firstRowAllocatedTons = roundTons(
    Math.min(firstRowCapacityTons, selectedAsphaltOpenTons),
  );
  const firstRowOverCapacityTons = roundTons(
    Math.max(0, firstRowCapacityTons - selectedAsphaltOpenTons),
  );
  const firstRowHasSuggestion = Boolean(
    selectedAsphaltOpenTons > 0 && firstRowDriver && firstRowVehicle,
  );

  const hasPendingOwnTruckRows = ownRows.some(
    (row) =>
      Boolean(row.driverId) ||
      Boolean(row.vehicleId) ||
      Boolean(row.notes.trim()) ||
      Boolean(row.asphaltNotes.trim()) ||
      Boolean(row.tonsPerTour.trim()) ||
      row.tourCount !== "1",
  );

  const canShowNextSuggestion = remainingAsphaltOpenTons > 0 && !hasPendingOwnTruckRows;

  useEffect(() => {
    if (selectedAsphaltOpenTons <= 0) {
      const timeoutId = window.setTimeout(() => {
        setAutoPrefilledOpenTons(0);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    if (!visibleSuggestion) {
      return;
    }

    if (autoPrefilledOpenTons === selectedAsphaltOpenTons) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOwnRows((rows) => {
        const firstRow = rows[0];

        if (!firstRow) {
          return rows;
        }

        const firstRowIsBlank =
          !firstRow.driverId &&
          !firstRow.vehicleId &&
          !firstRow.notes &&
          !firstRow.asphaltNotes &&
          !firstRow.tonsPerTour &&
          firstRow.tourCount === "1";

        if (!firstRowIsBlank) {
          return rows;
        }

        return rows.map((row, index) =>
          index === 0
            ? {
                ...row,
                driverId: visibleSuggestion.driverId,
                vehicleId: visibleSuggestion.vehicleId,
                tourCount: String(visibleSuggestion.tourCount),
                tonsPerTour: String(visibleSuggestion.payloadTons),
                tourCountWasEdited: false,
                tonsPerTourWasEdited: false,
                startTime: "06:30",
                endTime: "17:00",
                asphaltNotes: `Vorschlag · Kapazität ${formatTons(
                  visibleSuggestion.capacityTons,
                )} t · Zuteilung ${formatTons(
                  visibleSuggestion.allocatedTons,
                )} t`,
              }
            : row,
        );
      });

      setAutoPrefilledOpenTons(selectedAsphaltOpenTons);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [selectedAsphaltOpenTons, visibleSuggestion, autoPrefilledOpenTons]);

  useEffect(() => {
    const planningTons =
      selectedAsphaltOpenTons > 0
        ? roundTons(selectedAsphaltOpenTons)
        : roundTons(selectedMaterialQuantity);

    if (planningTons <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setOwnRows((rows) =>
        rows.map((row) => {
          if (!row.vehicleId) {
            return row;
          }

          const payloadTons =
            vehiclesById.get(row.vehicleId)?.asphaltPayloadTons ?? 0;

          if (payloadTons <= 0 || row.tourCountWasEdited) {
            return row;
          }

          return {
            ...row,
            tourCount: getSuggestedTourCount(planningTons, payloadTons),
            tonsPerTour:
              row.tonsPerTourWasEdited || row.tonsPerTour
                ? row.tonsPerTour
                : String(payloadTons),
          };
        }),
      );
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [selectedMaterialQuantity, selectedAsphaltOpenTons, vehiclesById]);

  function applyVisibleSuggestion() {
    setOwnRows((rows) => {
      const remainingOpenTons = getRemainingAsphaltOpenTons(rows);
      const suggestion = buildBestSuggestionForOpenTons({
        rows,
        openTons: remainingOpenTons,
      });

      if (!suggestion) {
        return [...rows, createEmptyOwnRow(getNextOwnRowId(rows))];
      }

      const emptyRow = rows.find(
        (row) =>
          !row.driverId &&
          !row.vehicleId &&
          !row.notes &&
          !row.asphaltNotes &&
          !row.tonsPerTour,
      );

      const targetRowId = emptyRow?.rowId ?? getNextOwnRowId(rows);
      const nextRow = {
        ...(emptyRow ?? createEmptyOwnRow(targetRowId)),
        driverId: suggestion.driverId,
        vehicleId: suggestion.vehicleId,
        tourCount: String(suggestion.tourCount),
        tonsPerTour: String(suggestion.payloadTons),
        startTime: "06:30",
        endTime: "17:00",
        asphaltNotes: `Vorschlag · Rest offen ${formatTons(
          remainingOpenTons,
        )} t · Kapazität ${formatTons(
          suggestion.capacityTons,
        )} t · Zuteilung ${formatTons(suggestion.allocatedTons)} t`,
      };

      if (emptyRow) {
        return rows.map((row) => (row.rowId === targetRowId ? nextRow : row));
      }

      return [...rows, nextRow];
    });
  }

  function handleDriverChange(rowId: number, driverId: string) {
    const driver = driversById.get(driverId);
    const primaryVehicle = getPrimaryVehicle(driver);
    const unavailableVehicleIds = getUnavailableVehicleIds(rowId);

    const vehicle =
      primaryVehicle &&
      !busyVehicles[primaryVehicle.id] &&
      !shortVehicleConflicts[primaryVehicle.id] &&
      !unavailableVehicleIds.has(primaryVehicle.id)
        ? vehiclesById.get(primaryVehicle.id)
        : undefined;

    const payloadTons = vehicle?.asphaltPayloadTons ?? 0;
    const currentRow = ownRows.find((row) => row.rowId === rowId);
    const performancePatch = getSuggestedOwnPerformancePatch({
      row: currentRow,
      payloadTons,
    });

    updateOwnRow(rowId, {
      driverId,
      vehicleId: vehicle?.id ?? "",
      ...performancePatch,
    });
  }

  function handleVehicleChange(rowId: number, vehicleId: string) {
    const vehicle = vehiclesById.get(vehicleId);
    const currentRow = ownRows.find((row) => row.rowId === rowId);
    const payloadTons = vehicle?.asphaltPayloadTons ?? 0;
    const performancePatch = getSuggestedOwnPerformancePatch({
      row: currentRow,
      payloadTons,
    });

    if (currentRow?.driverId) {
      updateOwnRow(rowId, {
        vehicleId,
        ...performancePatch,
      });
      return;
    }

    const unavailableDriverIds = getUnavailableDriverIds(rowId);
    const assignedDriver = getVehicleAssignment(vehicle);
    const matchedDriver = assignedDriver?.id
      ? driversById.get(assignedDriver.id)
      : assignedDriver
        ? findDriverByName({
            drivers,
            firstName: assignedDriver.firstName,
            lastName: assignedDriver.lastName,
          })
        : undefined;

    const driverId =
      matchedDriver &&
      !busyDrivers[matchedDriver.id] &&
      !shortDriverConflicts[matchedDriver.id] &&
      !unavailableDriverIds.has(matchedDriver.id)
        ? matchedDriver.id
        : "";

    updateOwnRow(rowId, {
      vehicleId,
      driverId,
      ...performancePatch,
    });
  }

  return (
    <div ref={rootRef} className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">LKW-STIX</div>
            <p className="mt-1 text-xs text-gray-500">
              Fahrer und Hauptfahrzeug werden automatisch miteinander
              übernommen. Touren und t/Tour werden direkt als geplante Leistung
              gespeichert. Die Tourenzahl wird aus Materialmenge und
              Fahrzeug-Nutzlast vorgeschlagen.
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="text-xs font-bold uppercase tracking-wide text-blue-900">
            Vorschlagsplanung Langstrecke
          </div>

          {selectedAsphaltOpenTons > 0 ? (
            firstRowHasSuggestion && firstOwnRow && firstRowDriver && firstRowVehicle ? (
              <div className="mt-2 text-xs text-blue-950">
                <div className="font-semibold text-gray-900">
                  LKW-STIX 1 ist mit dem Vorschlag vorausgefüllt.
                </div>
                <div className="mt-1">
                  {firstRowVehicle.vehicleNumber} · {firstRowVehicle.licensePlate ?? "-"} · {firstRowVehicle.category} · {firstRowVehicle.vehicleType}
                </div>
                <div className="mt-1">
                  Fahrer: <strong>{firstRowDriver.lastName}, {firstRowDriver.firstName}</strong>
                </div>
                <div className="mt-1">
                  Offen {formatTons(selectedAsphaltOpenTons)} t · Eingetragen {" "}
                  <strong>{firstOwnRow.tourCount} Touren</strong> × {" "}
                  <strong>{formatTons(parseNumber(firstOwnRow.tonsPerTour || "0"))} t</strong>
                  {" = "}
                  {formatTons(firstRowCapacityTons)} t Kapazität · Zuteilung {" "}
                  {formatTons(firstRowAllocatedTons)} t
                  {firstRowOverCapacityTons > 0
                    ? ` · Restkapazität ${formatTons(firstRowOverCapacityTons)} t`
                    : ""}
                </div>
                <div className="mt-2 rounded-lg border border-blue-200 bg-white p-2 text-[11px] font-medium text-blue-900">
                  Wichtig: Das ist derselbe Vorschlag wie unten in LKW-STIX 1.
                  Fahrer, Fahrzeug, Touren und t/Tour kannst du unten frei ändern.
                </div>
              </div>
            ) : visibleSuggestion && canShowNextSuggestion ? (
              <div className="mt-2 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 text-xs text-blue-950">
                  <div className="font-semibold text-gray-900">
                    {visibleSuggestion.vehicleLabel}
                  </div>
                  <div className="mt-1">
                    Fahrer: <strong>{visibleSuggestion.driverName}</strong>
                  </div>
                  <div className="mt-1">
                    Rest offen {formatTons(remainingAsphaltOpenTons)} t · Vorschlag {" "}
                    <strong>{visibleSuggestion.tourCount} Touren</strong> × {" "}
                    <strong>{formatTons(visibleSuggestion.payloadTons)} t</strong>
                    {" = "}
                    {formatTons(visibleSuggestion.capacityTons)} t Kapazität ·
                    Zuteilung {formatTons(visibleSuggestion.allocatedTons)} t
                    {visibleSuggestion.overCapacityTons > 0
                      ? ` · Restkapazität ${formatTons(
                          visibleSuggestion.overCapacityTons,
                        )} t`
                      : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={applyVisibleSuggestion}
                  className="shrink-0 rounded-lg bg-blue-900 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Vorschlag übernehmen
                </button>
              </div>
            ) : hasPendingOwnTruckRows ? (
              <div className="mt-2 rounded-lg border border-blue-200 bg-white p-2 text-xs font-medium text-blue-900">
                LKW-STIX 1 ist vorausgefüllt. Ändere unten Fahrer, Fahrzeug,
                Touren oder t/Tour. Wenn du schon vor dem Speichern einen
                weiteren LKW für die Restmenge eintragen willst, nutze den
                Button unten am Ende vom LKW-STIX-Block.
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-medium text-yellow-900">
                Keine freie STIX-Kombination mit Nutzlast und freiem zugeordneten Fahrer
                gefunden. Bitte manuell einteilen oder Inventar/Zuordnung prüfen.
              </div>
            )
          ) : (
            <>
              {selectedMaterialQuantity > 0 ? (
                <div className="mt-2 rounded-lg border border-blue-200 bg-white p-2 text-xs text-blue-950">
                  Materialmenge: <strong>{formatTons(selectedMaterialQuantity)} t</strong>. Wenn du unten einen LKW auswählst, werden Touren und t/Tour aus der hinterlegten Nutzlast vorgeschlagen.
                </div>
              ) : (
                <div className="mt-2 rounded-lg border border-blue-200 bg-white p-2 text-xs text-blue-950">
                  Oben Materialmenge eintragen oder bei Asphalt eine
                  Asphaltposition wählen. Danach werden Touren und t/Tour anhand
                  der LKW-Nutzlast vorgeschlagen.
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {ownRows.map((row, index) => {
            const selectedDriver = driversById.get(row.driverId);
            const selectedVehicle = vehiclesById.get(row.vehicleId);

            const primaryVehicle = getPrimaryVehicle(selectedDriver);
            const vehicleAssignedDriver = getVehicleAssignment(selectedVehicle);

            const driverSelectedButNoVehicle = Boolean(
              selectedDriver && !selectedVehicle,
            );

            const vehicleSelectedButNoDriver = Boolean(
              selectedVehicle && !selectedDriver,
            );

            const unavailableDriverIds = getUnavailableDriverIds(row.rowId);
            const unavailableVehicleIds = getUnavailableVehicleIds(row.rowId);

            const totalTons = getTotalTons(row.tourCount, row.tonsPerTour);

            return (
              <div
                key={`own-initial-${row.rowId}`}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-gray-600">
                    LKW-STIX {index + 1}
                  </div>

                  {ownRows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeOwnRow(row.rowId)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      entfernen
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-xs font-medium text-gray-700">
                    Fahrer
                    <select
                      name={`ownDriverId_${row.rowId}`}
                      value={row.driverId}
                      onChange={(event) =>
                        handleDriverChange(row.rowId, event.target.value)
                      }
                      className={
                        driverSelectedButNoVehicle || vehicleSelectedButNoDriver
                          ? "mt-1 w-full rounded-lg border border-yellow-400 bg-yellow-50 px-2 py-2 text-xs text-gray-900"
                          : "mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900"
                      }
                    >
                      <option value="">Fahrer wählen</option>
                      <DriverOptions
                        drivers={drivers}
                        busyDrivers={busyDrivers}
                        busyVehicles={busyVehicles}
                        shortDriverConflicts={shortDriverConflicts}
                        shortVehicleConflicts={shortVehicleConflicts}
                        unavailableDriverIds={unavailableDriverIds}
                      />
                    </select>
                  </label>

                  <label className="text-xs font-medium text-gray-700">
                    Fahrzeug
                    <select
                      name={`ownVehicleId_${row.rowId}`}
                      value={row.vehicleId}
                      onChange={(event) =>
                        handleVehicleChange(row.rowId, event.target.value)
                      }
                      className={
                        driverSelectedButNoVehicle || vehicleSelectedButNoDriver
                          ? "mt-1 w-full rounded-lg border border-yellow-400 bg-yellow-50 px-2 py-2 text-xs text-gray-900"
                          : "mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900"
                      }
                    >
                      <option value="">Inventarobjekt wählen</option>
                      <VehicleOptions
                        vehicles={vehicles}
                        busyVehicles={busyVehicles}
                        shortVehicleConflicts={shortVehicleConflicts}
                        unavailableVehicleIds={unavailableVehicleIds}
                      />
                    </select>
                  </label>

                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 md:col-span-2">
                    <div className="text-xs font-semibold text-orange-950">
                      Geplante Leistung
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
                      <label className="text-[11px] font-medium text-gray-700">
                        Touren
                        <input
                          name={`ownTourCount_${row.rowId}`}
                          type="number"
                          min="1"
                          value={row.tourCount}
                          onChange={(event) =>
                            updateOwnRow(row.rowId, {
                              tourCount: event.target.value,
                              tourCountWasEdited: true,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                        />
                      </label>

                      <label className="text-[11px] font-medium text-gray-700">
                        t / Tour
                        <input
                          name={`ownTonsPerTour_${row.rowId}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.tonsPerTour}
                          onChange={(event) =>
                            updateOwnRow(row.rowId, {
                              tonsPerTour: event.target.value,
                              tonsPerTourWasEdited: true,
                            })
                          }
                          placeholder="z.B. 18"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                        />
                      </label>

                      <label className="text-[11px] font-medium text-gray-700">
                        Beginn
                        <input
                          name={`ownStartTime_${row.rowId}`}
                          type="time"
                          value={row.startTime}
                          onChange={(event) =>
                            updateOwnRow(row.rowId, {
                              startTime: event.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                        />
                      </label>

                      <label className="text-[11px] font-medium text-gray-700">
                        Ende
                        <input
                          name={`ownEndTime_${row.rowId}`}
                          type="time"
                          value={row.endTime}
                          onChange={(event) =>
                            updateOwnRow(row.rowId, {
                              endTime: event.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                        />
                      </label>

                      <div className="rounded-lg bg-white p-2 text-[11px] font-semibold text-gray-900">
                        Gesamt
                        <div className="mt-1 text-sm">
                          {formatTons(totalTons)} t
                        </div>
                      </div>
                    </div>

                    <input
                      name={`ownAsphaltNotes_${row.rowId}`}
                      value={row.asphaltNotes}
                      onChange={(event) =>
                        updateOwnRow(row.rowId, {
                          asphaltNotes: event.target.value,
                        })
                      }
                      placeholder="Bemerkung zur geplanten Leistung optional"
                      className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                    />
                  </div>

                  <label className="text-xs font-medium text-gray-700 md:col-span-2">
                    Bemerkung LKW
                    <input
                      name={`ownNotes_${row.rowId}`}
                      value={row.notes}
                      onChange={(event) =>
                        updateOwnRow(row.rowId, {
                          notes: event.target.value,
                        })
                      }
                      placeholder="Bemerkung optional"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                    />
                  </label>
                </div>

                {selectedDriver ? (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
                    Fahrer gewählt:{" "}
                    <span className="font-semibold text-gray-900">
                      {selectedDriver.lastName}, {selectedDriver.firstName}
                    </span>
                    {" · "}
                    Hauptfahrzeug:{" "}
                    <span className="font-semibold text-gray-900">
                      {primaryVehicle
                        ? `${primaryVehicle.vehicleNumber} · ${
                            primaryVehicle.licensePlate ?? "-"
                          } · ${primaryVehicle.category}`
                        : "kein Hauptfahrzeug"}
                    </span>
                  </div>
                ) : null}

                {selectedVehicle ? (
                  <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
                    Fahrzeug gewählt:{" "}
                    <span className="font-semibold">
                      {getVehicleLabel(selectedVehicle)}
                    </span>
                    {selectedVehicle.asphaltPayloadTons > 0 ? (
                      <>
                        {" · "}
                        Nutzlast:{" "}
                        <span className="font-semibold">
                          {formatTons(selectedVehicle.asphaltPayloadTons)} t
                        </span>
                      </>
                    ) : null}
                    {vehicleAssignedDriver ? (
                      <>
                        {" · "}
                        Zugeordneter Fahrer:{" "}
                        <span className="font-semibold">
                          {vehicleAssignedDriver.lastName},{" "}
                          {vehicleAssignedDriver.firstName}
                        </span>
                      </>
                    ) : (
                      " · kein zugeordneter Fahrer hinterlegt"
                    )}
                  </div>
                ) : null}

                {driverSelectedButNoVehicle ? (
                  <div className="mt-2 rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-semibold text-yellow-900">
                    Fahrzeug zuweisen: Der gewählte Fahrer hat kein verfügbares
                    Hauptfahrzeug. Bitte rechts ein Fahrzeug auswählen.
                  </div>
                ) : null}

                {vehicleSelectedButNoDriver ? (
                  <div className="mt-2 rounded-lg border border-yellow-300 bg-yellow-50 p-2 text-xs font-semibold text-yellow-900">
                    Fahrer zuweisen: Für das gewählte Fahrzeug wurde kein
                    zugeordneten Fahrer übernommen. Bitte links einen Fahrer auswählen.
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-dashed border-gray-300 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-gray-600">
            {selectedAsphaltOpenTons > 0 ? (
              <>
                Restmenge im Formular: {formatTons(remainingAsphaltOpenTons)} t.
                Ein weiterer Vorschlag nutzt nur noch freie Fahrer/Fahrzeuge.
              </>
            ) : (
              <>Weiteren STIX-LKW manuell hinzufügen.</>
            )}
          </div>

          <button
            type="button"
            onClick={selectedAsphaltOpenTons > 0 ? applyVisibleSuggestion : addOwnRow}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            {selectedAsphaltOpenTons > 0 && remainingAsphaltOpenTons > 0
              ? "+ weiterer Vorschlag / LKW-STIX"
              : "+ LKW-STIX"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">Fremd-LKW</div>
            <p className="mt-1 text-xs text-gray-500">
              Pro Fremd-LKW eine Zeile ausfüllen. Fuhrunternehmen kann aus der
              Liste gewählt oder frei eingetragen werden.
            </p>
          </div>

          <button
            type="button"
            onClick={addSubRow}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
          >
            + Fremd-LKW
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {subRows.map((row, index) => {
            const totalTons = getTotalTons(row.tourCount, row.tonsPerTour);

            return (
              <div
                key={`sub-initial-${row.rowId}`}
                className="rounded-lg border border-gray-200 bg-white p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-gray-600">
                    Fremd-LKW {index + 1}
                  </div>

                  {subRows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeSubRow(row.rowId)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      entfernen
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-xs font-medium text-gray-700">
                    Fahrzeugkategorie
                    <select
                      name={`subVehicleCategory_${row.rowId}`}
                      value={row.vehicleCategory}
                      onChange={(event) =>
                        updateSubRow(row.rowId, {
                          vehicleCategory: event.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900"
                    >
                      <option value="">Fahrzeugkategorie wählen</option>
                      {vehicleCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-medium text-gray-700">
                    Fuhrunternehmen
                    <select
                      name={`subcontractorName_${row.rowId}`}
                      value={row.subcontractorName}
                      onChange={(event) =>
                        updateSubRow(row.rowId, {
                          subcontractorName: event.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900"
                    >
                      <option value="">Fuhrunternehmen wählen</option>
                      {subcontractors.map((company) => (
                        <option key={company} value={company}>
                          {company}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-medium text-gray-700 md:col-span-2">
                    Fuhrunternehmen frei
                    <input
                      name={`subcontractorNameCustom_${row.rowId}`}
                      value={row.subcontractorNameCustom}
                      onChange={(event) =>
                        updateSubRow(row.rowId, {
                          subcontractorNameCustom: event.target.value,
                        })
                      }
                      placeholder="oder frei eintragen"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                    />
                  </label>

                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 md:col-span-2">
                    <div className="text-xs font-semibold text-orange-950">
                      Geplante Leistung
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
                      <label className="text-[11px] font-medium text-gray-700">
                        Touren
                        <input
                          name={`subTourCount_${row.rowId}`}
                          type="number"
                          min="1"
                          value={row.tourCount}
                          onChange={(event) =>
                            updateSubRow(row.rowId, {
                              tourCount: event.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                        />
                      </label>

                      <label className="text-[11px] font-medium text-gray-700">
                        t / Tour
                        <input
                          name={`subTonsPerTour_${row.rowId}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.tonsPerTour}
                          onChange={(event) =>
                            updateSubRow(row.rowId, {
                              tonsPerTour: event.target.value,
                            })
                          }
                          placeholder="z.B. 20"
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                        />
                      </label>

                      <label className="text-[11px] font-medium text-gray-700">
                        Beginn
                        <input
                          name={`subStartTime_${row.rowId}`}
                          type="time"
                          value={row.startTime}
                          onChange={(event) =>
                            updateSubRow(row.rowId, {
                              startTime: event.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                        />
                      </label>

                      <label className="text-[11px] font-medium text-gray-700">
                        Ende
                        <input
                          name={`subEndTime_${row.rowId}`}
                          type="time"
                          value={row.endTime}
                          onChange={(event) =>
                            updateSubRow(row.rowId, {
                              endTime: event.target.value,
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                        />
                      </label>

                      <div className="rounded-lg bg-white p-2 text-[11px] font-semibold text-gray-900">
                        Gesamt
                        <div className="mt-1 text-sm">
                          {formatTons(totalTons)} t
                        </div>
                      </div>
                    </div>

                    <input
                      name={`subAsphaltNotes_${row.rowId}`}
                      value={row.asphaltNotes}
                      onChange={(event) =>
                        updateSubRow(row.rowId, {
                          asphaltNotes: event.target.value,
                        })
                      }
                      placeholder="Bemerkung zur geplanten Leistung optional"
                      className="mt-2 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                    />
                  </div>

                  <label className="text-xs font-medium text-gray-700 md:col-span-2">
                    Bemerkung Fremd-LKW
                    <input
                      name={`subNotes_${row.rowId}`}
                      value={row.notes}
                      onChange={(event) =>
                        updateSubRow(row.rowId, {
                          notes: event.target.value,
                        })
                      }
                      placeholder="Bemerkung optional"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs text-gray-900"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
