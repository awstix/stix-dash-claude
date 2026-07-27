"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";

type ProjectOption = {
  id: string;
  projectNumber: string;
  name: string;
};

type VehicleOption = {
  id: string;
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  driverAssignments?: {
    driver: {
      firstName: string;
      lastName: string;
    };
  }[];
};

type DriverOption = {
  id: string;
  firstName: string;
  lastName: string;
  vehicleAssignments?: {
    isPrimary: boolean;
    vehicle: {
      id: string;
      vehicleNumber: string;
      licensePlate: string | null;
      vehicleType: string;
      category: string;
    };
  }[];
};

export type TransportPurposeOption = {
  value: string;
  label: string;
  group: string;
  categoryId: string | null;
  categoryLabel: string;
  parentCategoryId: string | null;
  unit: string | null;
  searchText: string;
  kind: "CATEGORY" | "OBJECT";
};

type TourFormValue = {
  rowId: number;
  startTime: string;
  endTime: string;
  projectId: string;
  purposeType: string;
  itemGroup: string;
  itemId: string;
  itemSearch: string;
  customPurpose: string;
  quantity: string;
  quantityUnit: string;
  notes: string;
};

type ConflictMap = Record<string, string>;

function getPrimaryVehicle(driver: DriverOption | undefined) {
  if (!driver?.vehicleAssignments || driver.vehicleAssignments.length === 0) {
    return undefined;
  }

  return (
    driver.vehicleAssignments.find((assignment) => assignment.isPrimary)
      ?.vehicle ?? driver.vehicleAssignments[0]?.vehicle
  );
}

function getPrimaryVehicleLabel(driver: DriverOption) {
  const vehicle = getPrimaryVehicle(driver);

  if (!vehicle) {
    return "kein Hauptfahrzeug";
  }

  return `${vehicle.licensePlate ?? "-"} · ${vehicle.category}`;
}

function getVehicleAssignmentLabel(vehicle: VehicleOption) {
  const assignedDriver = vehicle.driverAssignments?.[0]?.driver;

  if (!assignedDriver) {
    return "frei";
  }

  return `Stamm: ${assignedDriver.lastName}, ${assignedDriver.firstName}`;
}

function getCategoryFilters(options: TransportPurposeOption[]) {
  const filters = new Map<
    string,
    {
      id: string;
      label: string;
      parentCategoryId: string | null;
    }
  >();

  for (const option of options) {
    if (option.kind !== "CATEGORY") continue;
    if (!option.categoryId) continue;

    filters.set(option.categoryId, {
      id: option.categoryId,
      label: option.categoryLabel,
      parentCategoryId: option.parentCategoryId,
    });
  }

  return Array.from(filters.values()).sort((a, b) => {
    if (a.parentCategoryId && !b.parentCategoryId) return 1;
    if (!a.parentCategoryId && b.parentCategoryId) return -1;

    return a.label.localeCompare(b.label, "de");
  });
}

function normalizePurposeType(value: string | null | undefined) {
  if (value === "MATERIAL" || value === "ASPHALT") {
    return "TRANSPORT_MATERIAL";
  }

  if (value === "TRANSPORT") {
    return "TRANSPORT_MACHINE";
  }

  if (value === "TRANSPORT_MATERIAL" || value === "TRANSPORT_MACHINE") {
    return value;
  }

  return "CUSTOM";
}

function getPurposeOptions({
  purposeType,
  materialTransportOptions,
  machineTransportOptions,
}: {
  purposeType: string;
  materialTransportOptions: TransportPurposeOption[];
  machineTransportOptions: TransportPurposeOption[];
}) {
  if (purposeType === "TRANSPORT_MATERIAL") {
    return materialTransportOptions;
  }

  if (purposeType === "TRANSPORT_MACHINE") {
    return machineTransportOptions;
  }

  return [];
}

