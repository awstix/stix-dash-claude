import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { updateInventoryItem } from "../../actions";
import { InventoryItemForm } from "../../InventoryItemForm";

export default async function EditInventoryItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;

  const [
    attachmentTypeRows,
    fuelTypeRows,
    insuranceProviderRows,
    statusRows,
    categories,
    crews,
    employees,
    item,
    items,
  ] = await Promise.all([
      prisma.inventoryItem.findMany({
        distinct: ["attachmentType"],
        orderBy: [{ attachmentType: "asc" }],
        select: {
          attachmentType: true,
        },
        where: {
          attachmentType: {
            not: null,
          },
        },
      }),
      prisma.adminOption.findMany({
        where: {
          groupKey: "vehicle_fuel_type",
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
      prisma.adminOption.findMany({
        where: {
          groupKey: "insurance_provider",
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
      prisma.adminOption.findMany({
        where: {
          groupKey: "inventory_status",
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
      prisma.inventoryCategory.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          dailyReportSection: true,
          id: true,
          name: true,
          parentCategoryId: true,
          useInDailyReports: true,
          useInTruckDispatchMaterial: true,
          useInTruckDispatchObject: true,
        },
      }),
      prisma.crew.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.employee.findMany({
        where: {
          statusValue: {
            not: "left",
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.inventoryItem.findUnique({
        where: {
          id: itemId,
        },
        include: {
          contacts: {
            orderBy: [
              { role: "asc" },
              { lastName: "asc" },
              { firstName: "asc" },
              { name: "asc" },
            ],
          },
          employeeAssignments: {
            select: {
              employeeId: true,
            },
          },
          photos: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
          },
          documents: {
            orderBy: [{ createdAt: "desc" }],
          },
        },
      }),
      prisma.inventoryItem.findMany({
        where: {
          id: {
            not: itemId,
          },
          isContainer: true,
        },
        orderBy: [{ name: "asc" }],
      }),
    ]);

  if (!item) {
    notFound();
  }

  return (
    <AppShell
      title={`Inventarobjekt bearbeiten: ${item.name}`}
      description="Objektdaten, Zuordnung, Wartung, Fotos und Ansprechpartner bearbeiten."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href={`/inventory/${item.id}`}
        >
          ← Detailseite
        </Link>
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/inventory"
        >
          Inventarverwaltung
        </Link>
      </div>

      <InventoryItemForm
        action={updateInventoryItem}
        attachmentTypeOptions={attachmentTypeRows
          .map((row) => row.attachmentType)
          .filter((value): value is string => Boolean(value))}
        categories={categories}
        containerOptions={items}
        crews={crews}
        employees={employees}
        fuelTypeOptions={fuelTypeRows.map((row) => ({
          label: row.label,
          value: row.value,
        }))}
        insuranceProviderOptions={insuranceProviderRows.map((row) => ({
          label: row.label,
          value: row.value,
        }))}
        statusOptions={statusRows.map((row) => ({
          label: row.label,
          value: row.value,
        }))}
        item={item}
        layout="stacked"
      />
    </AppShell>
  );
}
