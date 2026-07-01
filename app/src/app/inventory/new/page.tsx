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

  const [categories, crews, employees, items, projects, vehicles] =
    await Promise.all([
      prisma.inventoryCategory.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          parentCategoryId: true,
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
      prisma.project.findMany({
        orderBy: [{ projectNumber: "desc" }],
        take: 250,
      }),
      prisma.vehicle.findMany({
        where: {
          isActive: true,
        },
        orderBy: [{ vehicleNumber: "asc" }],
      }),
    ]);

  return (
    <AppShell
      title="Inventarobjekt anlegen"
      description="Stammdaten, Zuordnung, Lagerdaten, Fotos und Ansprechpartner in Ruhe erfassen."
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
        categories={categories}
        containerOptions={items}
        crews={crews}
        defaultParentItemId={defaultParentItemId}
        employees={employees}
        layout="stacked"
        projects={projects}
        vehicles={vehicles}
      />
    </AppShell>
  );
}
