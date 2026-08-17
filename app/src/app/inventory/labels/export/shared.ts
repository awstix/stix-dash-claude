import { notFound } from "next/navigation";
import {
  INVENTORY_LABEL_MAX_COLUMNS,
  INVENTORY_LABEL_MAX_ROWS,
  INVENTORY_LABEL_TAPE_WIDTHS,
  getInventoryLabelCodeType,
  parseInventoryLabelBlocks,
  type InventoryLabelBlock,
} from "@/lib/inventory-labels";
import { prisma } from "@/lib/prisma";

export function sanitizeFileName(value: string) {
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

function optionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberValue(
  value: FormDataEntryValue | null,
  fallback: number,
  options: { max?: number; min?: number } = {},
) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.min !== undefined && parsed < options.min) return options.min;
  if (options.max !== undefined && parsed > options.max) return options.max;
  return parsed;
}

function floatValue(
  value: FormDataEntryValue | null,
  fallback: number,
  options: { max?: number; min?: number } = {},
) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options.min !== undefined && parsed < options.min) return options.min;
  if (options.max !== undefined && parsed > options.max) return options.max;
  return Math.round(parsed * 10) / 10;
}

export async function getLiveLabelExportPayload(formData: FormData) {
  const itemId = optionalString(formData.get("previewItemId"));

  if (!itemId) {
    notFound();
  }

  const [item, companyInfo] = await Promise.all([
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
    prisma.companyInfo.findUnique({
      where: {
        id: "default",
      },
    }),
  ]);

  if (!item) {
    notFound();
  }

  const tapeWidthMm = numberValue(formData.get("tapeWidthMm"), 24);
  const safeTapeWidthMm = INVENTORY_LABEL_TAPE_WIDTHS.includes(
    tapeWidthMm as (typeof INVENTORY_LABEL_TAPE_WIDTHS)[number],
  )
    ? tapeWidthMm
    : 24;
  const rowCount = numberValue(formData.get("rowCount"), 4, {
    max: INVENTORY_LABEL_MAX_ROWS,
    min: 1,
  });
  const columnCount = numberValue(formData.get("columnCount"), 1, {
    max: INVENTORY_LABEL_MAX_COLUMNS,
    min: 1,
  });
  const gapMm = floatValue(formData.get("gapMm"), 1, { max: 5, min: 0 });
  const blocks = parseInventoryLabelBlocks(
    optionalString(formData.get("blocksJson")),
  ).map((block): InventoryLabelBlock => ({
    ...block,
    col: Math.min(columnCount, Math.max(1, block.col)),
    height: Math.min(rowCount, Math.max(1, block.height)),
    row: Math.min(rowCount, Math.max(1, block.row)),
    width: Math.min(columnCount, Math.max(1, block.width)),
  }));
  const fileLabel = sanitizeFileName(
    [item.objectNumber, item.inventoryNumber, item.stixId, item.name]
      .filter(Boolean)
      .join("-") ||
      item.id,
  );

  return {
    blocks,
    companyInfo,
    fileLabel,
    item,
    template: {
      blocksJson: JSON.stringify(blocks),
      codeType: getInventoryLabelCodeType(
        optionalString(formData.get("codeType")) ?? "DATAMATRIX",
      ),
      columnCount,
      gapMm,
      isDefault: false,
      labelLengthMm: 0,
      name: optionalString(formData.get("name")) ?? "Live-Etikett",
      orientation:
        optionalString(formData.get("orientation")) === "PORTRAIT"
          ? "PORTRAIT"
          : "LANDSCAPE",
      rowCount,
      showBorder: formData.get("showBorder") === "on",
      tapeWidthMm: safeTapeWidthMm,
    },
  };
}
