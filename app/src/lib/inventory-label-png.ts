import bwipjs from "bwip-js";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import {
  calculateInventoryLabelLength,
  getEffectiveInventoryLabelBlockWidth,
  getInventoryLabelBlockMeta,
  getInventoryLabelValue,
  isInventoryLabelSpacerBlock,
  type InventoryLabelBlock,
  type InventoryLabelItem,
} from "@/lib/inventory-labels";

type PngTemplate = {
  codeType: string;
  columnCount: number;
  gapMm: number;
  orientation: string;
  rowCount: number;
  showBorder: boolean;
  tapeWidthMm: number;
};

const LIVE_PREVIEW_PIXELS_PER_MM = 3.4;
const PIXELS_PER_MM = LIVE_PREVIEW_PIXELS_PER_MM * 2;

export async function createInventoryLabelPng(input: {
  blocks: InventoryLabelBlock[];
  companyLogoUrl?: string | null;
  companyName?: string | null;
  item: InventoryLabelItem & { id: string; name: string };
  template: PngTemplate;
}) {
  const enabledBlocks = input.blocks.filter((block) => block.enabled);
  const labelLengthMm = calculateInventoryLabelLength(
    enabledBlocks,
    input.item,
    input.template.columnCount,
    input.template.tapeWidthMm,
    input.template.rowCount,
  );
  const labelWidthMm =
    input.template.orientation === "PORTRAIT"
      ? input.template.tapeWidthMm
      : labelLengthMm;
  const labelHeightMm =
    input.template.orientation === "PORTRAIT"
      ? labelLengthMm
      : input.template.tapeWidthMm;
  const svg = await createLabelSvg({
    blocks: enabledBlocks,
    codeType: input.template.codeType,
    columnCount: input.template.columnCount,
    companyLogoUrl: input.companyLogoUrl,
    companyName: input.companyName,
    gapMm: input.template.gapMm,
    item: input.item,
    labelHeightMm,
    labelWidthMm,
    rowCount: input.template.rowCount,
    showBorder: input.template.showBorder,
  });

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function createLabelSvg(input: {
  blocks: InventoryLabelBlock[];
  codeType: string;
  columnCount: number;
  companyLogoUrl?: string | null;
  companyName?: string | null;
  gapMm: number;
  item: InventoryLabelItem & { id: string; name: string };
  labelHeightMm: number;
  labelWidthMm: number;
  rowCount: number;
  showBorder: boolean;
}) {
  const widthPx = Math.round(input.labelWidthMm * PIXELS_PER_MM);
  const heightPx = Math.round(input.labelHeightMm * PIXELS_PER_MM);
  const fontFaceCss = await getFontFaceCss();
  const paddingPx = Math.max(8, Math.round(2.35 * PIXELS_PER_MM));
  const gapPx = Math.max(0, Math.round(input.gapMm * PIXELS_PER_MM));
  const innerWidthPx = Math.max(
    20,
    widthPx - paddingPx * 2 - gapPx * Math.max(0, input.columnCount - 1),
  );
  const innerHeightPx = Math.max(
    20,
    heightPx - paddingPx * 2 - gapPx * Math.max(0, input.rowCount - 1),
  );
  const cellWidthPx = innerWidthPx / Math.max(1, input.columnCount);
  const cellHeightPx = innerHeightPx / Math.max(1, input.rowCount);
  const objects = await Promise.all(
    input.blocks.map(async (block) => {
      if (isInventoryLabelSpacerBlock(block.key)) return "";

      const width = getEffectiveInventoryLabelBlockWidth(
        block,
        input.columnCount,
      );
      const box = {
        height: Math.max(2, block.height * cellHeightPx),
        width: Math.max(2, width * cellWidthPx + Math.max(0, width - 1) * gapPx),
        x: paddingPx + (block.col - 1) * (cellWidthPx + gapPx),
        y: paddingPx + (block.row - 1) * (cellHeightPx + gapPx),
      };

      if (block.key === "code") {
        const size = Math.min(box.width, box.height);
        const codeSvg = await createCodeSvg(
          input.codeType,
          input.item.objectNumber ??
            input.item.inventoryNumber ??
            input.item.stixId ??
            input.item.id,
        );

        return `<image href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(
          codeSvg,
        )}" x="${box.x + (box.width - size) / 2}" y="${
          box.y + (box.height - size) / 2
        }" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" />`;
      }

      if (block.key === "companyLogo") {
        const logoDataUrl = await getPublicImageDataUrl(input.companyLogoUrl);

        if (logoDataUrl) {
          // The uploaded logo carries its own brand colors (e.g. a red
          // accent dot) - forced to solid black here via a color-matrix
          // filter so the printed label is single-color, not a mix of
          // black text and a colored logo.
          return `<image href="${logoDataUrl}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" preserveAspectRatio="xMidYMid meet" filter="url(#forceBlack)" />`;
        }

        return renderTextPaths({
          align: "CENTER",
          box,
          fontSize: Math.max(12, Math.min(34, box.height * 0.52)),
          italic: false,
          label: null,
          underline: false,
          value: compactCompanyName(input.companyName),
          valueWeight: "BLACK",
        });
      }

      const meta = getInventoryLabelBlockMeta(block.key);
      const value = getInventoryLabelValue(input.item, block.key);

      if (!value) return "";

      return renderTextPaths({
        align: block.align,
        box,
        fontSize: getFontSizePx(block.size, box.height),
        italic: block.italic,
        label: block.labelVisible && value ? (meta?.label ?? null) : null,
        underline: block.underline,
        value,
        valueWeight: getValueWeight(block),
      });
    }),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}">
  <defs>
    <style>${fontFaceCss}</style>
    <filter id="forceBlack" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${
    input.showBorder
      ? `<rect x="2" y="2" width="${widthPx - 4}" height="${heightPx - 4}" fill="none" stroke="#000000" stroke-width="3"/>`
      : ""
  }
  ${objects.join("\n")}
</svg>`;
}

async function createCodeSvg(codeType: string, value: string) {
  if (codeType === "QR") {
    return QRCode.toString(value, {
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
      margin: 1,
      type: "svg",
      width: 512,
    });
  }

  return bwipjs.toSVG({
    bcid: "datamatrix",
    includetext: false,
    paddingheight: 1,
    paddingwidth: 1,
    scale: 12,
    text: value,
  });
}

async function renderTextPaths(input: {
  align: InventoryLabelBlock["align"];
  box: { height: number; width: number; x: number; y: number };
  fontSize: number;
  italic: boolean;
  label: string | null;
  underline: boolean;
  value: string;
  valueWeight: "REGULAR" | "SEMIBOLD" | "BOLD" | "BLACK";
}) {
  const fonts = await getMontserratFonts();
  const valueFont =
    input.valueWeight === "BLACK"
      ? fonts.black
      : input.valueWeight === "BOLD"
        ? fonts.bold
        : input.valueWeight === "SEMIBOLD"
          ? fonts.semibold
          : fonts.regular;
  const label = input.label ? `${input.label.toUpperCase()}: ` : "";
  const labelFontSize = input.fontSize * 0.65;
  const valueFontSize = input.fontSize;
  const gap = label ? Math.max(3, input.fontSize * 0.35) : 0;
  const labelWidth = label ? measureText(label, fonts.semibold, labelFontSize) : 0;
  const valueWidth = measureText(input.value, valueFont, valueFontSize);
  const totalWidth = labelWidth + gap + valueWidth;
  const startX =
    input.align === "CENTER"
      ? input.box.x + (input.box.width - totalWidth) / 2
      : input.align === "RIGHT"
        ? input.box.x + input.box.width - totalWidth - 3
        : input.box.x + 3;
  const centerY = input.box.y + input.box.height / 2;

  return [
    label
      ? renderTextRun({
          color: "#000000",
          font: fonts.semibold,
          fontSize: labelFontSize,
          italic: input.italic,
          text: label,
          x: startX,
          y: centerY,
        })
      : "",
    renderTextRun({
      color: "#000000",
      font: valueFont,
      fontSize: valueFontSize,
      italic: input.italic,
      text: input.value,
      x: startX + labelWidth + gap,
      y: centerY,
    }),
    input.underline
      ? `<line x1="${startX}" y1="${(centerY + valueFontSize * 0.48).toFixed(
          3,
        )}" x2="${(startX + totalWidth).toFixed(3)}" y2="${(
          centerY +
          valueFontSize * 0.48
        ).toFixed(3)}" stroke="#000000" stroke-width="${Math.max(
          1,
          valueFontSize * 0.08,
        ).toFixed(3)}"/>`
      : "",
  ].join("");
}

