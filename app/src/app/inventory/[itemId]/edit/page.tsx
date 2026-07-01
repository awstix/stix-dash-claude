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

  const [categories, crews, employees, item, items, projects, vehicles] =
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
          photos: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
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

  if (!item) {
    notFound();
  }

  return (
    <AppShell
      title={`Inventarobjekt bearbeiten: ${item.name}`}
      description="Stammdaten, Zuordnung, Wartung, Fotos und Ansprechpartner bearbeiten."
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
        categories={categories}
        containerOptions={items}
        crews={crews}
        employees={employees}
        item={item}
        layout="stacked"
        projects={projects}
        vehicles={vehicles}
      />
    </AppShell>
  );
}
