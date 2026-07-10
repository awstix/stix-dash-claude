export const INVENTORY_LABEL_TAPE_WIDTHS = [9, 12, 24, 36] as const;
export const INVENTORY_LABEL_MAX_ROWS = 4;
export const INVENTORY_LABEL_MAX_COLUMNS = 12;

export type InventoryLabelCodeType = "DATAMATRIX" | "QR";
export type InventoryLabelBlockAlign = "LEFT" | "CENTER" | "RIGHT";
export type InventoryLabelBlockSize = "SMALL" | "NORMAL" | "LARGE";
export type InventoryLabelBlockKey =
  | "companyLogo"
  | "spacer1"
  | "spacer2"
  | "spacer3"
  | "objectNumber"
  | "inventoryNumber"
  | "stixId"
  | "code"
  | "name"
  | "category"
  | "manufacturer"
  | "model"
  | "attachmentType"
  | "serialNumber"
  | "licensePlate"
  | "responsible"
  | "location"
  | "status";

export type InventoryLabelBlock = {
  align: InventoryLabelBlockAlign;
  bold: boolean;
  col: number;
  enabled: boolean;
  height: number;
  italic: boolean;
  key: InventoryLabelBlockKey;
  labelVisible: boolean;
  order: number;
  row: number;
  size: InventoryLabelBlockSize;
  underline: boolean;
  width: number;
  widthAuto: boolean;
  widthMm: number | null;
};

export const INVENTORY_LABEL_BLOCKS: Array<{
  defaultCol: number;
  defaultHeight: number;
  defaultRow: number;
  defaultSize: InventoryLabelBlockSize;
  defaultWidth: number;
  key: InventoryLabelBlockKey;
  label: string;
  preview: string;
}> = [
  {
    defaultCol: 1,
    defaultHeight: 2,
    defaultRow: 1,
    defaultSize: "LARGE",
    defaultWidth: 2,
    key: "companyLogo",
    label: "Firmenlogo",
    preview: "Logo",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 1,
    defaultSize: "NORMAL",
    defaultWidth: 1,
    key: "spacer1",
    label: "Leere Fläche / Abstand 1",
    preview: "Abstand",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 2,
    defaultSize: "NORMAL",
    defaultWidth: 1,
    key: "spacer2",
    label: "Leere Fläche / Abstand 2",
    preview: "Abstand",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 3,
    defaultSize: "NORMAL",
    defaultWidth: 1,
    key: "spacer3",
    label: "Leere Fläche / Abstand 3",
    preview: "Abstand",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 1,
    defaultSize: "LARGE",
    defaultWidth: 2,
    key: "objectNumber",
    label: "Geräte-ID / Objekt-ID",
    preview: "112001",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 2,
    defaultSize: "NORMAL",
    defaultWidth: 3,
    key: "inventoryNumber",
    label: "Inventarnummer",
    preview: "INV-001",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 2,
    defaultSize: "NORMAL",
    defaultWidth: 3,
    key: "stixId",
    label: "STIX-ID",
    preview: "STIX-001",
  },
  {
    defaultCol: 5,
    defaultHeight: 2,
    defaultRow: 1,
    defaultSize: "LARGE",
    defaultWidth: 2,
    key: "code",
    label: "ECC200 / QR-Code",
    preview: "Code",
  },
  {
    defaultCol: 3,
    defaultHeight: 1,
    defaultRow: 1,
    defaultSize: "LARGE",
    defaultWidth: 4,
    key: "name",
    label: "Name",
    preview: "Bagger 18t",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 3,
    defaultSize: "NORMAL",
    defaultWidth: 3,
    key: "category",
    label: "Kategorie",
    preview: "Baumaschinen › Bagger",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 4,
    defaultSize: "NORMAL",
    defaultWidth: 3,
    key: "manufacturer",
    label: "Hersteller",
    preview: "Caterpillar",
  },
  {
    defaultCol: 4,
    defaultHeight: 1,
    defaultRow: 4,
    defaultSize: "NORMAL",
    defaultWidth: 3,
    key: "model",
    label: "Typ / Modell",
    preview: "320F",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 4,
    defaultSize: "NORMAL",
    defaultWidth: 3,
    key: "attachmentType",
    label: "Aufnahmetyp",
    preview: "OQ 70/55",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 4,
    defaultSize: "SMALL",
    defaultWidth: 3,
    key: "serialNumber",
    label: "Seriennummer",
    preview: "SN-123456",
  },
  {
    defaultCol: 4,
    defaultHeight: 1,
    defaultRow: 3,
    defaultSize: "NORMAL",
    defaultWidth: 3,
    key: "licensePlate",
    label: "Kennzeichen",
    preview: "MIL-EX 123",
  },
  {
    defaultCol: 1,
    defaultHeight: 1,
    defaultRow: 4,
    defaultSize: "SMALL",
    defaultWidth: 3,
    key: "responsible",
    label: "Zuweisung",
    preview: "Kolonne Asphalt",
  },
  {
    defaultCol: 4,
    defaultHeight: 1,
    defaultRow: 4,
    defaultSize: "SMALL",
    defaultWidth: 3,
    key: "location",
    label: "Standort",
    preview: "Bauhof",
  },
  {
    defaultCol: 5,
    defaultHeight: 1,
    defaultRow: 4,
    defaultSize: "SMALL",
    defaultWidth: 2,
    key: "status",
    label: "Status",
    preview: "Aktiv",
  },
];