function getFontSizePx(size: InventoryLabelBlock["size"], height: number) {
  const liveCssPixels = size === "LARGE" ? 14 : size === "SMALL" ? 10 : 12;
  const exportPixels = (liveCssPixels / LIVE_PREVIEW_PIXELS_PER_MM) * PIXELS_PER_MM;
  const maxByHeight = Math.max(8, height * 0.72);

  return Math.min(exportPixels, maxByHeight);
}

// Thin/regular-weight strokes at small print sizes read as washed-out
// gray rather than solid black on most label printers, so nothing below
// BOLD is used here regardless of the block's own bold toggle.
function getValueWeight(block: InventoryLabelBlock) {
  if (!block.bold) return "BOLD";
  if (block.size === "LARGE") return "BLACK";
  if (block.size === "SMALL") return "SEMIBOLD";
  return "BOLD";
}

function compactCompanyName(companyName?: string | null) {
  return companyName?.trim() || "STIX";
}

async function getFontFaceCss() {
  const [regular, semibold] = await Promise.all([
    readPublicFont("Montserrat-Regular.ttf"),
    readPublicFont("Montserrat-SemiBold.ttf"),
  ]);

  return `
    @font-face {
      font-family: "Montserrat";
      src: url("data:font/truetype;base64,${regular}") format("truetype");
      font-weight: 400 500;
      font-style: normal;
    }
    @font-face {
      font-family: "Montserrat";
      src: url("data:font/truetype;base64,${semibold}") format("truetype");
      font-weight: 600 900;
      font-style: normal;
    }
  `;
}

