import Link from "next/link";
import type { ReactNode } from "react";
import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import {
  DismissibleDetails,
  DismissibleDetailsCloseButton,
} from "@/components/DismissibleDetails";
import { prisma } from "@/lib/prisma";
import {
  createDriverVehicleAssignment,
  deleteDriverVehicleAssignment,
  normalizeDriverVehicleAssignments,
  updateDriverVehicleAssignment,
} from "./actions";
import { InventoryItemPicker } from "./InventoryItemPicker";

type FilterPrimary = "all" | "primary" | "secondary";
type AssignmentStatusFilter = "all" | "assigned" | "unassigned";
type SortMode =
  | "driverLastAsc"
  | "driverLastDesc"
  | "driverFirstAsc"
  | "driverFirstDesc"
  | "vehicleNumberAsc"
  | "vehicleNumberDesc"
  | "licensePlateAsc"
  | "vehicleTypeAsc"
  | "categoryAsc"
  | "primaryFirst";

type DriverVehiclesSearchParams = {
  q?: string;
  person?: string;
  vehicle?: string;
  vehicleNumber?: string;
  licensePlate?: string;
  vehicleType?: string;
  primary?: string;
  assignmentStatus?: string;
  category?: string;
  notes?: string;
  sort?: string;
};

type PersonOption = {
  value: string;
  driverId: string | null;
  label: string;
  subLabel: string;
  searchText: string;
};

