import { notFound } from "next/navigation";
import {
  INVENTORY_LABEL_TAPE_WIDTHS,
  clampBlockToCanvas,
  getInventoryLabelCodeType,
  parseInventoryLabelBlocks,
} from "@/lib/inventory-labels";
import { prisma } from "@/lib/prisma";

// The live-preview export always sends the current editor state, which is
// already in the new absolute-position shape - this geometry only
// satisfies the parser's signature for the (never taken) legacy branch.
const UNUSED_EXPORT_GEOMETRY = {
  columnCount: 1,
  gapMm: 0,
  labelHeightMm: 100,
  labelWidthMm: 100,
  rowCount: 1,
};

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

function optionalFloatValue(
  value: FormDataEntryValue | null,
  options: { max?: number; min?: number } = {},
): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
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
  const orientation =
    optionalString(formData.get("orientation")) === "PORTRAIT"
      ? "PORTRAIT"
      : "LANDSCAPE";
  const labelLengthOverrideMm = optionalFloatValue(
    formData.get("labelLengthOverrideMm"),
    { max: 220, min: 18 },
  );
  const labelLengthMm = numberValue(formData.get("labelLengthMm"), 70, {
    max: 220,
    min: 18,
  });
  const canvasLengthMm = labelLengthOverrideMm ?? labelLengthMm;
  const canvasWidthMm = orientation === "PORTRAIT" ? safeTapeWidthMm : canvasLengthMm;
  const canvasHeightMm = orientation === "PORTRAIT" ? canvasLengthMm : safeTapeWidthMm;
  const blocks = parseInventoryLabelBlocks(
    optionalString(formData.get("blocksJson")),
    UNUSED_EXPORT_GEOMETRY,
  ).map((block) => clampBlockToCanvas(block, canvasWidthMm, canvasHeightMm));
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
      isDefault: false,
      labelLengthMm,
      labelLengthOverrideMm,
      name: optionalString(formData.get("name")) ?? "Live-Etikett",
      orientation,
      showBorder: formData.get("showBorder") === "on",
      tapeWidthMm: safeTapeWidthMm,
    },
  };
}