function getDefaultUnitForPurpose({
  purposeType,
  itemId,
  materialTransportOptions,
  machineTransportOptions,
}: {
  purposeType: string;
  itemId: string;
  materialTransportOptions: TransportPurposeOption[];
  machineTransportOptions: TransportPurposeOption[];
}) {
  return (
    getPurposeOptions({
      purposeType,
      materialTransportOptions,
      machineTransportOptions,
    }).find((option) => option.value === itemId)?.unit ?? ""
  );
}

function getDefaultGroupForPurpose({
  purposeType,
  itemId,
  materialTransportOptions,
  machineTransportOptions,
}: {
  purposeType: string;
  itemId: string;
  materialTransportOptions: TransportPurposeOption[];
  machineTransportOptions: TransportPurposeOption[];
}) {
  const option = getPurposeOptions({
    purposeType,
    materialTransportOptions,
    machineTransportOptions,
  }).find((item) => item.value === itemId);

  return option?.categoryId ?? "";
}

function getFirstAvailableVehicleId({
  vehicles,
  shortVehicleConflicts,
  currentVehicleId,
}: {
  vehicles: VehicleOption[];
  shortVehicleConflicts: ConflictMap;
  currentVehicleId: string;
}) {
  if (currentVehicleId) {
    return currentVehicleId;
  }

  return vehicles.find((vehicle) => !shortVehicleConflicts[vehicle.id])?.id ?? "";
}

function getTimelinePrefillFromSearchParams(params: URLSearchParams) {
  if (params.get("fromTimeline") !== "1") {
    return null;
  }

  return {
    driverId: params.get("prefillDriverId") ?? "",
    vehicleId: params.get("prefillVehicleId") ?? "",
    startTime: params.get("prefillStartTime") ?? "",
    endTime: params.get("prefillEndTime") ?? "",
    editAssignmentId: params.get("editAssignmentId") ?? "",
    tourNumber: Number.parseInt(params.get("prefillTourNumber") ?? "1", 10),
    externalTourOffset: parseOptionalPositiveInt(
      params.get("prefillExternalTourOffset")
    ),
  };
}

function parseOptionalPositiveInt(value: string | null) {
  if (value === null) {
    return null;
  }

  const number = Number.parseInt(value, 10);

  return Number.isNaN(number) || number < 0 ? null : number;
}

function createEmptyTour(rowId: number, startTime = "", endTime = "") {
  return {
    rowId,
    startTime,
    endTime,
    projectId: "",
    purposeType: "CUSTOM",
    itemGroup: "",
    itemId: "",
    itemSearch: "",
    customPurpose: "",
    quantity: "",
    quantityUnit: "",
    notes: "",
  };
}

function timeToSortableNumber(value: string) {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 99999;
  }

  return hours * 60 + minutes;
}

function sortAndReindexTourRows(rows: TourFormValue[]) {
  return [...rows]
    .sort((a, b) => {
      const startDiff =
        timeToSortableNumber(a.startTime) - timeToSortableNumber(b.startTime);

      if (startDiff !== 0) {
        return startDiff;
      }

      return timeToSortableNumber(a.endTime) - timeToSortableNumber(b.endTime);
    })
    .map((row, index) => ({
      ...row,
      rowId: index,
    }));
}