type FontkitFont = {
  ascent: number;
  descent: number;
  layout: (text: string) => {
    glyphs: Array<{
      path: {
        toSVG: () => string;
      };
    }>;
    positions: Array<{
      xAdvance: number;
      xOffset: number;
      yOffset: number;
    }>;
  };
  unitsPerEm: number;
};

type FontkitVariableFont = FontkitFont & {
  getVariation: (coordinates: { wght: number }) => FontkitFont;
};

let montserratFontsPromise:
  | Promise<{
      black: FontkitFont;
      bold: FontkitFont;
      regular: FontkitFont;
      semibold: FontkitFont;
    }>
  | null = null;

async function getMontserratFonts() {
  montserratFontsPromise ??= Promise.all([
    readFile(path.join(process.cwd(), "public", "fonts", "Montserrat-Regular.ttf")),
    readFile(path.join(process.cwd(), "public", "fonts", "Montserrat-SemiBold.ttf")),
    readFile(path.join(process.cwd(), "public", "fonts", "Montserrat-Variable.ttf")),
  ]).then(([regular, semibold, variable]) => {
    const variableFont = fontkit.create(variable) as unknown as FontkitVariableFont;

    return {
      black: variableFont.getVariation({ wght: 900 }) as FontkitFont,
      bold: variableFont.getVariation({ wght: 700 }) as FontkitFont,
      regular: fontkit.create(regular) as FontkitFont,
      semibold: fontkit.create(semibold) as FontkitFont,
    };
  });

  return montserratFontsPromise;
}

function measureText(text: string, font: FontkitFont, fontSize: number) {
  const scale = fontSize / font.unitsPerEm;
  const run = font.layout(text);

  return run.positions.reduce(
    (total, position) => total + position.xAdvance * scale,
    0,
  );
}

function renderTextRun(input: {
  color: string;
  font: FontkitFont;
  fontSize: number;
  italic: boolean;
  text: string;
  x: number;
  y: number;
}) {
  const scale = input.fontSize / input.font.unitsPerEm;
  const baseline =
    input.y + ((input.font.ascent + input.font.descent) * scale) / 2;
  const run = input.font.layout(input.text);
  let cursorX = input.x;

  return run.glyphs
    .map((glyph, index) => {
      const position = run.positions[index];
      const glyphX = cursorX + (position?.xOffset ?? 0) * scale;
      const glyphY = baseline - (position?.yOffset ?? 0) * scale;
      const svgPath = glyph.path.toSVG();
      cursorX += (position?.xAdvance ?? 0) * scale;

      if (!svgPath) return "";

      const italicTransform = input.italic ? " skewX(-10)" : "";

      return `<path d="${svgPath}" fill="${input.color}" transform="translate(${glyphX.toFixed(
        3,
      )} ${glyphY.toFixed(3)})${italicTransform} scale(${scale.toFixed(6)} ${(-scale).toFixed(
        6,
      )})"/>`;
    })
    .join("");
}

async function readPublicFont(fileName: string) {
  const filePath = path.join(process.cwd(), "public", "fonts", fileName);
  const data = await readFile(filePath);

  return data.toString("base64");
}

async function getPublicImageDataUrl(publicUrl?: string | null) {
  if (!publicUrl) return null;

  try {
    if (publicUrl.startsWith("http")) {
      const response = await fetch(publicUrl);
      if (!response.ok) return null;
      const data = Buffer.from(await response.arrayBuffer());
      const mimeType = getImageMimeType(publicUrl.split("?")[0] ?? "");

      return `data:${mimeType};base64,${data.toString("base64")}`;
    }

    if (!publicUrl.startsWith("/")) return null;

    const cleanPath = publicUrl.split("?")[0]?.replace(/^\/+/, "");
    if (!cleanPath) return null;
    const filePath = path.join(process.cwd(), "public", cleanPath);
    const data = await readFile(filePath);
    const mimeType = getImageMimeType(filePath);

    return `data:${mimeType};base64,${data.toString("base64")}`;
  } catch {
    return null;
  }
}

function getImageMimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  return "image/png";
}
