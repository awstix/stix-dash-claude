import { notFound } from "next/navigation";
import { createInventoryLabelPng } from "@/lib/inventory-label-png";
import { parseInventoryLabelBlocks } from "@/lib/inventory-labels";
import { prisma } from "@/lib/prisma";

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("Ä", "Ae")
    .replaceAll("Ö", "Oe")
    .replaceAll("Ü", "Ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const url = new URL(request.url);
  const templateId = url.searchParams.get("template");
  const [item, templates, companyInfo] = await Promise.all([
    prisma.inventoryItem.findUnique({
      include: {
        category: {
          include: {
            parentCategory: true,
          },
        },
        currentProject: {
          select: {
            name: true,
            projectNumber: true,
          },
        },
        responsibleCrew: {
          select: {
            name: true,
          },
        },
        responsibleEmployee: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      where: {
        id: itemId,
      },
    }),
    prisma.inventoryLabelTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { tapeWidthMm: "asc" }, { name: "asc" }],
    }),
    prisma.companyInfo.findUnique({
      where: {
        id: "default",
      },
    }),
  ]);

  if (!item) {
    notFound();
  }

  const template =
    templates.find((candidate) => candidate.id === templateId) ??
    templates.find((candidate) => candidate.isDefault) ??
    templates[0] ??
    null;

  if (!template) {
    notFound();
  }

  const png = await createInventoryLabelPng({
    blocks: parseInventoryLabelBlocks(template.blocksJson),
    companyLogoUrl: companyInfo?.logoPublicUrl ?? null,
    companyName: companyInfo?.companyName ?? null,
    item,
    template,
  });
  const fileLabel = sanitizeFileName(
    [item.objectNumber, item.inventoryNumber, item.stixId, item.name]
      .filter(Boolean)
      .join("-") ||
      item.id,
  );

  return new Response(new Uint8Array(png), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="inventar-${fileLabel}.png"`,
      "Content-Type": "image/png",
    },
  });
}
