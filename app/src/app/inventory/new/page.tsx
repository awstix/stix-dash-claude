import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { createInventoryItem } from "../actions";
import { InventoryItemForm } from "../InventoryItemForm";

export default async function NewInventoryItemPage({
  searchParams,
}: {
  searchParams?: Promise<{
    containerId?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const defaultParentItemId = String(params.containerId ?? "").trim() || null;

  const [attachmentTypeRows, fuelTypeRows, categories, crews, employees, items] =
    await Promise.all([
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
      prisma.inventoryItem.findMany({
        where: {
          isContainer: true,
        },
        orderBy: [{ name: "asc" }],
      }),
    ]);

  return (
    <AppShell
      title="Inventarobjekt anlegen"
      description="Objektdaten, Zuordnung, Lagerdaten, Fotos und Ansprechpartner in Ruhe erfassen."
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/inventory"
        >
          ← Inventarverwaltung
        </Link>
        <Link
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          href="/admin/inventory-categories"
        >
          Kategorien pflegen
        </Link>
      </div>

      <InventoryItemForm
        action={createInventoryItem}
        attachmentTypeOptions={attachmentTypeRows
          .map((row) => row.attachmentType)
          .filter((value): value is string => Boolean(value))}
        categories={categories}
        containerOptions={items}
        crews={crews}
        defaultParentItemId={defaultParentItemId}
        employees={employees}
        fuelTypeOptions={fuelTypeRows.map((row) => ({
          label: row.label,
          value: row.value,
        }))}
        layout="stacked"
      />
    </AppShell>
  );
}