export function ShortHaulForm({
  action,
  id,
  workDate,
  projects,
  vehicles,
  drivers,
  materialTransportOptions,
  machineTransportOptions,
  unitOptions,
  driverConflicts = {},
  vehicleConflicts = {},
  shortDriverConflicts = {},
  shortVehicleConflicts = {},
  defaultVehicleId = "",
  defaultDriverId = "",
  defaultNotes = "",
  defaultTourNumberOffset = 0,
  defaultTours = [
    {
      startTime: "07:00",
      endTime: "09:00",
      projectId: "",
      purposeType: "CUSTOM",
      itemId: "",
      customPurpose: "",
      quantity: "",
      quantityUnit: "",
      notes: "",
    },
  ],
}: {
  action: (formData: FormData) => void | Promise<void>;
  id?: string;
  workDate?: string;
  projects: ProjectOption[];
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  materialTransportOptions: TransportPurposeOption[];
  machineTransportOptions: TransportPurposeOption[];
  unitOptions: string[];
  driverConflicts?: ConflictMap;
  vehicleConflicts?: ConflictMap;
  shortDriverConflicts?: ConflictMap;
  shortVehicleConflicts?: ConflictMap;
  defaultVehicleId?: string;
  defaultDriverId?: string;
  defaultNotes?: string;
  defaultTourNumberOffset?: number;
  defaultTours?: {
    startTime: string;
    endTime: string;
    projectId: string;
    purposeType: string;
    itemId: string;
    customPurpose: string;
    quantity: string;
    quantityUnit: string;
    notes: string;
  }[];
}) {
  const searchParams = useSearchParams();
  const timelinePrefillKey = searchParams.toString();
  const timelinePrefill = useMemo(
    () =>
      getTimelinePrefillFromSearchParams(
        new URLSearchParams(timelinePrefillKey)
      ),
    [timelinePrefillKey]
  );
  const appliedTimelinePrefillKeyRef = useRef<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState(defaultDriverId);
  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultVehicleId);

  const [tourRows, setTourRows] = useState<TourFormValue[]>(
    defaultTours.length > 0
      ? defaultTours.map((tour, index) => ({
          rowId: index,
          startTime: tour.startTime,
          endTime: tour.endTime,
          projectId: tour.projectId,
          purposeType: normalizePurposeType(tour.purposeType),
          itemGroup: getDefaultGroupForPurpose({
            purposeType: normalizePurposeType(tour.purposeType),
            itemId: tour.itemId || "",
            materialTransportOptions,
            machineTransportOptions,
          }),
          itemId: tour.itemId || "",
          itemSearch: "",
          customPurpose: tour.customPurpose || "",
          quantity: tour.quantity || "",
          quantityUnit: tour.quantityUnit || "",
          notes: tour.notes || "",
        }))
      : [
          {
            rowId: 0,
            startTime: "07:00",
            endTime: "09:00",
            projectId: "",
            purposeType: "CUSTOM",
            itemGroup: "",
            itemId: "",
            itemSearch: "",
            customPurpose: "",
            quantity: "",
            quantityUnit: "",
            notes: "",
          },
        ]
  );
  const materialGroups = useMemo(
    () => getCategoryFilters(materialTransportOptions),
    [materialTransportOptions]
  );
  const machineGroups = useMemo(
    () => getCategoryFilters(machineTransportOptions),
    [machineTransportOptions]
  );

  useEffect(() => {
    if (appliedTimelinePrefillKeyRef.current === timelinePrefillKey) {
      return;
    }

    if (!timelinePrefill) {
      appliedTimelinePrefillKeyRef.current = timelinePrefillKey;
      return;
    }

    if (id && timelinePrefill.editAssignmentId !== id) {
      appliedTimelinePrefillKeyRef.current = timelinePrefillKey;
      return;
    }

    if (!id && timelinePrefill.editAssignmentId) {
      appliedTimelinePrefillKeyRef.current = timelinePrefillKey;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      let nextDriverId = timelinePrefill.driverId || defaultDriverId;
      let nextVehicleId = timelinePrefill.vehicleId || defaultVehicleId;

      if (nextDriverId && !nextVehicleId) {
        const driver = drivers.find((item) => item.id === nextDriverId);
        const primaryVehicle = getPrimaryVehicle(driver);

        if (
          primaryVehicle &&
          (!shortVehicleConflicts[primaryVehicle.id] ||
            primaryVehicle.id === defaultVehicleId)
        ) {
          nextVehicleId = primaryVehicle.id;
        }
      }

      if (nextVehicleId && !nextDriverId) {
        const vehicle = vehicles.find((item) => item.id === nextVehicleId);
        const assignedDriver = vehicle?.driverAssignments?.[0]?.driver;

        if (assignedDriver) {
          const matchedDriver = drivers.find(
            (driver) =>
              driver.firstName === assignedDriver.firstName &&
              driver.lastName === assignedDriver.lastName
          );

          if (
            matchedDriver &&
            (!shortDriverConflicts[matchedDriver.id] ||
              matchedDriver.id === defaultDriverId)
          ) {
            nextDriverId = matchedDriver.id;
          }
        }
      }

      if (nextDriverId) {
        setSelectedDriverId(nextDriverId);
      }

      if (nextVehicleId) {
        setSelectedVehicleId(nextVehicleId);
      }

      if (timelinePrefill.startTime || timelinePrefill.endTime) {
        setTourRows((rows) => {
          const existingRows =
            rows.length > 0 ? rows : [createEmptyTour(0, "07:00", "09:00")];

          if (id && timelinePrefill.editAssignmentId === id) {
            const alreadyHasPrefillTour = existingRows.some(
              (row) =>
                row.startTime === timelinePrefill.startTime &&
                row.endTime === timelinePrefill.endTime
            );

            if (alreadyHasPrefillTour) {
              return sortAndReindexTourRows(existingRows);
            }

            const nextRowId =
              existingRows.length === 0
                ? 0
                : Math.max(...existingRows.map((row) => row.rowId)) + 1;

            return sortAndReindexTourRows([
              ...existingRows,
              createEmptyTour(
                nextRowId,
                timelinePrefill.startTime || "",
                timelinePrefill.endTime || ""
              ),
            ]);
          }

          return sortAndReindexTourRows(
            existingRows.map((row, index) =>
              index === 0
                ? {
                    ...row,
                    startTime: timelinePrefill.startTime || row.startTime,
                    endTime: timelinePrefill.endTime || row.endTime,
                  }
                : row
            )
          );
        });
      }

      appliedTimelinePrefillKeyRef.current = timelinePrefillKey;
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    drivers,
    vehicles,
    id,
    defaultDriverId,
    defaultVehicleId,
    shortDriverConflicts,
    shortVehicleConflicts,
    timelinePrefill,
    timelinePrefillKey,
  ]);

  const selectedDriver = drivers.find(
    (driver) => driver.id === selectedDriverId
  );

  const selectedVehicle = vehicles.find(
    (vehicle) => vehicle.id === selectedVehicleId
  );
  const timelinePrefillDriverId = timelinePrefill?.driverId ?? "";
  const timelinePrefillVehicleId = timelinePrefill?.vehicleId ?? "";
  const timelineTourNumberOffset =
    timelinePrefill?.externalTourOffset ??
    (!id && timelinePrefill?.tourNumber && timelinePrefill.tourNumber > 1
      ? timelinePrefill.tourNumber - 1
      : defaultTourNumberOffset);

  const driverConflict = selectedDriverId
    ? driverConflicts[selectedDriverId]
    : undefined;

  const vehicleConflict = selectedVehicleId
    ? vehicleConflicts[selectedVehicleId]
    : undefined;

  const hasLongHaulConflict = Boolean(driverConflict || vehicleConflict);

  const missingVehicle = Boolean(selectedDriverId && !selectedVehicleId);
  const missingDriver = Boolean(!selectedDriverId);

  const submitDisabled =
    missingDriver || missingVehicle || hasLongHaulConflict;

  const conflictText = useMemo(() => {
    const parts = [];

    if (driverConflict) {
      parts.push(`Fahrer ist Langstrecke bei ${driverConflict} geplant.`);
    }

    if (vehicleConflict) {
      parts.push(`Fahrzeug ist Langstrecke bei ${vehicleConflict} geplant.`);
    }

    return parts.join(" ");
  }, [driverConflict, vehicleConflict]);

  function handleDriverChange(driverId: string) {
    setSelectedDriverId(driverId);

    const driver = drivers.find((item) => item.id === driverId);
    const primaryVehicle = getPrimaryVehicle(driver);

    if (
      primaryVehicle &&
      (!shortVehicleConflicts[primaryVehicle.id] ||
        primaryVehicle.id === selectedVehicleId ||
        primaryVehicle.id === defaultVehicleId)
    ) {
      setSelectedVehicleId(primaryVehicle.id);
      return;
    }

    if (selectedVehicleId) {
      return;
    }

    setSelectedVehicleId("");
  }

  function handleVehicleChange(vehicleId: string) {
    setSelectedVehicleId(vehicleId);
  }

  function useFirstAvailableVehicle() {
    const vehicleId = getFirstAvailableVehicleId({
      vehicles,
      shortVehicleConflicts,
      currentVehicleId: defaultVehicleId,
    });

    if (vehicleId) {
      setSelectedVehicleId(vehicleId);
    }
  }

  function addTourRow() {
    setTourRows((rows) => {
      const previousRow = rows[rows.length - 1];

      return [
        ...rows,
        {
          rowId: Math.max(...rows.map((row) => row.rowId)) + 1,
          startTime: previousRow?.endTime || "",
          endTime: "",
          projectId: "",
          purposeType: previousRow?.purposeType || "CUSTOM",
          itemGroup: "",
          itemId: "",
          itemSearch: "",
          customPurpose: "",
          quantity: "",
          quantityUnit: "",
          notes: "",
        },
      ];
    });
  }

  function removeTourRow(rowId: number) {
    setTourRows((rows) =>
      sortAndReindexTourRows(
        rows.length === 1 ? rows : rows.filter((row) => row.rowId !== rowId)
      )
    );
  }

  function updateTourRow(
    rowId: number,
    key: keyof Omit<TourFormValue, "rowId">,
    value: string
  ) {
    setTourRows((rows) =>
      rows.map((row) => {
        if (row.rowId !== rowId) {
          return row;
        }

        if (key === "purposeType") {
          return {
            ...row,
            purposeType: value,
            itemGroup: "",
            itemId: "",
            itemSearch: "",
            customPurpose: "",
            quantityUnit: "",
          };
        }

        if (key === "itemGroup") {
          return {
            ...row,
            itemGroup: value,
            itemId: "",
            itemSearch: "",
            quantityUnit: "",
          };
        }

        if (key === "itemSearch") {
          return {
            ...row,
            itemSearch: value,
          };
        }

        if (key === "itemId") {
          const defaultUnit = getDefaultUnitForPurpose({
            purposeType: row.purposeType,
            itemId: value,
            materialTransportOptions,
            machineTransportOptions,
          });

          return {
            ...row,
            itemGroup:
              row.itemGroup ||
              getDefaultGroupForPurpose({
                purposeType: row.purposeType,
                itemId: value,
                materialTransportOptions,
                machineTransportOptions,
              }),
            itemId: value,
            quantityUnit: row.quantityUnit || defaultUnit,
          };
        }

        return {
          ...row,
          [key]: value,
        };
      })
    );
  }

  return (
    <form action={action} className="mt-4 space-y-5">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {workDate ? (
        <input type="hidden" name="workDate" value={workDate} />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-gray-800">
          Fahrer
          <select
            name="driverId"
            required
            value={selectedDriverId}
            onChange={(event) => handleDriverChange(event.target.value)}
            className={
              driverConflict
                ? "mt-2 w-full rounded-xl border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-gray-900"
                : "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            }
          >
            <option value="" disabled>
              Fahrer wählen
            </option>

            {drivers.map((driver) => {
              const longConflict = driverConflicts[driver.id];
              const shortConflict = shortDriverConflicts[driver.id];
              const isCurrentDriver =
                driver.id === defaultDriverId ||
                driver.id === timelinePrefillDriverId;

              return (
                <option
                  key={driver.id}
                  value={driver.id}
                  disabled={Boolean(shortConflict) && !isCurrentDriver}
                >
                  {shortConflict && !isCurrentDriver
                    ? `bereits Kurzstrecke ${shortConflict} · `
                    : ""}
                  {shortConflict && isCurrentDriver
                    ? `aktuelle Einteilung · `
                    : ""}
                  {longConflict ? `⚠ Langstrecke ${longConflict} · ` : ""}
                  {driver.lastName}, {driver.firstName} ·{" "}
                  {getPrimaryVehicleLabel(driver)}
                </option>
              );
            })}
          </select>
        </label>

        <label className="text-sm font-medium text-gray-800">
          Inventarobjekt / Fahrzeug
          <select
            name="vehicleId"
            required
            value={selectedVehicleId}
            onChange={(event) => handleVehicleChange(event.target.value)}
            className={
              missingVehicle
                ? "mt-2 w-full rounded-xl border border-red-400 bg-red-50 px-3 py-2 text-sm text-gray-900"
                : vehicleConflict
                  ? "mt-2 w-full rounded-xl border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-gray-900"
                  : "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            }
          >
            <option value="" disabled>
              Inventarobjekt wählen
            </option>

            {vehicles.map((vehicle) => {
              const longConflict = vehicleConflicts[vehicle.id];
              const shortConflict = shortVehicleConflicts[vehicle.id];
              const isCurrentVehicle =
                vehicle.id === defaultVehicleId ||
                vehicle.id === timelinePrefillVehicleId;

              return (
                <option
                  key={vehicle.id}
                  value={vehicle.id}
                  disabled={Boolean(shortConflict) && !isCurrentVehicle}
                >
                  {shortConflict && !isCurrentVehicle
                    ? `bereits Kurzstrecke ${shortConflict} · `
                    : ""}
                  {shortConflict && isCurrentVehicle
                    ? `aktuelle Einteilung · `
                    : ""}
                  {longConflict ? `⚠ Langstrecke ${longConflict} · ` : ""}
                  {getVehicleAssignmentLabel(vehicle)} ·{" "}
                  {vehicle.vehicleNumber} · {vehicle.licensePlate ?? "-"} ·{" "}
                  {vehicle.category} · {vehicle.vehicleType}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {selectedDriver ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          Hauptfahrzeug-Vorschlag:{" "}
          <span className="font-semibold text-gray-900">
            {getPrimaryVehicleLabel(selectedDriver)}
          </span>
        </div>
      ) : null}

      {missingVehicle ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-semibold">Bitte Fahrzeug auswählen</div>
          <p className="mt-1 text-red-800">
            Der gewählte Fahrer hat kein automatisch gesetztes verfügbares
            Hauptfahrzeug. Bitte wähle rechts ein Fahrzeug aus.
          </p>

          <button
            type="button"
            onClick={useFirstAvailableVehicle}
            className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
          >
            Erstes freies Fahrzeug verwenden
          </button>
        </div>
      ) : null}

      {selectedVehicle ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          Gewähltes Fahrzeug:{" "}
          <span className="font-semibold text-gray-900">
            {selectedVehicle.vehicleNumber} ·{" "}
            {selectedVehicle.licensePlate ?? "-"} · {selectedVehicle.category} ·{" "}
            {selectedVehicle.vehicleType}
          </span>
        </div>
      ) : null}

      {hasLongHaulConflict ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4">
          <div className="text-sm font-semibold text-red-900">
            Fahrer/Fahrzeug bereits belegt
          </div>

          <p className="mt-1 text-sm text-red-800">{conflictText}</p>
          <p className="mt-2 text-xs font-semibold text-red-800">
            Doppelte feste Zuordnung ist erlaubt, aber in der LKW-Dispo
            darf derselbe Fahrer oder LKW am selben Tag nur einmal eingeteilt
            sein.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Touren</h3>
          <p className="mt-1 text-xs text-gray-500">
            Touren werden nach Beginn automatisch als Tour 1, Tour 2, Tour 3
            sortiert.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {tourRows.map((tour, index) => {
            const isLastTour = index === tourRows.length - 1;
            const hasItemGroup = tour.purposeType !== "CUSTOM";
            const categoryFilters =
              tour.purposeType === "TRANSPORT_MATERIAL"
                ? materialGroups
                : machineGroups;
            const purposeOptions = getPurposeOptions({
              purposeType: tour.purposeType,
              materialTransportOptions,
              machineTransportOptions,
            });
            const normalizedItemSearch = tour.itemSearch.trim().toLowerCase();
            const filteredPurposeOptions = purposeOptions.filter((option) => {
              if (option.kind !== "OBJECT") {
                return false;
              }

              const matchesGroup =
                !tour.itemGroup ||
                option.categoryId === tour.itemGroup ||
                option.parentCategoryId === tour.itemGroup;
              const matchesSearch =
                !normalizedItemSearch ||
                option.searchText.toLowerCase().includes(normalizedItemSearch);

              return matchesGroup && matchesSearch;
            });

            return (
              <div
                key={tour.rowId}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-900">
                    Tour {timelineTourNumberOffset + index + 1}
                  </div>

                  {tourRows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeTourRow(tour.rowId)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      entfernen
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-xs font-medium text-gray-700">
                    Beginn
                    <input
                      name={`tourStartTime_${tour.rowId}`}
                      type="time"
                      required
                      value={tour.startTime}
                      onChange={(event) =>
                        updateTourRow(
                          tour.rowId,
                          "startTime",
                          event.target.value
                        )
                      }
                      onBlur={() =>
                        setTourRows((rows) => sortAndReindexTourRows(rows))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="text-xs font-medium text-gray-700">
                    Ende
                    <input
                      name={`tourEndTime_${tour.rowId}`}
                      type="time"
                      required
                      value={tour.endTime}
                      onChange={(event) =>
                        updateTourRow(
                          tour.rowId,
                          "endTime",
                          event.target.value
                        )
                      }
                      onBlur={() =>
                        setTourRows((rows) => sortAndReindexTourRows(rows))
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="text-xs font-medium text-gray-700 md:col-span-2">
                    Baustelle
                    <select
                      name={`tourProjectId_${tour.rowId}`}
                      required
                      value={tour.projectId}
                      onChange={(event) =>
                        updateTourRow(
                          tour.rowId,
                          "projectId",
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
                    >
                      <option value="" disabled>
                        Baustelle wählen
                      </option>

                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.projectNumber} · {project.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-medium text-gray-700">
                    Zweck-Art
                    <select
                      name={`tourPurposeType_${tour.rowId}`}
                      value={tour.purposeType}
                      onChange={(event) =>
                        updateTourRow(
                          tour.rowId,
                          "purposeType",
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
                    >
                      <option value="TRANSPORT_MATERIAL">
                        Transport Material
                      </option>
                      <option value="TRANSPORT_MACHINE">
                        Transport Maschine
                      </option>
                      <option value="CUSTOM">Freier Zweck</option>
                    </select>
                  </label>

                  {hasItemGroup ? (
                    <label className="text-xs font-medium text-gray-700">
                      {tour.purposeType === "TRANSPORT_MATERIAL"
                        ? "Material-Kategorie"
                        : "Maschinen-/Objekt-Kategorie"}
                      <select
                        name={`tourItemGroup_${tour.rowId}`}
                        value={tour.itemGroup}
                        onChange={(event) =>
                          updateTourRow(
                            tour.rowId,
                            "itemGroup",
                            event.target.value
                          )
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
                      >
                        <option value="">
                          {tour.purposeType === "TRANSPORT_MATERIAL"
                            ? "Alle Materialkategorien"
                            : "Alle Maschinen-/Objektkategorien"}
                        </option>
                        {categoryFilters.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.parentCategoryId ? "↳ " : ""}
                            {category.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {hasItemGroup ? (
                    <label className="text-xs font-medium text-gray-700">
                      Suche in Auswahl
                      <input
                        value={tour.itemSearch}
                        onChange={(event) =>
                          updateTourRow(
                            tour.rowId,
                            "itemSearch",
                            event.target.value
                          )
                        }
                        placeholder="Objektnummer, Name, Kennzeichen, Kategorie…"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                      />
                    </label>
                  ) : null}

                  <label className="text-xs font-medium text-gray-700">
                    Auswahl
                    <select
                      name={`tourItemId_${tour.rowId}`}
                      value={tour.itemId}
                      onChange={(event) =>
                        updateTourRow(tour.rowId, "itemId", event.target.value)
                      }
                      disabled={tour.purposeType === "CUSTOM"}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">
                        {tour.purposeType === "CUSTOM"
                          ? "Nicht nötig"
                          : "Objekt wählen"}
                      </option>

                      {filteredPurposeOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                          {item.unit ? ` · ${item.unit}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  {tour.purposeType === "CUSTOM" ? (
                    <label className="text-xs font-medium text-gray-700">
                      Freier Zweck
                      <input
                        name={`tourCustomPurpose_${tour.rowId}`}
                        value={tour.customPurpose}
                        onChange={(event) =>
                          updateTourRow(
                            tour.rowId,
                            "customPurpose",
                            event.target.value
                          )
                        }
                        placeholder="z.B. Maschine, Sondermaterial, Rückladung"
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                      />
                    </label>
                  ) : null}

                  <label className="text-xs font-medium text-gray-700">
                    Menge
                    <input
                      name={`tourQuantity_${tour.rowId}`}
                      type="number"
                      step="0.01"
                      value={tour.quantity}
                      onChange={(event) =>
                        updateTourRow(
                          tour.rowId,
                          "quantity",
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="text-xs font-medium text-gray-700">
                    Einheit
                    <select
                      name={`tourQuantityUnit_${tour.rowId}`}
                      value={tour.quantityUnit}
                      onChange={(event) =>
                        updateTourRow(
                          tour.rowId,
                          "quantityUnit",
                          event.target.value
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900"
                    >
                      <option value="">Einheit</option>
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-medium text-gray-700 md:col-span-2">
                    Bemerkung Tour
                    <input
                      name={`tourNotes_${tour.rowId}`}
                      value={tour.notes}
                      onChange={(event) =>
                        updateTourRow(tour.rowId, "notes", event.target.value)
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900"
                    />
                  </label>
                </div>

                {isLastTour ? (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={addTourRow}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      + Tour
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <label className="block text-sm font-medium text-gray-800">
        Bemerkung zur Fahrer-/Fahrzeug-Einteilung
        <input
          name="notes"
          defaultValue={defaultNotes}
          className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

      {missingDriver ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          Bitte zuerst einen Fahrer auswählen.
        </div>
      ) : null}

      {missingVehicle ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
          Bitte zuerst ein Fahrzeug auswählen.
        </div>
      ) : null}

      {hasLongHaulConflict ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900">
          Fahrer oder LKW ist bereits am selben Tag eingeteilt. Bitte bestehende
          Einteilung ändern oder anderes Fahrzeug/Fahrer wählen.
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitDisabled}
        className={
          submitDisabled
            ? "inline-flex items-center justify-center gap-2 rounded-xl bg-gray-300 px-5 py-3 text-sm font-semibold text-gray-500"
            : "inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
        }
      >
        <ActionIcon name="save" className="h-4 w-4" />
        Speichern
      </button>
    </form>
  );
}
