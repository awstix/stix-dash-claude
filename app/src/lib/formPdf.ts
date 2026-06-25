import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import sharp from "sharp";
import type { ProjectFormFieldDefinition } from "@/app/projects/projectFormTypes";

const textColor = rgb(0.08, 0.08, 0.08);
const mutedColor = rgb(0.38, 0.4, 0.44);
const lineColor = rgb(0.82, 0.83, 0.85);
const lightFill = rgb(0.965, 0.968, 0.972);
export async function createFormPdf(input: {
  companyInfo: FormPdfCompanyInfo;
  createdByName: string | null;
  fields: ProjectFormFieldDefinition[];
  formDate: Date | null;
  paperOrientation: "LANDSCAPE" | "PORTRAIT";
  paperSize: "A4" | "A5";
  project: {
    constructionManager: string | null;
    name: string;
    projectNumber: string;
    siteAddress: string | null;
  };
  templateName: string;
  title: string;
  values: Record<string, boolean | string>;
}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regularBytes, semiBoldBytes] = await Promise.all([
    readFile(
      path.join(
        process.cwd(),
        "public",
        "fonts",
        "Montserrat-Regular.ttf",
      ),
    ),
    readFile(
      path.join(
        process.cwd(),
        "public",
        "fonts",
        "Montserrat-SemiBold.ttf",
      ),
    ),
  ]);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(semiBoldBytes, { subset: true });
  const companyLogo = await embedCompanyLogo(
    pdf,
    input.companyInfo.logoPublicUrl,
  );
  const dimensions = getPageDimensions(
    input.paperSize,
    input.paperOrientation,
  );
  const margin = input.paperSize === "A5" ? 28 : 36;
  const gap = 10;
  const contentWidth = dimensions.width - margin * 2;
  const headerHeight = input.paperSize === "A5" ? 124 : 136;
  const footerHeight = 30;
  const hasCompanyElement = input.fields.some(
    (field) => field.type === "companydata",
  );
  const effectiveHeaderHeight = hasCompanyElement
    ? input.paperSize === "A5"
      ? 62
      : 70
    : headerHeight;
  let page = addPage();
  let y = dimensions.height - margin - effectiveHeaderHeight;
  let row: Array<{
    field: ProjectFormFieldDefinition;
    value: boolean | string | undefined;
  }> = [];
  let usedColumns = 0;

  for (const field of input.fields) {
    const width = Math.max(1, Math.min(6, field.width));
    if (usedColumns + width > 6) {
      await drawRow(row);
      row = [];
      usedColumns = 0;
    }
    row.push({ field, value: input.values[field.id] });
    usedColumns += width;
    if (usedColumns === 6) {
      await drawRow(row);
      row = [];
      usedColumns = 0;
    }
  }
  if (row.length > 0) {
    await drawRow(row);
  }

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => {
    const label = `${index + 1}/${pages.length} Seiten`;
    const width = regular.widthOfTextAtSize(label, 8);
    pdfPage.drawText(label, {
      color: mutedColor,
      font: regular,
      size: 8,
      x: dimensions.width - margin - width,
      y: 16,
    });
  });

  return pdf.save();

  function addPage() {
    const nextPage = pdf.addPage([dimensions.width, dimensions.height]);
    if (!hasCompanyElement) {
      drawCompanyHeader(
        nextPage,
        bold,
        regular,
        margin,
        dimensions.width,
        input.companyInfo,
        companyLogo,
      );
    }
    drawDocumentHeader(nextPage);
    return nextPage;
  }

  function drawDocumentHeader(targetPage: PDFPage) {
    const top =
      dimensions.height -
      margin -
      (hasCompanyElement
        ? input.paperSize === "A5"
          ? 12
          : 16
        : input.paperSize === "A5"
          ? 76
          : 84);
    targetPage.drawText(input.title || input.templateName, {
      color: textColor,
      font: bold,
      size: input.paperSize === "A5" ? 14 : 16,
      x: margin,
      y: top,
    });
    const contextParts = [
      input.project.projectNumber,
      input.project.name,
    ].filter(
      (value, index, values) =>
        Boolean(value?.trim()) && values.indexOf(value) === index,
    );
    const metadata = [
      contextParts.join(" · "),
      input.formDate
        ? new Intl.DateTimeFormat("de-DE").format(input.formDate)
        : "",
      input.createdByName ? `Ausgefüllt von: ${input.createdByName}` : "",
    ].filter(Boolean);
    targetPage.drawText(metadata.join("  ·  "), {
      color: mutedColor,
      font: regular,
      size: 8,
      x: margin,
      y: top - 16,
    });
    targetPage.drawLine({
      color: lineColor,
      end: { x: dimensions.width - margin, y: top - 25 },
      start: { x: margin, y: top - 25 },
      thickness: 0.8,
    });
  }

  async function drawRow(
    items: Array<{
      field: ProjectFormFieldDefinition;
      value: boolean | string | undefined;
    }>,
  ) {
    if (items.length === 0) return;
    const availableWidth = contentWidth - gap * (items.length - 1);
    const widths = items.map(
      ({ field }) => (availableWidth * field.width) / items.reduce(
        (sum, item) => sum + item.field.width,
        0,
      ),
    );
    const heights = items.map(({ field, value }, index) =>
      measureFieldHeight(field, value, widths[index], regular),
    );
    const rowHeight = Math.max(...heights);

    if (y - rowHeight < footerHeight + margin) {
      page = addPage();
      y = dimensions.height - margin - effectiveHeaderHeight;
    }

    let x = margin;
    for (const [index, item] of items.entries()) {
      await drawField(page, item.field, item.value, {
        height: rowHeight,
        width: widths[index],
        x,
        y: y - rowHeight,
      });
      x += widths[index] + gap;
    }
    y -= rowHeight + gap;
  }

  async function drawField(
    targetPage: PDFPage,
    field: ProjectFormFieldDefinition,
    rawValue: boolean | string | undefined,
    box: { height: number; width: number; x: number; y: number },
  ) {
    if (field.type === "divider") {
      targetPage.drawLine({
        color: lineColor,
        end: { x: box.x + box.width, y: box.y + box.height / 2 },
        start: { x: box.x, y: box.y + box.height / 2 },
        thickness: 1,
      });
      if (field.label) {
        targetPage.drawText(field.label, {
          color: textColor,
          font: bold,
          size: 9,
          x: box.x,
          y: box.y + box.height / 2 + 5,
        });
      }
      return;
    }

    if (field.type === "companydata") {
      await drawCompanyInfoElement(targetPage, box, input.companyInfo);
      return;
    }

    const value = formatValue(rawValue);
    targetPage.drawRectangle({
      borderColor: lineColor,
      borderWidth: 0.8,
      color: lightFill,
      height: box.height,
      width: box.width,
      x: box.x,
      y: box.y,
    });
    targetPage.drawText(
      `${field.label}${field.required ? " *" : ""}`,
      {
        color: mutedColor,
        font: bold,
        size: 7.5,
        x: box.x + 7,
        y: box.y + box.height - 13,
      },
    );

    if (field.type === "photo" && value.startsWith("/uploads/")) {
      const imageDrawn = await drawPhoto(targetPage, value, {
        height: box.height - 26,
        width: box.width - 14,
        x: box.x + 7,
        y: box.y + 7,
      });
      if (imageDrawn) return;
    }

    const font = field.type === "signature" ? regular : regular;
    const fontSize = field.type === "signature" ? 11 : 9;
    const lines = wrapText(
      value || "-",
      font,
      fontSize,
      box.width - 14,
    ).slice(0, Math.max(1, Math.floor((box.height - 25) / 12)));
    lines.forEach((line, lineIndex) => {
      targetPage.drawText(line, {
        color: textColor,
        font,
        size: fontSize,
        x: box.x + 7,
        y: box.y + box.height - 28 - lineIndex * 12,
      });
    });
  }

  async function drawPhoto(
    targetPage: PDFPage,
    publicUrl: string,
    box: { height: number; width: number; x: number; y: number },
  ) {
    if (!publicUrl.startsWith("/uploads/project-photos/")) return false;
    try {
      const absolutePath = path.resolve(
        process.cwd(),
        "public",
        publicUrl.replace(/^\/+/, ""),
      );
      const source = await readFile(absolutePath);
      const optimized = await sharp(source)
        .rotate()
        .resize({
          fit: "inside",
          height: 900,
          width: 1200,
          withoutEnlargement: true,
        })
        .jpeg({ quality: 82 })
        .toBuffer();
      const embedded = await pdf.embedJpg(optimized);
      const scale = Math.min(
        box.width / embedded.width,
        box.height / embedded.height,
      );
      const width = embedded.width * scale;
      const height = embedded.height * scale;
      targetPage.drawImage(embedded, {
        height,
        width,
        x: box.x + (box.width - width) / 2,
        y: box.y + (box.height - height) / 2,
      });
      return true;
    } catch {
      return false;
    }
  }

  async function drawCompanyInfoElement(
    targetPage: PDFPage,
    box: { height: number; width: number; x: number; y: number },
    company: FormPdfCompanyInfo,
  ) {
    targetPage.drawRectangle({
      borderColor: lineColor,
      borderWidth: 0.8,
      color: rgb(1, 1, 1),
      height: box.height,
      width: box.width,
      x: box.x,
      y: box.y,
    });
    const logoWidth = Math.min(130, box.width * 0.32);
    let textX = box.x + 10;
    let logoDrawn = false;
    if (company.logoPublicUrl) {
      logoDrawn = Boolean(companyLogo);
      if (logoDrawn) {
        drawImageContained(targetPage, companyLogo!, {
          height: box.height - 20,
          width: logoWidth - 10,
          x: box.x + 10,
          y: box.y + 10,
        });
        textX = box.x + logoWidth + 10;
      }
    }
    if (textX === box.x + 10) {
      targetPage.drawText(company.companyName, {
        color: textColor,
        font: bold,
        size: 13,
        x: textX,
        y: box.y + box.height - 22,
      });
    }
    const lines = logoDrawn
      ? getCompanyLines(company)
      : [
          company.legalName,
          getCompanyAddress(company),
          getCompanyContacts(company),
        ].filter((line): line is string => Boolean(line));
    lines.forEach((line, index) => {
      targetPage.drawText(line, {
        color: index === 0 ? textColor : mutedColor,
        font: logoDrawn && index === 0 ? bold : regular,
        size: logoDrawn && index === 0 ? 8.5 : 7.5,
        x: textX,
        y:
          box.y +
          box.height -
          (logoDrawn ? 18 : 38) -
          index * 11,
      });
    });
    drawSocialMediaIcons(
      targetPage,
      company,
      textX,
      box.y + 12,
      regular,
      bold,
    );
  }

}

