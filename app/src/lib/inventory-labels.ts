export const INVENTORY_LABEL_TAPE_WIDTHS = [9, 12, 24, 36] as const;

export type InventoryLabelCodeType = "DATAMATRIX" | "QR";
export type InventoryLabelBlockAlign = "LEFT" | "CENTER" | "RIGHT";
export type InventoryLabelBlockSize = "SMALL" | "NORMAL" | "LARGE";
export type InventoryLabelBlockRotation = 0 | 90 | 180 | 270;
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

/** A block's position/size is a real, absolute mm box on the label
 * canvas - not tied to any row/column grid. `xMm`/`yMm` are relative to
 * the canvas's own already-oriented top-left corner (i.e. whatever
 * `labelWidthMm`/`labelHeightMm` a renderer resolves for the template's
 * orientation - the same axis convention the old col/row grid used). */
export type InventoryLabelBlock = {
  align: InventoryLabelBlockAlign;
  bold: boolean;
  enabled: boolean;
  heightMm: number;
  italic: boolean;
  key: InventoryLabelBlockKey;
  labelVisible: boolean;
  order: number;
  rotation: InventoryLabelBlockRotation;
  size: InventoryLabelBlockSize;
  underline: boolean;
  widthAuto: boolean;
  widthMm: number;
  xMm: number;
  yMm: number;
};

/** Authoring metadata only - a plausible starting row/column layout used
 * once at module load to compute `DEFAULT_INVENTORY_LABEL_BLOCKS` via the
 * same legacy-grid-to-absolute conversion used to migrate real templates.
 * Not used at runtime for actual layout. */
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

const LEGACY_PADDING_MM = 2.35;

const DEFAULT_ENABLED_KEYS: InventoryLabelBlockKey[] = [
  "objectNumber",
  "code",
  "name",
  "manufacturer",
  "model",
];

const REFERENCE_GEOMETRY: LegacyGridGeometry = {
  columnCount: 6,
  gapMm: 1,
  labelHeightMm: 24,
  labelWidthMm: 70,
  rowCount: 4,
};

export const DEFAULT_INVENTORY_LABEL_BLOCKS: InventoryLabelBlock[] = (() => {
  const legacyRaw = INVENTORY_LABEL_BLOCKS.map((meta, index) => ({
    col: meta.defaultCol,
    enabled: DEFAULT_ENABLED_KEYS.includes(meta.key),
    height: meta.defaultHeight,
    key: meta.key,
    order: index + 1,
    row: meta.defaultRow,
    width: meta.defaultWidth,
    widthMm: null,
  }));
  const migrated = migrateLegacyRawBlocks(legacyRaw, REFERENCE_GEOMETRY);

  return migrated.map((raw, index) => {
    const meta = INVENTORY_LABEL_BLOCKS[index];

    return {
      align: "LEFT",
      bold: meta.defaultSize !== "SMALL",
      enabled: Boolean(raw.enabled),
      heightMm: raw.heightMm as number,
      italic: false,
      key: meta.key,
      labelVisible: isInventoryLabelTextBlock(meta.key),
      order: index + 1,
      rotation: 0,
      size: meta.defaultSize,
      underline: false,
      widthAuto: false,
      widthMm: raw.widthMm as number,
      xMm: raw.xMm as number,
      yMm: raw.yMm as number,
    };
  });
})();

export type InventoryLabelTemplateLike = {
  blocksJson: string;
  codeType: string;
  columnCount: number;
  gapMm: number;
  id: string;
  isDefault: boolean;
  labelLengthMm: number;
  labelLengthOverrideMm: number | null;
  name: string;
  orientation: string;
  rowCount: number;
  showBorder: boolean;
  snapMm: number;
  tapeWidthMm: number;
};

export type LegacyGridGeometry = {
  columnCount: number;
  gapMm: number;
  labelHeightMm: number;
  labelWidthMm: number;
  rowCount: number;
};

type LegacyRawBlock = Record<string, unknown>;

/** Every renderer resolves the template's orientation into a concrete
 * `labelWidthMm`/`labelHeightMm` pair (landscape: width = length, height
 * = tape; portrait: swapped). Legacy `col`/`row` grid coordinates always
 * mapped directly onto that already-oriented X/Y - so does the new
 * `xMm`/`yMm` model - which is what lets the migration below convert one
 * into the other without needing to know orientation itself. */
