"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEFAULT_INVENTORY_LABEL_BLOCKS,
  INVENTORY_LABEL_MAX_COLUMNS,
  INVENTORY_LABEL_MAX_ROWS,
  INVENTORY_LABEL_TAPE_WIDTHS,
  getInventoryLabelCodeType,
  parseInventoryLabelBlocks,
  type InventoryLabelBlock,
} from "@/lib/inventory-labels";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";

function optionalString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requiredString(value: FormDataEntryValue | null, label: string) {
  const text = optionalString(value);

  if (!text) {
    throw new Error(`${label} ist ein Pflichtfeld.`);
  }

  return text;
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

function getBlocks(formData: FormData) {
  const rawJson = optionalString(formData.get("blocksJson"));
  const blocks = parseInventoryLabelBlocks(rawJson);
  const enabledBlocks = blocks.filter((block) => block.enabled);

  if (enabledBlocks.length === 0) {
    throw new Error("Bitte mindestens einen Etiketten-Baustein auswählen.");
  }

  return JSON.stringify(normalizeBlocks(blocks));
}

function normalizeBlocks(blocks: InventoryLabelBlock[]) {
  return blocks
    .map((block, index) => ({
      align:
        block.align === "CENTER" || block.align === "RIGHT"
          ? block.align
          : "LEFT",
      bold: Boolean(block.bold),
      col: Math.min(
        INVENTORY_LABEL_MAX_COLUMNS,
        Math.max(1, Math.round(block.col ?? 1)),
      ),
      enabled: Boolean(block.enabled),
      height: Math.min(
        INVENTORY_LABEL_MAX_ROWS,
        Math.max(1, Math.round(block.height ?? 1)),
      ),
      italic: Boolean(block.italic),
      key: block.key,
      labelVisible:
        block.key === "code" || block.key === "companyLogo"
          ? false
          : Boolean(block.labelVisible),
      order: Number.isFinite(block.order) ? block.order : index + 1,
      row: Math.min(
        INVENTORY_LABEL_MAX_ROWS,
        Math.max(1, Math.round(block.row ?? 1)),
      ),
      size: block.size,
      underline: Boolean(block.underline),
      width: Math.min(
        INVENTORY_LABEL_MAX_COLUMNS,
        Math.max(1, Math.round(block.width ?? 1)),
      ),
      widthAuto: Boolean(block.widthAuto),
      widthMm:
        typeof block.widthMm === "number" && Number.isFinite(block.widthMm)
          ? Math.min(500, Math.max(0, Math.round(block.widthMm * 10) / 10))
          : null,
    }))
    .sort((left, right) => left.order - right.order);
}

function getTemplatePayload(formData: FormData) {
  const name = requiredString(formData.get("name"), "Vorlagenname");
  const tapeWidthMm = numberValue(formData.get("tapeWidthMm"), 24);
  const safeTapeWidthMm = INVENTORY_LABEL_TAPE_WIDTHS.includes(
    tapeWidthMm as (typeof INVENTORY_LABEL_TAPE_WIDTHS)[number],
  )
    ? tapeWidthMm
    : 24;
  const labelLengthMm = numberValue(formData.get("labelLengthMm"), 70, {
    max: 220,
    min: 25,
  });
  const codeType = getInventoryLabelCodeType(
    optionalString(formData.get("codeType")) ?? "DATAMATRIX",
  );
  const orientation =
    optionalString(formData.get("orientation")) === "PORTRAIT"
      ? "PORTRAIT"
      : "LANDSCAPE";
  const showBorder = formData.get("showBorder") === "on";
  const isDefault = formData.get("isDefault") === "on";
  const rowCount = numberValue(formData.get("rowCount"), 4, {
    max: INVENTORY_LABEL_MAX_ROWS,
    min: 1,
  });
  const columnCount = numberValue(formData.get("columnCount"), 1, {
    max: INVENTORY_LABEL_MAX_COLUMNS,
    min: 1,
  });

  return {
    blocksJson: getBlocks(formData),
    codeType,
    columnCount,
    isDefault,
    labelLengthMm,
    name,
    orientation,
    rowCount,
    showBorder,
    tapeWidthMm: safeTapeWidthMm,
  };
}

async function clearDefaultIfNeeded(isDefault: boolean, currentId?: string) {
  if (!isDefault) return;

  await prisma.inventoryLabelTemplate.updateMany({
    data: {
      isDefault: false,
    },
    where: currentId
      ? {
          id: {
            not: currentId,
          },
        }
      : undefined,
  });
}

export async function createInventoryLabelTemplate(formData: FormData) {
  await requireSession();
  const payload = getTemplatePayload(formData);

  await clearDefaultIfNeeded(payload.isDefault);

  const template = await prisma.inventoryLabelTemplate.create({
    data: payload,
  });

  revalidateInventoryLabelViews();
  redirect(`/inventory/labels?template=${template.id}`);
}

export async function updateInventoryLabelTemplate(
  templateId: string,
  formData: FormData,
) {
  await requireSession();
  const payload = getTemplatePayload(formData);

  await clearDefaultIfNeeded(payload.isDefault, templateId);

  await prisma.inventoryLabelTemplate.update({
    data: payload,
    where: {
      id: templateId,
    },
  });

  revalidateInventoryLabelViews();
  redirect(`/inventory/labels?template=${templateId}`);
}

export async function deleteInventoryLabelTemplate(templateId: string) {
  await requireSession();
  await prisma.inventoryLabelTemplate.delete({
    where: {
      id: templateId,
    },
  });

  revalidateInventoryLabelViews();
  redirect("/inventory/labels");
}

export async function createDefaultInventoryLabelTemplates() {
  await requireSession();
  const count = await prisma.inventoryLabelTemplate.count();

  if (count > 0) {
    redirect("/inventory/labels");
  }

  await prisma.inventoryLabelTemplate.createMany({
    data: [
      {
        blocksJson: JSON.stringify(DEFAULT_INVENTORY_LABEL_BLOCKS),
        codeType: "DATAMATRIX",
        columnCount: 6,
        isDefault: true,
        labelLengthMm: 70,
        name: "TZe 24 mm · Standard Inventar",
        orientation: "LANDSCAPE",
        rowCount: 4,
        showBorder: true,
        tapeWidthMm: 24,
      },
      {
        blocksJson: JSON.stringify(
          DEFAULT_INVENTORY_LABEL_BLOCKS.map((block) => ({
            ...block,
            enabled: ["objectNumber", "code", "name"].includes(block.key),
          })),
        ),
        codeType: "DATAMATRIX",
        columnCount: 6,
        isDefault: false,
        labelLengthMm: 55,
        name: "TZe 12 mm · Kompakt",
        orientation: "LANDSCAPE",
        rowCount: 3,
        showBorder: true,
        tapeWidthMm: 12,
      },
      {
        blocksJson: JSON.stringify(DEFAULT_INVENTORY_LABEL_BLOCKS),
        codeType: "DATAMATRIX",
        columnCount: 6,
        isDefault: false,
        labelLengthMm: 90,
        name: "TZe 36 mm · Groß",
        orientation: "LANDSCAPE",
        rowCount: 4,
        showBorder: true,
        tapeWidthMm: 36,
      },
      {
        blocksJson: JSON.stringify(
          DEFAULT_INVENTORY_LABEL_BLOCKS.map((block) => ({
            ...block,
            enabled: block.key === "code",
            width: block.key === "code" ? 6 : block.width,
          })),
        ),
        codeType: "DATAMATRIX",
        columnCount: 1,
        isDefault: false,
        labelLengthMm: 28,
        name: "TZe 24 mm · Nur ECC200",
        orientation: "LANDSCAPE",
        rowCount: 1,
        showBorder: false,
        tapeWidthMm: 24,
      },
      {
        blocksJson: JSON.stringify(
          DEFAULT_INVENTORY_LABEL_BLOCKS.map((block) => ({
            ...block,
            enabled: ["code", "objectNumber", "name"].includes(block.key),
            width:
              block.key === "name" ? 4 : block.key === "code" ? 2 : block.width,
          })),
        ),
        codeType: "QR",
        columnCount: 6,
        isDefault: false,
        labelLengthMm: 55,
        name: "TZe 24 mm · QR mit Text",
        orientation: "LANDSCAPE",
        rowCount: 3,
        showBorder: true,
        tapeWidthMm: 24,
      },
    ],
  });

  revalidateInventoryLabelViews();
  redirect("/inventory/labels");
}

function revalidateInventoryLabelViews() {
  revalidatePath("/inventory");
  revalidatePath("/inventory/labels");
}