function normalizeSearch(value: string | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeFilterText(value: string | undefined) {
  return String(value ?? "").trim();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getFilterPrimary(value: string | undefined): FilterPrimary {
  if (value === "primary" || value === "secondary") return value;
  return "all";
}

function getAssignmentStatusFilter(
  value: string | undefined,
): AssignmentStatusFilter {
  if (value === "assigned" || value === "unassigned") return value;
  return "all";
}

function getSortMode(value: string | undefined): SortMode {
  if (
    value === "driverLastDesc" ||
    value === "driverFirstAsc" ||
    value === "driverFirstDesc" ||
    value === "vehicleNumberAsc" ||
    value === "vehicleNumberDesc" ||
    value === "licensePlateAsc" ||
    value === "vehicleTypeAsc" ||
    value === "categoryAsc" ||
    value === "primaryFirst"
  ) {
    return value;
  }

  return "driverLastAsc";
}

function getVehicleLabel(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  isActive?: boolean;
}) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.category,
    vehicle.vehicleType,
    vehicle.isActive === false ? "inaktiv" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getInventoryItemLabel(item: {
  objectNumber: string | null;
  inventoryNumber: string | null;
  stixId: string | null;
  name: string;
  manufacturer: string | null;
  model: string | null;
  licensePlate: string | null;
  category?: {
    name: string;
    parentCategory?: {
      name: string;
    } | null;
  } | null;
  vehicle?: {
    vehicleNumber: string;
    licensePlate: string | null;
    vehicleType: string;
    category: string;
    isActive?: boolean;
  } | null;
}) {
  const categoryLabel = item.category?.parentCategory
    ? `${item.category.parentCategory.name} / ${item.category.name}`
    : item.category?.name;

  return [
    item.objectNumber,
    item.inventoryNumber,
    item.stixId,
    item.licensePlate ?? item.vehicle?.licensePlate,
    item.manufacturer,
    item.model,
    item.name,
    categoryLabel,
    item.vehicle?.isActive === false ? "inaktiv" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function getPositionLabel(employee: {
  positions: { positionLabel: string }[];
}) {
  return (
    employee.positions.map((position) => position.positionLabel).join(", ") ||
    "ohne Berufsgruppe"
  );
}

function includesFilter(source: unknown, filter: string) {
  if (!filter) return true;

  return String(source ?? "")
    .toLowerCase()
    .includes(filter);
}

function buildPersonFilterText({
  assignment,
  personOption,
}: {
  assignment: {
    driver: {
      firstName: string;
      lastName: string;
      shortcut: string | null;
      phone: string | null;
      employee: {
        mobilePhone: string | null;
      } | null;
    };
  };
  personOption: PersonOption | undefined;
}) {
  return [
    assignment.driver.lastName,
    assignment.driver.firstName,
    assignment.driver.shortcut,
    assignment.driver.phone,
    assignment.driver.employee?.mobilePhone,
    personOption?.subLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function buildVehicleFilterText(vehicle: {
  vehicleNumber: string;
  licensePlate: string | null;
  vehicleType: string;
  category: string;
  isActive?: boolean;
}) {
  return [
    vehicle.vehicleNumber,
    vehicle.licensePlate,
    vehicle.vehicleType,
    vehicle.category,
    getVehicleLabel(vehicle),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isDriverVehicleSelectableCategory(category: {
  useInTruckDispatchSelection?: boolean | null;
  parentCategory?: {
    useInTruckDispatchSelection?: boolean | null;
  } | null;
} | null) {
  return Boolean(
    category?.useInTruckDispatchSelection ||
      category?.parentCategory?.useInTruckDispatchSelection,
  );
}

function compareText(a: unknown, b: unknown) {
  return String(a ?? "").localeCompare(String(b ?? ""), "de-DE", {
    numeric: true,
    sensitivity: "base",
  });
}

function buildDriverVehiclesHref({
  params,
  overrides = {},
  hash = "zuordnungen",
}: {
  params: DriverVehiclesSearchParams;
  overrides?: Partial<Record<keyof DriverVehiclesSearchParams, string | null>>;
  hash?: string;
}) {
  const query = new URLSearchParams();
  const keys: (keyof DriverVehiclesSearchParams)[] = [
    "q",
    "person",
    "vehicle",
    "vehicleNumber",
    "licensePlate",
    "vehicleType",
    "primary",
    "assignmentStatus",
    "category",
    "notes",
    "sort",
  ];

  for (const key of keys) {
    const override = overrides[key];
    const value = override === undefined ? params[key] : override;

    if (value) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();

  return `/admin/driver-vehicles${queryString ? `?${queryString}` : ""}${
    hash ? `#${hash}` : ""
  }`;
}

export default async function DriverVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<DriverVehiclesSearchParams>;
}) {
  const params = await searchParams;
  const searchText = normalizeSearch(params.q);
  const filterPersonText = normalizeSearch(params.person);
  const filterVehicleText = normalizeSearch(params.vehicle);
  const filterVehicleNumber = normalizeSearch(params.vehicleNumber);
  const filterLicensePlate = normalizeSearch(params.licensePlate);
  const filterVehicleType = normalizeSearch(params.vehicleType);
  const filterPrimary = getFilterPrimary(params.primary);
  const filterAssignmentStatus = getAssignmentStatusFilter(
    params.assignmentStatus,
  );
  const filterCategory = normalizeFilterText(params.category);
  const filterNotes = normalizeSearch(params.notes);
  const sortMode = getSortMode(params.sort);
  const returnToAssignments = buildDriverVehiclesHref({ params });

  const [employees, drivers, inventoryItems, assignments] =
    await Promise.all([
    prisma.employee.findMany({
      where: {
        statusValue: "active",
      },
      include: {
        driver: true,
        positions: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),

    prisma.driver.findMany({
      where: {
        isActive: true,
      },
      include: {
        employee: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),

      prisma.inventoryItem.findMany({
        where: {
          vehicleId: {
            not: null,
          },
        },
        include: {
          category: {
            include: {
              parentCategory: true,
            },
          },
          responsibleEmployee: true,
          crewDefaultVehicles: {
            where: {
              isActive: true,
            },
            include: {
              crew: {
                include: {
                  members: {
                    include: {
                      employee: true,
                    },
                    orderBy: {
                      sortOrder: "asc",
                    },
                  },
                },
              },
            },
          },
          vehicle: true,
        },
        orderBy: [
          { objectNumber: "asc" },
          { inventoryNumber: "asc" },
          { name: "asc" },
        ],
      }),

      prisma.driverVehicleAssignment.findMany({
        where: {
          isActive: true,
          driver: {
            isActive: true,
          },
        },
        include: {
          driver: {
            include: {
              employee: true,
            },
          },
          vehicle: true,
          inventoryItem: {
            include: {
              category: {
                include: {
                  parentCategory: true,
                },
              },
              vehicle: true,
            },
          },
        },
        orderBy: [
          { isPrimary: "desc" },
          { driver: { lastName: "asc" } },
          { vehicle: { vehicleNumber: "asc" } },
        ],
      }),
    ]);

  const activeInventoryItems = inventoryItems.filter(
    (item) => item.status !== "DELETED" && item.vehicle?.isActive !== false,
  );
  const selectableInventoryItems = activeInventoryItems.filter((item) =>
    isDriverVehicleSelectableCategory(item.category),
  );

  const employeePersonOptions: PersonOption[] = employees.map((employee) => {
    const positionLabel = getPositionLabel(employee);

    return {
      value: `employee:${employee.id}`,
      driverId: employee.driverId,
      label: `${employee.lastName}, ${employee.firstName}`,
      subLabel: `Mitarbeiter · ${positionLabel}${
        employee.driverId ? "" : " · Fahrer wird beim Speichern angelegt"
      }`,
      searchText: [
        employee.lastName,
        employee.firstName,
        employee.mobilePhone,
        positionLabel,
        employee.driver?.shortcut,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  const employeeDriverIds = new Set(
    employees.map((employee) => employee.driverId).filter(Boolean),
  );

  const driverOnlyPersonOptions: PersonOption[] = drivers
    .filter((driver) => !employeeDriverIds.has(driver.id) && !driver.employee)
    .map((driver) => ({
      value: `driver:${driver.id}`,
      driverId: driver.id,
      label: `${driver.lastName}, ${driver.firstName}`,
      subLabel: driver.shortcut
        ? `Fahrer-Stamm · Kürzel: ${driver.shortcut}`
        : "Fahrer-Stamm ohne Mitarbeiter-Verknüpfung",
      searchText: [
        driver.lastName,
        driver.firstName,
        driver.shortcut,
        driver.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    }));

  const personOptions = [...employeePersonOptions, ...driverOnlyPersonOptions];

  const personOptionByDriverId = new Map(
    personOptions
      .filter((person) => person.driverId)
      .map((person) => [person.driverId as string, person]),
  );

  const inventoryItemByVehicleId = new Map(
    inventoryItems
      .filter((item) => item.vehicleId)
      .map((item) => [item.vehicleId as string, item]),
  );

  const vehicleCategories = Array.from(
    new Set(
      selectableInventoryItems
        .map((item) =>
          item.category?.parentCategory
            ? `${item.category.parentCategory.name} / ${item.category.name}`
            : item.category?.name,
        )
        .filter(isNonEmptyString),
    ),
  ).sort((a, b) => a.localeCompare(b, "de-DE"));

  const vehicleNumbers = Array.from(
    new Set(
      selectableInventoryItems
        .flatMap((item) => [
          item.objectNumber,
          item.inventoryNumber,
          item.stixId,
          item.vehicle?.vehicleNumber,
        ])
        .filter(isNonEmptyString),
    ),
  ).sort((a, b) => a.localeCompare(b, "de-DE", { numeric: true }));

  const vehicleTypes = Array.from(
    new Set(
      selectableInventoryItems
        .map((item) => item.vehicle?.vehicleType ?? item.category?.name)
        .filter(isNonEmptyString),
    ),
  ).sort((a, b) => a.localeCompare(b, "de-DE"));

  const activeAssignedInventoryItemIds = new Set<string>(
    assignments
      .map(
        (assignment) =>
          assignment.inventoryItemId ??
          inventoryItemByVehicleId.get(assignment.vehicleId)?.id,
      )
      .filter(isNonEmptyString),
  );

  const activeAssignedDriverIds = new Set(
    assignments.map((assignment) => assignment.driverId),
  );

  const freeInventoryItems = selectableInventoryItems.filter(
    (item) => !activeAssignedInventoryItemIds.has(item.id),
  );
  function getSuggestedResponsibleEmployeeId(
    item: (typeof activeInventoryItems)[number],
  ) {
    if (item.responsibleEmployeeId) {
      return item.responsibleEmployeeId;
    }

    const crewEmployees = item.crewDefaultVehicles
      .flatMap((assignment) =>
        assignment.crew.members.map((member) => member.employee),
      )
      .filter((employee) => employee.statusValue === "active");
    const uniqueEmployeeIds = new Set(crewEmployees.map((employee) => employee.id));

    return uniqueEmployeeIds.size === 1 ? crewEmployees[0]?.id ?? null : null;
  }

  function getSuggestedResponsibleEmployeeName(
    item: (typeof activeInventoryItems)[number],
  ) {
    if (item.responsibleEmployee) {
      return `${item.responsibleEmployee.lastName}, ${item.responsibleEmployee.firstName}`;
    }

    const suggestedEmployeeId = getSuggestedResponsibleEmployeeId(item);
    const suggestedEmployee = item.crewDefaultVehicles
      .flatMap((assignment) =>
        assignment.crew.members.map((member) => member.employee),
      )
      .find((employee) => employee.id === suggestedEmployeeId);

    return suggestedEmployee
      ? `${suggestedEmployee.lastName}, ${suggestedEmployee.firstName}`
      : null;
  }

  const assignmentByInventoryItemId = new Map(
    assignments
      .map((assignment) => {
        const inventoryItemId =
          assignment.inventoryItemId ??
          inventoryItemByVehicleId.get(assignment.vehicleId)?.id;

        return inventoryItemId ? [inventoryItemId, assignment] : null;
      })
      .filter((entry): entry is [string, (typeof assignments)[number]] =>
        Boolean(entry),
      ),
  );
  const assignedInventoryItemInfo = new Map<string, string>(
    activeInventoryItems
      .map((item) => {
        const responsibleName = getSuggestedResponsibleEmployeeName(item);
        const assignment = assignmentByInventoryItemId.get(item.id);
        const assignmentName = assignment
          ? `${assignment.driver.lastName}, ${assignment.driver.firstName}`
          : null;

        return responsibleName || assignmentName
          ? [item.id, responsibleName ?? assignmentName ?? ""]
          : null;
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );

  function getInventorySelectOptions(currentInventoryItemId?: string) {
    if (!currentInventoryItemId) {
      return selectableInventoryItems;
    }

    if (
      selectableInventoryItems.some((item) => item.id === currentInventoryItemId)
    ) {
      return selectableInventoryItems;
    }

    const currentItem = activeInventoryItems.find(
      (item) => item.id === currentInventoryItemId,
    );

    return currentItem ? [currentItem, ...selectableInventoryItems] : selectableInventoryItems;
  }

  function inventoryItemMatchesFilters(item: (typeof activeInventoryItems)[number]) {
    const categoryLabel = item.category?.parentCategory
      ? `${item.category.parentCategory.name} / ${item.category.name}`
      : item.category?.name ?? "";
    const assigned = activeAssignedInventoryItemIds.has(item.id);

    if (filterAssignmentStatus === "assigned" && !assigned) return false;
    if (filterAssignmentStatus === "unassigned" && assigned) return false;
    if (filterCategory && categoryLabel !== filterCategory) return false;
    if (
      filterVehicleType &&
      ![item.vehicle?.vehicleType, item.category?.name, item.category?.parentCategory?.name].some(
        (value) => includesFilter(value, filterVehicleType),
      )
    ) {
      return false;
    }
    if (
      filterVehicleNumber &&
      ![item.objectNumber, item.inventoryNumber, item.stixId, item.vehicle?.vehicleNumber].some(
        (value) => includesFilter(value, filterVehicleNumber),
      )
    ) {
      return false;
    }
    if (
      filterLicensePlate &&
      ![item.licensePlate, item.vehicle?.licensePlate].some((value) =>
        includesFilter(value, filterLicensePlate),
      )
    ) {
      return false;
    }
    if (filterVehicleText && !getInventoryItemLabel(item).toLowerCase().includes(filterVehicleText)) {
      return false;
    }
    if (searchText) {
      const haystack = [
        getInventoryItemLabel(item),
        item.objectNumber,
        item.inventoryNumber,
        item.stixId,
        item.licensePlate,
        item.vehicle?.licensePlate,
        item.vehicle?.vehicleNumber,
        item.vehicle?.vehicleType,
        item.vehicle?.category,
        item.category?.name,
        item.category?.parentCategory?.name,
        activeAssignedInventoryItemIds.has(item.id) ? "zugeordnet vergeben" : "frei nicht zugeordnet",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(searchText)) return false;
    }

    return true;
  }

  const filteredInventoryItems = selectableInventoryItems.filter(
    inventoryItemMatchesFilters,
  );

  const peopleWithoutVehicle = personOptions.filter(
    (person) =>
      !person.driverId || !activeAssignedDriverIds.has(person.driverId),
  );

  const duplicatePrimaryAssignmentGroups = Array.from(
    assignments
      .filter((assignment) => assignment.isPrimary)
      .reduce((groups, assignment) => {
        const driverAssignments = groups.get(assignment.driverId) ?? [];
        driverAssignments.push(assignment);
        groups.set(assignment.driverId, driverAssignments);
        return groups;
      }, new Map<string, typeof assignments>())
      .values(),
  ).filter((driverAssignments) => driverAssignments.length > 1);

  const duplicatePrimaryDriverIds = new Set(
    duplicatePrimaryAssignmentGroups.map(
      (driverAssignments) => driverAssignments[0]?.driverId,
    ),
  );

  const filteredAssignments = assignments.filter((assignment) => {
    const assignmentInventoryItem =
      assignment.inventoryItem ??
      inventoryItemByVehicleId.get(assignment.vehicleId) ??
      null;
    const assignmentCategoryLabel = assignmentInventoryItem?.category?.parentCategory
      ? `${assignmentInventoryItem.category.parentCategory.name} / ${assignmentInventoryItem.category.name}`
      : assignmentInventoryItem?.category?.name ?? assignment.vehicle.category;

    if (filterPrimary === "primary" && !assignment.isPrimary) return false;
    if (filterPrimary === "secondary" && assignment.isPrimary) return false;
    if (filterAssignmentStatus === "unassigned") return false;
    if (filterCategory && assignmentCategoryLabel !== filterCategory) {
      return false;
    }

    const personOption = personOptionByDriverId.get(assignment.driverId);
    const personFilterText = buildPersonFilterText({
      assignment,
      personOption,
    });
    const vehicleFilterText = [
      assignmentInventoryItem
        ? getInventoryItemLabel(assignmentInventoryItem)
        : getVehicleLabel(assignment.vehicle),
      buildVehicleFilterText(assignment.vehicle),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (filterPersonText && !personFilterText.includes(filterPersonText)) {
      return false;
    }

    if (filterVehicleText && !vehicleFilterText.includes(filterVehicleText)) {
      return false;
    }

    if (
      filterVehicleNumber &&
      ![
        assignmentInventoryItem?.objectNumber,
        assignmentInventoryItem?.inventoryNumber,
        assignmentInventoryItem?.stixId,
        assignment.vehicle.vehicleNumber,
      ].some((value) => includesFilter(value, filterVehicleNumber))
    ) {
      return false;
    }

    if (
      filterLicensePlate &&
      ![
        assignmentInventoryItem?.licensePlate,
        assignment.vehicle.licensePlate,
      ].some((value) => includesFilter(value, filterLicensePlate))
    ) {
      return false;
    }

    if (
      filterVehicleType &&
      ![
        assignment.vehicle.vehicleType,
        assignmentInventoryItem?.category?.name,
        assignmentInventoryItem?.category?.parentCategory?.name,
      ].some((value) => includesFilter(value, filterVehicleType))
    ) {
      return false;
    }

    if (filterNotes && !includesFilter(assignment.notes, filterNotes)) {
      return false;
    }

    if (!searchText) return true;

    const haystack = [
      assignment.driver.lastName,
      assignment.driver.firstName,
      assignment.driver.shortcut,
      assignment.driver.phone,
      assignment.driver.employee?.mobilePhone,
      personOption?.label,
      personOption?.subLabel,
      personOption?.searchText,
      assignmentInventoryItem
        ? getInventoryItemLabel(assignmentInventoryItem)
        : getVehicleLabel(assignment.vehicle),
      assignment.vehicle.vehicleNumber,
      assignment.vehicle.licensePlate,
      assignment.vehicle.vehicleType,
      assignmentCategoryLabel,
      assignment.isPrimary
        ? "hauptfahrzeug ja primär primary"
        : "kein hauptfahrzeug nein zweitfahrzeug secondary",
      assignment.notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(searchText);
  });

  const sortedAssignments = [...filteredAssignments].sort((a, b) => {
    if (sortMode === "driverLastDesc") {
      return (
        compareText(b.driver.lastName, a.driver.lastName) ||
        compareText(b.driver.firstName, a.driver.firstName) ||
        compareText(a.vehicle.vehicleNumber, b.vehicle.vehicleNumber)
      );
    }

    if (sortMode === "driverFirstAsc") {
      return (
        compareText(a.driver.firstName, b.driver.firstName) ||
        compareText(a.driver.lastName, b.driver.lastName) ||
        compareText(a.vehicle.vehicleNumber, b.vehicle.vehicleNumber)
      );
    }

    if (sortMode === "driverFirstDesc") {
      return (
        compareText(b.driver.firstName, a.driver.firstName) ||
        compareText(b.driver.lastName, a.driver.lastName) ||
        compareText(a.vehicle.vehicleNumber, b.vehicle.vehicleNumber)
      );
    }

    if (sortMode === "vehicleNumberAsc") {
      return (
        compareText(a.vehicle.vehicleNumber, b.vehicle.vehicleNumber) ||
        compareText(a.driver.lastName, b.driver.lastName)
      );
    }

    if (sortMode === "vehicleNumberDesc") {
      return (
        compareText(b.vehicle.vehicleNumber, a.vehicle.vehicleNumber) ||
        compareText(a.driver.lastName, b.driver.lastName)
      );
    }

    if (sortMode === "licensePlateAsc") {
      return (
        compareText(a.vehicle.licensePlate, b.vehicle.licensePlate) ||
        compareText(a.driver.lastName, b.driver.lastName)
      );
    }

    if (sortMode === "vehicleTypeAsc") {
      return (
        compareText(a.vehicle.vehicleType, b.vehicle.vehicleType) ||
        compareText(a.vehicle.category, b.vehicle.category) ||
        compareText(a.vehicle.vehicleNumber, b.vehicle.vehicleNumber)
      );
    }

    if (sortMode === "categoryAsc") {
      return (
        compareText(a.vehicle.category, b.vehicle.category) ||
        compareText(a.vehicle.vehicleType, b.vehicle.vehicleType) ||
        compareText(a.vehicle.vehicleNumber, b.vehicle.vehicleNumber)
      );
    }

    if (sortMode === "primaryFirst") {
      return (
        Number(b.isPrimary) - Number(a.isPrimary) ||
        compareText(a.driver.lastName, b.driver.lastName) ||
        compareText(a.driver.firstName, b.driver.firstName)
      );
    }

    return (
      compareText(a.driver.lastName, b.driver.lastName) ||
      compareText(a.driver.firstName, b.driver.firstName) ||
      compareText(a.vehicle.vehicleNumber, b.vehicle.vehicleNumber)
    );
  });

  const freeAssignmentTableItems =
    filterAssignmentStatus !== "assigned" &&
    filterPrimary === "all" &&
    !filterPersonText &&
    !filterNotes
      ? filteredInventoryItems
          .filter((item) => !activeAssignedInventoryItemIds.has(item.id))
          .sort((a, b) => {
            if (sortMode === "vehicleNumberDesc") {
              return compareText(b.objectNumber, a.objectNumber);
            }

            if (sortMode === "vehicleTypeAsc") {
              return (
                compareText(a.vehicle?.vehicleType, b.vehicle?.vehicleType) ||
                compareText(a.category?.name, b.category?.name) ||
                compareText(a.objectNumber, b.objectNumber)
              );
            }

            if (sortMode === "categoryAsc") {
              const categoryA = a.category?.parentCategory
                ? `${a.category.parentCategory.name} / ${a.category.name}`
                : a.category?.name;
              const categoryB = b.category?.parentCategory
                ? `${b.category.parentCategory.name} / ${b.category.name}`
                : b.category?.name;

              return (
                compareText(categoryA, categoryB) ||
                compareText(a.objectNumber, b.objectNumber)
              );
            }

            return compareText(a.objectNumber, b.objectNumber);
          })
      : [];
  const visibleAssignmentRowCount =
    sortedAssignments.length + freeAssignmentTableItems.length;

  const hasActiveFilters = Boolean(
    searchText ||
      filterPersonText ||
      filterVehicleText ||
      filterVehicleNumber ||
      filterLicensePlate ||
      filterVehicleType ||
      filterPrimary !== "all" ||
      filterAssignmentStatus !== "all" ||
      filterCategory ||
      filterNotes,
  );
  const hasActiveTableSettings = hasActiveFilters || sortMode !== "driverLastAsc";

  return (
    <AppShell
      title="Fahrer-Fahrzeug-Zuordnung"
      description="Feste Fahrzeuge, freie Fahrzeuge und Fahrer-Fahrzeug-Zuordnungen für Langstrecke und Kurzstrecke verwalten. Mitarbeiter ohne Fahrerdatensatz werden beim Speichern automatisch angelegt."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard
          label="Zuordnungen"
          value={String(assignments.length)}
          hint="aktive Mitarbeiter/Fahrer mit festem Fahrzeug"
        />

        <SummaryCard
          label="Freie Inventarobjekte"
          value={String(freeInventoryItems.length)}
          hint="Aktive Inventarobjekte ohne feste Zuordnung"
        />

        <SummaryCard
          label="Ohne Fahrzeug"
          value={String(peopleWithoutVehicle.length)}
          hint="Aktive Mitarbeiter/Fahrer ohne Zuordnung"
        />

        <SummaryCard
          label="Gefiltert"
          value={String(filteredAssignments.length)}
          hint="sichtbare Tabellenzeilen"
        />
      </div>

      {duplicatePrimaryAssignmentGroups.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-base font-bold text-amber-950">
                Zuordnung prüfen: mehrere Hauptfahrzeuge
              </h2>
              <p className="mt-1 text-sm text-amber-900">
                Pro Fahrer darf nur ein aktives Hauptfahrzeug gesetzt sein.
                Weitere Fahrzeuge bleiben als normale Zuordnung möglich, werden
                aber nicht als Hauptfahrzeug verwendet.
              </p>

              <div className="mt-3 space-y-2 text-sm text-amber-950">
                {duplicatePrimaryAssignmentGroups.map((driverAssignments) => {
                  const driver = driverAssignments[0]?.driver;

                  return (
                    <div key={driverAssignments[0]?.driverId}>
                      <span className="font-semibold">
                        {driver?.lastName}, {driver?.firstName}:
                      </span>{" "}
                      {driverAssignments
                        .map((assignment) => {
                          const item =
                            assignment.inventoryItem ??
                            inventoryItemByVehicleId.get(assignment.vehicleId);

                          return item
                            ? getInventoryItemLabel(item)
                            : getVehicleLabel(assignment.vehicle);
                        })
                        .join(" · ")}
                    </div>
                  );
                })}
              </div>
            </div>

            <form action={normalizeDriverVehicleAssignments}>
              <input type="hidden" name="returnTo" value={returnToAssignments} />
              <button
                type="submit"
                className="rounded-xl bg-amber-900 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Hauptfahrzeuge bereinigen
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div
        id="new-driver-vehicle"
        className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-xl font-semibold text-gray-900">
          Neue Zuordnung anlegen
        </h2>

        <form
          action={createDriverVehicleAssignment}
          className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5"
        >
          <input
            type="hidden"
            name="returnTo"
            value="/admin/driver-vehicles#new-driver-vehicle"
          />
          <PersonSelect
            name="driverPersonId"
            label="Mitarbeiter / Fahrer"
            options={personOptions}
            defaultValue=""
            required
          />

            <InventoryItemPicker
              name="inventoryItemId"
              label="Inventarobjekt / Fahrzeug"
              options={selectableInventoryItems}
              assignedInventoryItemIds={Array.from(activeAssignedInventoryItemIds)}
              assignedInventoryItemInfoEntries={Array.from(
                assignedInventoryItemInfo.entries(),
              )}
              defaultValue=""
              required
              className="lg:col-span-2"
            />

          <label className="text-sm font-medium text-gray-800">
            Bemerkung
            <input
              name="notes"
              placeholder="z.B. Hauptfahrzeug"
              className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
            />
          </label>

          <div className="flex flex-col justify-end gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                name="isPrimary"
                defaultChecked
                className="h-4 w-4"
              />
              Hauptfahrzeug
            </label>

            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Zuordnung speichern
            </button>
          </div>
        </form>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Schnellsuche
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Ein Feld für alles: Mitarbeiter/Fahrer, Objekt-ID,
              Kennzeichen, Typ, Kategorie, Hauptfahrzeug oder
              Bemerkung.
            </p>
          </div>

          {hasActiveFilters ? (
            <Link
              href="/admin/driver-vehicles#zuordnungen"
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Suche zurücksetzen
            </Link>
          ) : null}
        </div>

        <form action="/admin/driver-vehicles#zuordnungen" className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(320px,1fr)_auto] lg:items-end">
            <label className="text-sm font-medium text-gray-800">
              Schnellsuche
              <input
                name="q"
                defaultValue={params.q ?? ""}
                autoFocus
                placeholder="Alles durchsuchen: Müller, AB-ST, 101, Bagger, Hauptfahrzeug ..."
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
              >
                Suchen
              </button>

              {hasActiveFilters ? (
                <Link
                  href="/admin/driver-vehicles#zuordnungen"
                  className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      <div
        id="zuordnungen"
        className="mb-6 overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <div className="relative flex flex-col gap-3 border-b border-gray-200 bg-gray-50 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Bestehende Zuordnungen
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Fahrer/Mitarbeiter, Fahrzeug, Hauptfahrzeug und Bemerkung können
              direkt in der Zeile geändert werden.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-gray-600">
              {visibleAssignmentRowCount} von{" "}
              {assignments.length + freeInventoryItems.length} sichtbar
            </div>

            <DriverVehicleFilterPopover
              params={params}
              vehicleCategories={vehicleCategories}
              vehicleNumbers={vehicleNumbers}
              vehicleTypes={vehicleTypes}
              filterCategory={filterCategory}
              filterPrimary={filterPrimary}
              filterAssignmentStatus={filterAssignmentStatus}
              sortMode={sortMode}
              hasActiveTableSettings={hasActiveTableSettings}
            />
          </div>
        </div>

        <div className="overflow-visible">
          <table className="w-full table-fixed text-left text-xs">
            <colgroup>
              <col className="w-[7%]" />
              <col className="w-[19%]" />
              <col className="w-[29%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="sticky top-16 z-20 bg-gray-50 text-gray-800 shadow-sm">
              <tr>
                <th className="border-r border-gray-200 bg-gray-50 p-3 text-center font-semibold">
                  Aktion
                </th>
                <Th>Mitarbeiter / Fahrer</Th>
                <Th>Fahrzeug / Kombination</Th>
                <Th>Objekt-ID</Th>
                <Th>Kennzeichen</Th>
                <Th>Typ</Th>
                <Th>Hauptfahrzeug</Th>
                <Th>Bemerkung</Th>
              </tr>
            </thead>

            <tbody className="text-gray-900">
              {visibleAssignmentRowCount === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Keine Zuordnung passt zu den aktuellen Filtern.
                  </td>
                </tr>
              ) : (
                <>
                {sortedAssignments.map((assignment) => {
                  const formId = `driver-vehicle-form-${assignment.id}`;
                  const currentPersonValue = assignment.driver.employee?.id
                    ? `employee:${assignment.driver.employee.id}`
                    : `driver:${assignment.driverId}`;
                  const currentInventoryItemId =
                    assignment.inventoryItemId ??
                    inventoryItemByVehicleId.get(assignment.vehicleId)?.id ??
                    "";

                  return (
                    <tr
                      key={assignment.id}
                      className="border-t border-gray-100"
                    >
                      <td className="border-r border-gray-200 bg-white p-3 align-top">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            form={formId}
                            type="submit"
                            title="Zuordnung speichern"
                            aria-label="Zuordnung speichern"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                          >
                            <ActionIcon name="save" className="h-4 w-4" />
                          </button>

                          <form action={deleteDriverVehicleAssignment}>
                            <input
                              type="hidden"
                              name="id"
                              value={assignment.id}
                            />
                            <input
                              type="hidden"
                              name="returnTo"
                              value={returnToAssignments}
                            />

                            <button
                              type="submit"
                              title="Zuordnung löschen"
                              aria-label="Zuordnung löschen"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
                          >
                              <ActionIcon name="delete" className="h-4 w-4" />
                            </button>
                          </form>
                        </div>
                      </td>

                      <Td>
                        <form
                          id={formId}
                          action={updateDriverVehicleAssignment}
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={assignment.id}
                          />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={returnToAssignments}
                          />
                        </form>

                        <PersonSelect
                          formId={formId}
                          name="driverPersonId"
                          label=""
                          options={personOptions}
                          defaultValue={currentPersonValue}
                          required
                          compact
                        />

                        {assignment.driver.employee ? (
                          <div className="mt-1 text-xs text-gray-500">
                            aus Mitarbeiterstamm
                          </div>
                        ) : assignment.driver.shortcut ? (
                          <div className="mt-1 text-xs text-gray-500">
                            Kürzel: {assignment.driver.shortcut}
                          </div>
                        ) : null}
                      </Td>

                      <Td>
                        <InventoryItemPicker
                          formId={formId}
                          name="inventoryItemId"
                          label=""
                          options={getInventorySelectOptions(
                            currentInventoryItemId,
                          )}
                          assignedInventoryItemIds={Array.from(
                            activeAssignedInventoryItemIds,
                          )}
                          assignedInventoryItemInfoEntries={Array.from(
                            assignedInventoryItemInfo.entries(),
                          )}
                          currentInventoryItemId={currentInventoryItemId}
                          defaultValue={currentInventoryItemId}
                          required
                          compact
                        />
                      </Td>

                      <Td>
                        {assignment.inventoryItem?.objectNumber ??
                          inventoryItemByVehicleId.get(assignment.vehicleId)
                            ?.objectNumber ??
                          assignment.vehicle.vehicleNumber}
                      </Td>
                      <Td>
                        {assignment.inventoryItem?.licensePlate ??
                          inventoryItemByVehicleId.get(assignment.vehicleId)
                            ?.licensePlate ??
                          assignment.vehicle.licensePlate ??
                          "-"}
                      </Td>
                      <Td>{assignment.vehicle.vehicleType}</Td>

                      <Td>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            form={formId}
                            type="checkbox"
                            name="isPrimary"
                            defaultChecked={assignment.isPrimary}
                            className="h-4 w-4"
                          />
                          ja
                        </label>

                        {duplicatePrimaryDriverIds.has(assignment.driverId) &&
                        assignment.isPrimary ? (
                          <div className="mt-1 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                            mehrfach vergeben
                          </div>
                        ) : null}
                      </Td>

                      <Td>
                        <input
                          form={formId}
                          name="notes"
                          defaultValue={assignment.notes ?? ""}
                          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                        />
                      </Td>
                    </tr>
                  );
                })}

                {freeAssignmentTableItems.map((item) => {
                  const formId = `driver-vehicle-create-form-${item.id}`;
                  const categoryLabel = item.category?.parentCategory
                    ? `${item.category.parentCategory.name} / ${item.category.name}`
                    : item.category?.name ?? "ohne Kategorie";

                  return (
                    <tr
                      key={`free-${item.id}`}
                      className="border-t border-amber-100 bg-amber-50/30"
                    >
                      <td className="border-r border-gray-200 bg-white p-3 align-top">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            form={formId}
                            type="submit"
                            title="Zuordnung anlegen"
                            aria-label="Zuordnung anlegen"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-gray-700"
                          >
                            <ActionIcon name="save" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>

                      <Td>
                        <form
                          id={formId}
                          action={createDriverVehicleAssignment}
                        >
                          <input
                            type="hidden"
                            name="returnTo"
                            value={returnToAssignments}
                          />
                          <input
                            type="hidden"
                            name="inventoryItemId"
                            value={item.id}
                          />
                        </form>

                        <PersonSelect
                          formId={formId}
                          name="driverPersonId"
                          label=""
                          options={personOptions}
                          defaultValue={
                            getSuggestedResponsibleEmployeeId(item)
                              ? `employee:${getSuggestedResponsibleEmployeeId(item)}`
                              : ""
                          }
                          required
                          compact
                        />

                        <div className="mt-1 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                          nicht zugeordnet
                        </div>
                      </Td>

                      <Td>
                        <div className="rounded-lg border border-amber-200 bg-white px-2 py-2 text-sm font-semibold text-gray-900">
                          {getInventoryItemLabel(item)}
                        </div>
                      </Td>

                      <Td>{item.objectNumber ?? item.vehicle?.vehicleNumber ?? "-"}</Td>
                      <Td>{item.licensePlate ?? item.vehicle?.licensePlate ?? "-"}</Td>
                      <Td>{item.vehicle?.vehicleType ?? categoryLabel}</Td>

                      <Td>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            form={formId}
                            type="checkbox"
                            name="isPrimary"
                            className="h-4 w-4"
                          />
                          ja
                        </label>
                      </Td>

                      <Td>
                        <input
                          form={formId}
                          name="notes"
                          placeholder="z.B. Hauptfahrzeug"
                          className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
                        />
                      </Td>
                    </tr>
                  );
                })}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InfoList
          title="Inventarobjekte nach Filter"
          emptyText="Keine Inventarobjekte passen zu den aktuellen Filtern."
          items={filteredInventoryItems.map((item) => {
            const assignedTo = assignedInventoryItemInfo.get(item.id);

            return {
            id: item.id,
            title: `${assignedTo ? "⚠ " : ""}${getInventoryItemLabel(item)}`,
            description:
              `${assignedTo ? `vergeben an ${assignedTo} · ` : "frei · "}${
                item.vehicle != null
                  ? `${item.vehicle.category} · ${item.vehicle.vehicleType}`
                  : item.category?.name ?? "ohne Kategorie"
              }`,
            };
          })}
        />

        <InfoList
          title="Mitarbeiter/Fahrer ohne feste Zuordnung"
          emptyText="Alle aktiven Mitarbeiter/Fahrer haben eine Fahrzeugzuordnung."
          items={peopleWithoutVehicle.map((person) => ({
            id: person.value,
            title: person.label,
            description: person.subLabel,
          }))}
        />
      </div>
    </AppShell>
  );
}

function DriverVehicleFilterPopover({
  params,
  vehicleCategories,
  vehicleNumbers,
  vehicleTypes,
  filterCategory,
  filterPrimary,
  filterAssignmentStatus,
  sortMode,
  hasActiveTableSettings,
}: {
  params: DriverVehiclesSearchParams;
  vehicleCategories: string[];
  vehicleNumbers: string[];
  vehicleTypes: string[];
  filterCategory: string;
  filterPrimary: FilterPrimary;
  filterAssignmentStatus: AssignmentStatusFilter;
  sortMode: SortMode;
  hasActiveTableSettings: boolean;
}) {
  return (
    <DismissibleDetails className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">
        <ActionIcon name="filter" className="h-4 w-4" />
        Filter / Sortierung
        {hasActiveTableSettings ? (
          <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[11px] font-bold text-white">
            aktiv
          </span>
        ) : null}
      </summary>

      <div className="absolute right-0 z-40 mt-3 w-[min(92vw,760px)] rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
        <DismissibleDetailsCloseButton
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-300 bg-white text-xl font-semibold leading-none text-gray-700 hover:bg-gray-50"
          label="Filter schließen"
        />

        <form action="/admin/driver-vehicles#zuordnungen" className="space-y-4">
          <input type="hidden" name="q" value={params.q ?? ""} />

          <div className="flex items-start justify-between gap-4 pr-12">
            <div>
              <div className="text-base font-bold text-gray-950">
                Spaltenfilter & Sortierung
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Sortierung und Detailfilter für die Zuordnungsliste.
              </p>
            </div>

            {hasActiveTableSettings ? (
              <Link
                href={buildDriverVehiclesHref({
                  params: {
                    q: params.q,
                  },
                })}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Filter leeren
              </Link>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium text-gray-800">
              Sortierung
              <select
                name="sort"
                defaultValue={sortMode}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              >
                <option value="driverLastAsc">Nachname A–Z</option>
                <option value="driverLastDesc">Nachname Z–A</option>
                <option value="driverFirstAsc">Vorname A–Z</option>
                <option value="driverFirstDesc">Vorname Z–A</option>
                <option value="vehicleNumberAsc">Objekt-ID aufsteigend</option>
                <option value="vehicleNumberDesc">Objekt-ID absteigend</option>
                <option value="licensePlateAsc">Kennzeichen A–Z</option>
                <option value="vehicleTypeAsc">Typ A–Z</option>
                <option value="categoryAsc">Kategorie A–Z</option>
                <option value="primaryFirst">Hauptfahrzeug zuerst</option>
              </select>
            </label>

            <label className="text-sm font-medium text-gray-800">
              Mitarbeiter / Fahrer
              <input
                name="person"
                defaultValue={params.person ?? ""}
                placeholder="Name, Kürzel, Telefon ..."
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Fahrzeug / Kombination
              <input
                name="vehicle"
                defaultValue={params.vehicle ?? ""}
                placeholder="Nr., Kennzeichen, Typ, Kategorie ..."
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Objekt-ID
              <select
                name="vehicleNumber"
                defaultValue={params.vehicleNumber ?? ""}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              >
                <option value="">Alle Objekt-IDs</option>
                {vehicleNumbers.map((vehicleNumber) => (
                  <option key={vehicleNumber} value={vehicleNumber}>
                    {vehicleNumber}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-800">
              Kennzeichen
              <input
                name="licensePlate"
                defaultValue={params.licensePlate ?? ""}
                placeholder="z.B. AB-ST ..."
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>

            <label className="text-sm font-medium text-gray-800">
              Typ
              <select
                name="vehicleType"
                defaultValue={params.vehicleType ?? ""}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              >
                <option value="">Alle Typen</option>
                {vehicleTypes.map((vehicleType) => (
                  <option key={vehicleType} value={vehicleType}>
                    {vehicleType}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-800">
              Kategorie
              <select
                name="category"
                defaultValue={filterCategory}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              >
                <option value="">Alle Kategorien</option>
                {vehicleCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-800">
              Zuordnungsstatus
              <select
                name="assignmentStatus"
                defaultValue={filterAssignmentStatus}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              >
                <option value="all">Alle</option>
                <option value="assigned">Nur zugeordnet</option>
                <option value="unassigned">Nur nicht zugeordnet</option>
              </select>
            </label>

            <label className="text-sm font-medium text-gray-800">
              Hauptfahrzeug
              <select
                name="primary"
                defaultValue={filterPrimary}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              >
                <option value="all">Alle</option>
                <option value="primary">Nur Hauptfahrzeug</option>
                <option value="secondary">Nur weitere Fahrzeuge</option>
              </select>
            </label>

            <label className="text-sm font-medium text-gray-800">
              Bemerkung
              <input
                name="notes"
                defaultValue={params.notes ?? ""}
                placeholder="Bemerkung enthält ..."
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
            <button
              type="submit"
              className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Anwenden
            </button>
          </div>
        </form>
      </div>
    </DismissibleDetails>
  );
}

function PersonSelect({
  formId,
  name,
  label,
  options,
  defaultValue,
  required = false,
  compact = false,
}: {
  formId?: string;
  name: string;
  label: string;
  options: PersonOption[];
  defaultValue: string;
  required?: boolean;
  compact?: boolean;
}) {
  const select = (
    <select
      form={formId}
      name={name}
      required={required}
      defaultValue={defaultValue}
      className={
        compact
          ? "w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          : "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
      }
    >
      <option value="" disabled>
        Mitarbeiter/Fahrer wählen
      </option>

      {options.map((person) => (
        <option key={person.value} value={person.value}>
          {person.label} · {person.subLabel}
        </option>
      ))}
    </select>
  );

  if (!label) return select;

  return (
    <label className="text-sm font-medium text-gray-800">
      {label}
      {select}
    </label>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
    </div>
  );
}

function InfoList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: {
    id: string;
    title: string;
    description: string;
  }[];
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-gray-50 p-3"
            >
              <div className="text-sm font-semibold text-gray-900">
                {item.title}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {item.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="p-3 font-semibold leading-tight">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return (
    <td className="break-words p-3 align-top leading-snug text-gray-900">
      {children}
    </td>
  );
}