function drawCompanyHeader(
  page: PDFPage,
  bold: PDFFont,
  regular: PDFFont,
  margin: number,
  pageWidth: number,
  company: FormPdfCompanyInfo,
  companyLogo: PDFImage | null,
) {
  const top = page.getHeight() - margin;
  if (companyLogo) {
    drawImageContained(page, companyLogo, {
      height: 42,
      width: 108,
      x: margin,
      y: top - 42,
    });
  } else {
    page.drawText(company.companyName, {
      color: textColor,
      font: bold,
      size: 14,
      x: margin,
      y: top - 20,
    });
  }
  const companyX = Math.min(margin + 122, pageWidth * 0.42);
  getCompanyLines(company).forEach((line, index) => {
    page.drawText(line, {
      color: index === 0 ? textColor : mutedColor,
      font: index === 0 ? bold : regular,
      size: index === 0 ? 8.5 : 7.5,
      x: companyX,
      y: top - 8 - index * 10,
    });
  });
  drawSocialMediaIcons(
    page,
    company,
    companyX,
    top - 52,
    regular,
    bold,
  );
}

async function embedCompanyLogo(
  pdf: PDFDocument,
  publicUrl: string | null,
) {
  if (!publicUrl?.startsWith("/uploads/company/")) return null;
  try {
    const absolutePath = path.resolve(
      process.cwd(),
      "public",
      publicUrl.replace(/^\/+/, ""),
    );
    const source = await readFile(absolutePath);
    const png = await sharp(source)
      .rotate()
      .resize({
        fit: "inside",
        height: 500,
        width: 1200,
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    return pdf.embedPng(png);
  } catch {
    return null;
  }
}

function drawImageContained(
  page: PDFPage,
  image: PDFImage,
  box: { height: number; width: number; x: number; y: number },
) {
  const scale = Math.min(
    box.width / image.width,
    box.height / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    height,
    width,
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
  });
}

function measureFieldHeight(
  field: ProjectFormFieldDefinition,
  value: boolean | string | undefined,
  width: number,
  font: PDFFont,
) {
  if (field.type === "divider") return 26;
  if (field.type === "companydata") return 100;
  if (field.type === "photo") return 150;
  if (field.type === "signature") return 74;
  if (
    field.type === "textarea" ||
    field.type === "chart" ||
    field.type === "subform"
  ) {
    return Math.max(70, wrapText(formatValue(value), font, 9, width - 14).length * 12 + 30);
  }
  return Math.max(46, wrapText(formatValue(value), font, 9, width - 14).length * 12 + 28);
}

export type FormPdfCompanyInfo = {
  city: string | null;
  companyName: string;
  country: string | null;
  email: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  legalName: string | null;
  linkedinUrl: string | null;
  logoPublicUrl: string | null;
  mobile: string | null;
  phone: string | null;
  postalCode: string | null;
  street: string | null;
  tiktokUrl: string | null;
  website: string | null;
  youtubeUrl: string | null;
};

export function normalizeFormPdfCompany(
  company: Partial<FormPdfCompanyInfo> | null,
): FormPdfCompanyInfo {
  return {
    city: company?.city ?? "Niedernberg",
    companyName: company?.companyName ?? "Josef Stix GmbH & Co. KG",
    country: company?.country ?? "Deutschland",
    email: company?.email ?? "info@stix-bau.de",
    facebookUrl: company?.facebookUrl ?? null,
    instagramUrl: company?.instagramUrl ?? null,
    legalName: company?.legalName ?? null,
    linkedinUrl: company?.linkedinUrl ?? null,
    logoPublicUrl: company?.logoPublicUrl ?? null,
    mobile: company?.mobile ?? null,
    phone: company?.phone ?? "06028 4076000",
    postalCode: company?.postalCode ?? "63843",
    street: company?.street ?? "Depotstraße 2",
    tiktokUrl: company?.tiktokUrl ?? null,
    website: company?.website ?? "https://www.stix-bau.de",
    youtubeUrl: company?.youtubeUrl ?? null,
  };
}

function getCompanyLines(company: FormPdfCompanyInfo) {
  return [
    company.legalName || company.companyName,
    getCompanyAddress(company),
    getCompanyContacts(company),
  ].filter(Boolean);
}

function getCompanyAddress(company: FormPdfCompanyInfo) {
  return [
    company.street,
    [company.postalCode, company.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");
}

function getCompanyContacts(company: FormPdfCompanyInfo) {
  return [
    company.phone,
    company.mobile,
    company.email,
    company.website ? formatWebsiteLabel(company.website) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatWebsiteLabel(value: string) {
  try {
    return new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    ).hostname.replace(/^www\./i, "");
  } catch {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "");
  }
}

function drawSocialMediaIcons(
  page: PDFPage,
  company: FormPdfCompanyInfo,
  startX: number,
  y: number,
  regular: PDFFont,
  bold: PDFFont,
) {
  const socials = [
    company.instagramUrl
      ? { type: "instagram", url: company.instagramUrl }
      : null,
    company.linkedinUrl
      ? { type: "linkedin", url: company.linkedinUrl }
      : null,
    company.facebookUrl
      ? { type: "facebook", url: company.facebookUrl }
      : null,
    company.youtubeUrl ? { type: "youtube", url: company.youtubeUrl } : null,
    company.tiktokUrl ? { type: "tiktok", url: company.tiktokUrl } : null,
  ].filter(
    (social): social is { type: string; url: string } => Boolean(social),
  );
  const groups = new Map<string, Array<{ type: string; url: string }>>();
  socials.forEach((social) => {
    const accountName = getSocialMediaAccountName(social.type, social.url);
    const key = accountName.toLocaleLowerCase("de-DE");
    groups.set(key, [...(groups.get(key) ?? []), social]);
  });
  let x = startX;

  groups.forEach((group) => {
    const accountName = getSocialMediaAccountName(
      group[0].type,
      group[0].url,
    );
    group.forEach(({ type }) => {
      page.drawCircle({
        color: textColor,
        size: 7.5,
        x: x + 7.5,
        y: y + 7.5,
      });
      drawSocialMediaIcon(page, type, x - 1, y - 1, regular, bold);
      x += 18;
    });
    page.drawText(accountName, {
      color: textColor,
      font: regular,
      size: 6.5,
      x,
      y: y + 5,
    });
    x += regular.widthOfTextAtSize(accountName, 6.5) + 10;
  });
}

function getSocialMediaAccountName(type: string, value: string) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const rawName =
      type === "linkedin" && segments[0] === "company"
        ? segments[1]
        : segments[0];

    if (!rawName) {
      return url.hostname.replace(/^www\./, "");
    }

    const decoded = decodeURIComponent(rawName);
    return decoded.startsWith("@") ? decoded : `@${decoded}`;
  } catch {
    const cleaned = value.trim().replace(/^@/, "");
    return cleaned ? `@${cleaned}` : "";
  }
}

function drawSocialMediaIcon(
  page: PDFPage,
  type: string,
  x: number,
  y: number,
  regular: PDFFont,
  bold: PDFFont,
) {
  if (type === "instagram") {
    page.drawRectangle({
      borderColor: rgb(1, 1, 1),
      borderWidth: 1,
      height: 9,
      width: 9,
      x: x + 4,
      y: y + 4,
    });
    page.drawCircle({
      borderColor: rgb(1, 1, 1),
      borderWidth: 0.8,
      size: 2.2,
      x: x + 8.5,
      y: y + 8.5,
    });
    page.drawCircle({
      color: rgb(1, 1, 1),
      size: 0.75,
      x: x + 11.5,
      y: y + 11.5,
    });
    return;
  }

  if (type === "youtube") {
    page.drawRectangle({
      borderColor: rgb(1, 1, 1),
      borderWidth: 1,
      height: 7,
      width: 10,
      x: x + 3.5,
      y: y + 5,
    });
    page.drawSvgPath("M 0 0 L 0 4 L 3.5 2 Z", {
      color: rgb(1, 1, 1),
      x: x + 7.2,
      y: y + 6.4,
    });
    return;
  }

  if (type === "tiktok") {
    page.drawLine({
      color: rgb(1, 1, 1),
      end: { x: x + 10, y: y + 13 },
      start: { x: x + 10, y: y + 5.5 },
      thickness: 1.2,
    });
    page.drawLine({
      color: rgb(1, 1, 1),
      end: { x: x + 13, y: y + 10.5 },
      start: { x: x + 10, y: y + 12.5 },
      thickness: 1.2,
    });
    page.drawCircle({
      color: rgb(1, 1, 1),
      size: 2,
      x: x + 8,
      y: y + 5,
    });
    return;
  }

  const symbol = type === "linkedin" ? "in" : type === "facebook" ? "f" : "•";
  const font = type === "facebook" ? bold : regular;
  const size = type === "facebook" ? 10 : 7;
  const width = font.widthOfTextAtSize(symbol, size);
  page.drawText(symbol, {
    color: rgb(1, 1, 1),
    font,
    size,
    x: x + 8.5 - width / 2,
    y: y + 5.5,
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function getPageDimensions(
  paperSize: "A4" | "A5",
  orientation: "LANDSCAPE" | "PORTRAIT",
) {
  const portrait =
    paperSize === "A5"
      ? { height: 595.28, width: 419.53 }
      : { height: 841.89, width: 595.28 };
  return orientation === "LANDSCAPE"
    ? { height: portrait.width, width: portrait.height }
    : portrait;
}

function formatValue(value: boolean | string | undefined) {
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  return value?.trim() || "";
}