export function getInventoryLabelLegacyGeometry(
  template: Pick<
    InventoryLabelTemplateLike,
    | "columnCount"
    | "gapMm"
    | "labelLengthMm"
    | "labelLengthOverrideMm"
    | "orientation"
    | "rowCount"
    | "tapeWidthMm"
  >,
): LegacyGridGeometry {
  const lengthMm = template.labelLengthOverrideMm ?? template.labelLengthMm;
  const isPortrait = template.orientation === "PORTRAIT";

  return {
    columnCount: Math.max(1, Math.round(template.columnCount) || 1),
    gapMm: Math.max(0, template.gapMm || 0),
    labelHeightMm: isPortrait ? lengthMm : template.tapeWidthMm,
    labelWidthMm: isPortrait ? template.tapeWidthMm : lengthMm,
    rowCount: Math.max(1, Math.round(template.rowCount) || 1),
  };
}

function isLegacyRawBlockShape(rawArray: LegacyRawBlock[]) {
  return rawArray.some(
    (raw) => typeof raw.col === "number" && typeof raw.xMm !== "number",
  );
}

/** Converts blocks stored in the old row/column grid shape (`col`/`row`/
 * `width`(colspan)/`height`(rowspan), optionally a pinned `widthMm` on a
 * single-column block) into the new absolute `xMm`/`yMm`/`widthMm`/
 * `heightMm` shape - reproducing the exact box math that was live in
 * `inventory-label-png.ts` right before free positioning replaced it, so
 * a template keeps its current appearance the moment it's read once
 * more (parse-time, lazy - no separate migration script/window). */
function migrateLegacyRawBlocks(
  rawArray: LegacyRawBlock[],
  geometry: LegacyGridGeometry,
): LegacyRawBlock[] {
  const columnCount = geometry.columnCount;
  const rowCount = geometry.rowCount;
  const gapMm = geometry.gapMm;
  const innerWidthMm = Math.max(
    8,
    geometry.labelWidthMm - LEGACY_PADDING_MM * 2 - gapMm * Math.max(0, columnCount - 1),
  );
  const innerHeightMm = Math.max(
    6,
    geometry.labelHeightMm - LEGACY_PADDING_MM * 2 - gapMm * Math.max(0, rowCount - 1),
  );
  const cellHeightMm = innerHeightMm / rowCount;

  const pinnedWidthsMm: (number | null)[] = Array.from({ length: columnCount }, () => null);
  for (const raw of rawArray) {
    const width = clampToInt(raw.width, 1, columnCount, 1);
    const col = clampToInt(raw.col, 1, columnCount, 1);
    const widthMm =
      typeof raw.widthMm === "number" && Number.isFinite(raw.widthMm) ? raw.widthMm : null;
    if (raw.enabled !== false && width === 1 && widthMm && widthMm > 0) {
      const index = col - 1;
      pinnedWidthsMm[index] = Math.max(pinnedWidthsMm[index] ?? 0, widthMm);
    }
  }

  const fixedTotalMm = pinnedWidthsMm.reduce((sum: number, w) => sum + (w ?? 0), 0);
  const flexColumnCount = pinnedWidthsMm.filter((w) => w === null).length;
  const flexWidthMm =
    flexColumnCount > 0 ? Math.max(0, innerWidthMm - fixedTotalMm) / flexColumnCount : 0;
  const resolvedColumnWidthsMm = pinnedWidthsMm.map((w) => w ?? flexWidthMm);
  const columnOffsetsMm: number[] = [];
  let cursorMm = LEGACY_PADDING_MM;
  for (const width of resolvedColumnWidthsMm) {
    columnOffsetsMm.push(cursorMm);
    cursorMm += width + gapMm;
  }

  return rawArray.map((raw) => {
    const col = clampToInt(raw.col, 1, columnCount, 1);
    const row = clampToInt(raw.row, 1, rowCount, 1);
    const width = clampToInt(raw.width, 1, columnCount, 1);
    const height = clampToInt(raw.height, 1, rowCount, 1);
    let spanWidthMm = 0;
    for (let index = 0; index < width; index += 1) {
      spanWidthMm += resolvedColumnWidthsMm[col - 1 + index] ?? flexWidthMm;
    }
    spanWidthMm += Math.max(0, width - 1) * gapMm;

    return {
      ...raw,
      heightMm: round1(Math.max(2, height * cellHeightMm)),
      widthMm: round1(Math.max(2, spanWidthMm)),
      xMm: round1(columnOffsetsMm[col - 1] ?? LEGACY_PADDING_MM),
      yMm: round1(LEGACY_PADDING_MM + (row - 1) * (cellHeightMm + gapMm)),
    };
  });
}

function clampToInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, parsed));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function parseInventoryLabelBlocks(
  blocksJson: string | null | undefined,
  geometry: LegacyGridGeometry,
) {
  let rawBlocks: unknown = null;

  try {
    rawBlocks = blocksJson ? JSON.parse(blocksJson) : null;
  } catch {
    rawBlocks = null;
  }

  let rawArray: LegacyRawBlock[] = Array.isArray(rawBlocks)
    ? (rawBlocks as LegacyRawBlock[])
    : [];

  if (isLegacyRawBlockShape(rawArray)) {
    rawArray = migrateLegacyRawBlocks(rawArray, geometry);
  }

  const rawByKey = new Map<string, LegacyRawBlock>();
  for (const rawBlock of rawArray) {
    if (!rawBlock || typeof rawBlock !== "object") continue;
    const key = String(rawBlock.key ?? "");
    rawByKey.set(key, rawBlock);
  }

  return DEFAULT_INVENTORY_LABEL_BLOCKS.map((defaultBlock) => {
    const rawBlock = rawByKey.get(defaultBlock.key);
    const rawAlign = rawBlock?.align;
    const rawBold = rawBlock?.bold;
    const rawHeightMm = rawBlock?.heightMm;
    const rawItalic = rawBlock?.italic;
    const rawRotation = rawBlock?.rotation;
    const rawSize = rawBlock?.size;
    const rawUnderline = rawBlock?.underline;
    const rawWidthAuto = rawBlock?.widthAuto;
    const rawWidthMm = rawBlock?.widthMm;
    const rawXMm = rawBlock?.xMm;
    const rawYMm = rawBlock?.yMm;

    return {
      ...defaultBlock,
      align:
        rawAlign === "CENTER" || rawAlign === "RIGHT" || rawAlign === "LEFT"
          ? rawAlign
          : defaultBlock.align,
      bold: typeof rawBold === "boolean" ? rawBold : defaultBlock.bold,
      enabled:
        typeof rawBlock?.enabled === "boolean" ? rawBlock.enabled : defaultBlock.enabled,
      heightMm:
        typeof rawHeightMm === "number" && Number.isFinite(rawHeightMm)
          ? Math.max(2, Math.round(rawHeightMm * 10) / 10)
          : defaultBlock.heightMm,
      italic: typeof rawItalic === "boolean" ? rawItalic : defaultBlock.italic,
      labelVisible: !isInventoryLabelTextBlock(defaultBlock.key)
        ? false
        : typeof rawBlock?.labelVisible === "boolean"
          ? rawBlock.labelVisible
          : defaultBlock.labelVisible,
      order:
        typeof rawBlock?.order === "number" && Number.isFinite(rawBlock.order)
          ? rawBlock.order
          : defaultBlock.order,
      rotation:
        rawRotation === 90 || rawRotation === 180 || rawRotation === 270
          ? rawRotation
          : defaultBlock.rotation,
      size:
        rawSize === "SMALL" || rawSize === "NORMAL" || rawSize === "LARGE"
          ? rawSize
          : defaultBlock.size,
      underline: typeof rawUnderline === "boolean" ? rawUnderline : defaultBlock.underline,
      widthAuto: typeof rawWidthAuto === "boolean" ? rawWidthAuto : defaultBlock.widthAuto,
      widthMm:
        typeof rawWidthMm === "number" && Number.isFinite(rawWidthMm)
          ? Math.max(2, Math.round(rawWidthMm * 10) / 10)
          : defaultBlock.widthMm,
      xMm:
        typeof rawXMm === "number" && Number.isFinite(rawXMm)
          ? Math.round(rawXMm * 10) / 10
          : defaultBlock.xMm,
      yMm:
        typeof rawYMm === "number" && Number.isFinite(rawYMm)
          ? Math.round(rawYMm * 10) / 10
          : defaultBlock.yMm,
    };
  }).sort((left, right) => left.order - right.order);
}