export const DEFAULT_INVENTORY_LABEL_BLOCKS: InventoryLabelBlock[] =
  INVENTORY_LABEL_BLOCKS.map((block, index) => ({
    align: "LEFT",
    bold: block.defaultSize !== "SMALL",
    col: block.defaultCol,
    enabled: ["objectNumber", "code", "name", "manufacturer", "model"].includes(
      block.key,
    ),
    height: block.defaultHeight,
    italic: false,
    key: block.key,
    labelVisible: isInventoryLabelTextBlock(block.key),
    order: index + 1,
    row: block.defaultRow,
    size: block.defaultSize,
    underline: false,
    width: block.defaultWidth,
    widthAuto: false,
    widthMm: null,
  }));

export type InventoryLabelTemplateLike = {
  blocksJson: string;
  codeType: string;
  id: string;
  isDefault: boolean;
  labelLengthMm: number;
  rowCount: number;
  columnCount: number;
  name: string;
  orientation: string;
  showBorder: boolean;
  tapeWidthMm: number;
};

export function parseInventoryLabelBlocks(
  blocksJson: string | null | undefined,
) {
  let rawBlocks: unknown = null;

  try {
    rawBlocks = blocksJson ? JSON.parse(blocksJson) : null;
  } catch {
    rawBlocks = null;
  }

  const rawArray = Array.isArray(rawBlocks) ? rawBlocks : [];
  const rawByKey = new Map<string, Record<string, unknown>>();

  for (const rawBlock of rawArray) {
    if (!rawBlock || typeof rawBlock !== "object") continue;
    const key = String((rawBlock as Record<string, unknown>).key ?? "");
    rawByKey.set(key, rawBlock as Record<string, unknown>);
  }

  return DEFAULT_INVENTORY_LABEL_BLOCKS.map((defaultBlock) => {
    const rawBlock = rawByKey.get(defaultBlock.key);
    const rawAlign = rawBlock?.align;
    const rawBold = rawBlock?.bold;
    const rawCol = rawBlock?.col;
    const rawHeight = rawBlock?.height;
    const rawItalic = rawBlock?.italic;
    const rawRow = rawBlock?.row;
    const rawSize = rawBlock?.size;
    const rawUnderline = rawBlock?.underline;
    const rawWidth = rawBlock?.width;
    const rawWidthAuto = rawBlock?.widthAuto;
    const rawWidthMm = rawBlock?.widthMm;

    return {
      ...defaultBlock,
      align:
        rawAlign === "CENTER" || rawAlign === "RIGHT" || rawAlign === "LEFT"
          ? rawAlign
          : defaultBlock.align,
      bold: typeof rawBold === "boolean" ? rawBold : defaultBlock.bold,
      col:
        typeof rawCol === "number" && Number.isFinite(rawCol)
          ? Math.min(INVENTORY_LABEL_MAX_COLUMNS, Math.max(1, Math.round(rawCol)))
          : defaultBlock.col,
      enabled:
        typeof rawBlock?.enabled === "boolean"
          ? rawBlock.enabled
          : defaultBlock.enabled,
      height:
        typeof rawHeight === "number" && Number.isFinite(rawHeight)
          ? Math.min(INVENTORY_LABEL_MAX_ROWS, Math.max(1, Math.round(rawHeight)))
          : defaultBlock.height,
      italic: typeof rawItalic === "boolean" ? rawItalic : defaultBlock.italic,
      labelVisible:
        !isInventoryLabelTextBlock(defaultBlock.key)
          ? false
          : typeof rawBlock?.labelVisible === "boolean"
            ? rawBlock.labelVisible
            : defaultBlock.labelVisible,
      order:
        typeof rawBlock?.order === "number" && Number.isFinite(rawBlock.order)
          ? rawBlock.order
          : defaultBlock.order,
      row:
        typeof rawRow === "number" && Number.isFinite(rawRow)
          ? Math.min(INVENTORY_LABEL_MAX_ROWS, Math.max(1, Math.round(rawRow)))
          : defaultBlock.row,
      size:
        rawSize === "SMALL" || rawSize === "NORMAL" || rawSize === "LARGE"
          ? rawSize
          : defaultBlock.size,
      underline:
        typeof rawUnderline === "boolean"
          ? rawUnderline
          : defaultBlock.underline,
      width:
        typeof rawWidth === "number" && Number.isFinite(rawWidth)
          ? Math.min(
              INVENTORY_LABEL_MAX_COLUMNS,
              Math.max(1, Math.round(rawWidth)),
            )
          : defaultBlock.width,
      widthAuto:
        typeof rawWidthAuto === "boolean"
          ? rawWidthAuto
          : defaultBlock.widthAuto,
      widthMm:
        typeof rawWidthMm === "number" && Number.isFinite(rawWidthMm)
          ? Math.min(500, Math.max(0, Math.round(rawWidthMm * 10) / 10))
          : defaultBlock.widthMm,
    };
  }).sort((left, right) => left.order - right.order);
}