/** Keeps a block's box fully inside the current canvas after a drag/
 * resize or a template dimension change. */
export function clampBlockToCanvas(
  block: InventoryLabelBlock,
  canvasWidthMm: number,
  canvasHeightMm: number,
): InventoryLabelBlock {
  const widthMm = Math.min(Math.max(2, canvasWidthMm), Math.max(2, block.widthMm));
  const heightMm = Math.min(Math.max(2, canvasHeightMm), Math.max(2, block.heightMm));
  const xMm = Math.min(Math.max(0, canvasWidthMm - widthMm), Math.max(0, block.xMm));
  const yMm = Math.min(Math.max(0, canvasHeightMm - heightMm), Math.max(0, block.yMm));

  return {
    ...block,
    heightMm: round1(heightMm),
    widthMm: round1(widthMm),
    xMm: round1(xMm),
    yMm: round1(yMm),
  };
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
  return [
    item.responsibleEmployee
      ? `${item.responsibleEmployee.lastName}, ${item.responsibleEmployee.firstName}`
      : null,
    item.responsibleCrew?.name ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
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
  if (status === "STOLEN") return "Gestohlen";
  if (status === "INACTIVE" || status === "DELETED") return "Archiviert";
  return "Aktiv";
}

/** The width a block actually renders at: its own `widthMm`, unless
 * `widthAuto` is set, in which case it stretches to the right edge of
 * the canvas (minus a little breathing room) instead of wrapping. */
export function getInventoryLabelBlockRenderWidthMm(
  block: InventoryLabelBlock,
  labelWidthMm: number,
) {
  if (!block.widthAuto) return block.widthMm;

  return Math.max(block.widthMm, labelWidthMm - block.xMm - 2);
}

function getEstimatedRequiredWidthMm(
  block: InventoryLabelBlock,
  item: InventoryLabelItem | null | undefined,
) {
  if (!block.widthAuto) return block.widthMm;
  if (
    isInventoryLabelSpacerBlock(block.key) ||
    block.key === "code" ||
    block.key === "companyLogo"
  ) {
    return block.widthMm;
  }

  const value = item ? getInventoryLabelValue(item, block.key) : "";
  const meta = getInventoryLabelBlockMeta(block.key);
  const valueText = value.trim();
  const labelText = valueText && block.labelVisible && meta?.label ? `${meta.label}: ` : "";

  return Math.max(
    block.widthMm,
    6 +
      (getTextWidthEstimateMm(valueText, block.size) +
        getTextWidthEstimateMm(labelText, block.size) * 0.82) *
        1.15,
  );
}

function getTextWidthEstimateMm(text: string, size: InventoryLabelBlockSize) {
  if (!text) return 0;

  const averageCharWidthMm =
    size === "LARGE" ? 1.42 : size === "SMALL" ? 0.82 : 1.08;

  return text.length * averageCharWidthMm;
}

/** With every block now carrying a real, exact width/height, the
 * required label length is simply "how far the farthest block reaches"
 * along whichever axis is currently the auto-growing one (X in
 * landscape, Y in portrait - the other axis is the fixed tape width). */
export function calculateInventoryLabelLength(
  blocks: InventoryLabelBlock[],
  item: InventoryLabelItem | null | undefined,
  orientation: string,
) {
  const enabledBlocks = blocks.filter((block) => block.enabled);

  if (enabledBlocks.length === 0) {
    return 35;
  }

  const isPortrait = orientation === "PORTRAIT";
  const farEdgeMm = enabledBlocks.reduce((max, block) => {
    const positionMm = isPortrait ? block.yMm : block.xMm;
    const sizeMm = isPortrait ? block.heightMm : getEstimatedRequiredWidthMm(block, item);

    return Math.max(max, positionMm + sizeMm);
  }, 0);
  const minimumLength = enabledBlocks.some(
    (block) => block.key === "code" || block.key === "companyLogo",
  )
    ? 24
    : 18;

  return Math.min(220, Math.max(minimumLength, Math.ceil(farEdgeMm + 2)));
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