export function getInventoryLabelBlockMeta(key: InventoryLabelBlockKey) {
  return INVENTORY_LABEL_BLOCKS.find((block) => block.key === key);
}

export function getInventoryLabelCodeType(value: string): InventoryLabelCodeType {
  return value === "QR" ? "QR" : "DATAMATRIX";
}

export type InventoryLabelItem = {
  category?: {
    id?: string;
    name: string;
    parentCategory?: {
      id?: string;
      name: string;
    } | null;
  } | null;
  currentLocationLabel?: string | null;
  currentProject?: {
    name: string;
    projectNumber: string | null;
  } | null;
  inventoryNumber?: string | null;
  stixId?: string | null;
  licensePlate?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  attachmentType?: string | null;
  name: string;
  objectNumber?: string | null;
  responsibleCrew?: {
    name: string;
  } | null;
  responsibleEmployee?: {
    firstName: string;
    lastName: string;
  } | null;
  responsibleType?: string | null;
  serialNumber?: string | null;
  status?: string | null;
};

export function getInventoryLabelValue(
  item: InventoryLabelItem,
  key: InventoryLabelBlockKey,
) {
  if (key === "objectNumber") return item.objectNumber ?? "";
  if (key === "inventoryNumber") return item.inventoryNumber ?? "";
  if (key === "stixId") return item.stixId ?? "";
  if (key === "name") return item.name;
  if (key === "category") return getInventoryCategoryLabelForLabel(item.category);
  if (key === "manufacturer") return item.manufacturer ?? "";
  if (key === "model") return item.model ?? "";
  if (key === "attachmentType") return item.attachmentType ?? "";
  if (key === "serialNumber") return item.serialNumber ?? "";
  if (key === "licensePlate") return item.licensePlate ?? "";
  if (key === "responsible") return getInventoryResponsibleLabel(item);
  if (key === "location") return getInventoryLocationLabel(item);
  if (key === "status") return getInventoryStatusLabel(item.status);
  if (key === "code") {
    return item.objectNumber ?? item.inventoryNumber ?? item.stixId ?? "";
  }
  if (key === "companyLogo") return "";
  if (isInventoryLabelSpacerBlock(key)) return "";

  return "";
}

function getInventoryCategoryLabelForLabel(
  category: InventoryLabelItem["category"],
) {
  if (!category) return "";

  return category.parentCategory
    ? `${category.parentCategory.name} › ${category.name}`
    : category.name;
}

export function getInventoryResponsibleLabel(item: InventoryLabelItem) {
  if (item.responsibleType === "EMPLOYEE" && item.responsibleEmployee) {
    return `${item.responsibleEmployee.lastName}, ${item.responsibleEmployee.firstName}`;
  }

  if (item.responsibleType === "CREW" && item.responsibleCrew) {
    return item.responsibleCrew.name;
  }

  return "";
}

export function getInventoryLocationLabel(item: InventoryLabelItem) {
  if (item.currentLocationLabel) return item.currentLocationLabel;

  if (item.currentProject) {
    return [item.currentProject.projectNumber, item.currentProject.name]
      .filter(Boolean)
      .join(" · ");
  }

  return "";
}

export function getInventoryStatusLabel(status: string | null | undefined) {
  if (status === "DEFECT") return "Defekt";
  if (status === "LOCKED") return "Gesperrt";
  if (status === "IN_SERVICE") return "In Wartung";
  return "Aktiv";
}

export function calculateInventoryLabelLength(
  blocks: InventoryLabelBlock[],
  item?: InventoryLabelItem | null,
  columnCount = 6,
  tapeWidthMm = 24,
  rowCount = INVENTORY_LABEL_MAX_ROWS,
) {
  const enabledBlocks = blocks.filter((block) => block.enabled);

  if (enabledBlocks.length === 0) {
    return 35;
  }

  const rightMostColumnLength = enabledBlocks.reduce(
    (max, block) =>
      Math.max(max, block.col + getEffectiveInventoryLabelBlockWidth(block, columnCount) - 1),
    0,
  );
  const rowDepthLength = enabledBlocks.reduce(
    (max, block) => Math.max(max, block.row + block.height - 1),
    0,
  );
  const contentLength = enabledBlocks.reduce((max, block) => {
    if (isInventoryLabelSpacerBlock(block.key)) {
      return Math.max(
        max,
        getColumnOffsetEstimateMm(block.col) + getRequiredBlockWidthMm(block, 8),
      );
    }

    if (block.key === "code" || block.key === "companyLogo") {
      return Math.max(
        max,
        getRequiredVisualBlockLength(block, columnCount, tapeWidthMm, rowCount),
      );
    }

    const value = item ? getInventoryLabelValue(item, block.key) : "";
    const meta = getInventoryLabelBlockMeta(block.key);
    const valueText = value.trim();
    const labelText =
      valueText && block.labelVisible && meta?.label ? `${meta.label}: ` : "";
    const neededCellWidthMm =
      14 +
      (getTextWidthEstimateMm(valueText, block.size) +
        getTextWidthEstimateMm(labelText, block.size) * 0.82) *
        1.52;
    const requiredCellWidthMm = getRequiredBlockWidthMm(block, neededCellWidthMm);
    const effectiveWidth = getEffectiveInventoryLabelBlockWidth(block, columnCount);
    const leftOffsetMm = getColumnOffsetEstimateMm(block.col);
    const requiredTotalLengthForCell =
      (requiredCellWidthMm * Math.max(1, columnCount)) /
        Math.max(1, effectiveWidth) +
      leftOffsetMm;
    const heightRelief = Math.max(1, block.height * 0.72);
    const estimatedLength =
      block.widthAuto || block.height <= 1
        ? requiredTotalLengthForCell
        : requiredTotalLengthForCell / heightRelief;

    return Math.max(max, estimatedLength);
  }, 0);
  const minimumLength = enabledBlocks.some(
    (block) => block.key === "code" || block.key === "companyLogo",
  )
    ? 24
    : 18;

  return Math.min(
    220,
    Math.max(
      minimumLength,
      Math.ceil(
        Math.max(
          minimumLength,
          contentLength,
          10 + rightMostColumnLength * 4,
          12 + rowDepthLength * 3,
        ),
      ),
    ),
  );
}

function getTextWidthEstimateMm(text: string, size: InventoryLabelBlockSize) {
  if (!text) return 0;

  const averageCharWidthMm =
    size === "LARGE" ? 1.42 : size === "SMALL" ? 0.82 : 1.08;

  return text.length * averageCharWidthMm;
}

function getRequiredVisualBlockLength(
  block: InventoryLabelBlock,
  columnCount: number,
  tapeWidthMm: number,
  rowCount: number,
) {
  const rows = Math.max(1, rowCount);
  const blockHeightShare = Math.min(rows, Math.max(1, block.height)) / rows;
  const visualHeightMm = Math.max(8, tapeWidthMm * blockHeightShare - 2);
  const requiredCellWidthMm =
    block.key === "code" ? Math.max(16, visualHeightMm) : 20;
  const requiredBlockWidthMm = getRequiredBlockWidthMm(block, requiredCellWidthMm);
  const effectiveWidth = getEffectiveInventoryLabelBlockWidth(block, columnCount);

  return (
    (requiredBlockWidthMm * Math.max(1, columnCount)) /
      Math.max(1, effectiveWidth) +
    getColumnOffsetEstimateMm(block.col)
  );
}

function getRequiredBlockWidthMm(
  block: InventoryLabelBlock,
  fallbackWidthMm: number,
) {
  return block.widthMm && block.widthMm > 0
    ? Math.max(block.widthMm, fallbackWidthMm)
    : fallbackWidthMm;
}

function getColumnOffsetEstimateMm(col: number) {
  return Math.max(0, col - 1) * 16;
}

export function getEffectiveInventoryLabelBlockWidth(
  block: InventoryLabelBlock,
  columnCount: number,
) {
  if (!block.widthAuto) return block.width;

  return Math.max(1, Math.max(1, columnCount) - block.col + 1);
}

export function isInventoryLabelSpacerBlock(key: InventoryLabelBlockKey) {
  return key === "spacer1" || key === "spacer2" || key === "spacer3";
}

export function isInventoryLabelTextBlock(key: InventoryLabelBlockKey) {
  return (
    key !== "code" &&
    key !== "companyLogo" &&
    !isInventoryLabelSpacerBlock(key)
  );
}
