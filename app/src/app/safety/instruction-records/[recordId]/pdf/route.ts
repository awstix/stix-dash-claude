import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const { recordId } = await params;
  const record = await prisma.safetyInstructionRecord.findUnique({
    include: {
      project: { select: { name: true, projectNumber: true } },
      signatures: { orderBy: { employeeName: "asc" } },
      template: true,
    },
    where: { id: recordId },
  });
  if (
    !record ||
    !["COMMISSION", "OPERATING_INSTRUCTION", "RISK_ASSESSMENT"].includes(
      record.template.type,
    )
  ) {
    return new NextResponse("Unterweisung nicht gefunden.", { status: 404 });
  }

  const pdf = await PDFDocument.create();
  const sourcePath = record.template.sourcePdfPath ?? record.template.content
    ?.split("\n")
    .find((line) => line.startsWith("SOURCE_PDF:"))
    ?.slice("SOURCE_PDF:".length);
  if (
    sourcePath?.startsWith("/templates/operating-instructions/") ||
    sourcePath?.startsWith("/uploads/safety-templates/")
  ) {
    const source = await PDFDocument.load(
      await fs.readFile(path.join(process.cwd(), "public", sourcePath)),
    );
    const pages = await pdf.copyPages(source, source.getPageIndices());
    pages.forEach((page) => pdf.addPage(page));
  }

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const line = (text: string, size = 10, isBold = false, x = 48) => {
    page.drawText(safe(text), {
      color: rgb(0.08, 0.08, 0.08),
      font: isBold ? bold : regular,
      size,
      x,
      y,
    });
    y -= size + 7;
  };
  const ensureSpace = (height = 40) => {
    if (y >= height + 45) return;
    page = pdf.addPage([595.28, 841.89]);
    y = 790;
  };

  line(
    record.template.type === "RISK_ASSESSMENT"
      ? "Nachweis zur Gefährdungsbeurteilung"
      : "Unterweisungsnachweis zur Betriebsanweisung",
    16,
    true,
  );
  line(record.template.title, 13, true);
  y -= 8;
  line(
    `Datum: ${record.instructionDate.toLocaleDateString("de-DE")}   Projekt: ${
      record.project
        ? `${record.project.projectNumber} - ${record.project.name}`
        : record.projectSnapshot || "Ohne Projekt"
    }`,
  );
  line(`Unterwiesen durch: ${record.instructedByName || "-"}`);
  if (record.notes) line(`Notizen: ${record.notes}`);
  y -= 10;
  line("Behandelte Inhalte", 12, true);
  const sections = parseArray(record.checkedSectionsJson);
  for (const section of sections) {
    ensureSpace();
    line(`[X] ${section}`, 9);
  }
  y -= 10;
  line("Teilnehmende Mitarbeiter", 12, true);
  for (const signature of record.signatures) {
    ensureSpace(80);
    page.drawLine({
      color: rgb(0.25, 0.25, 0.25),
      end: { x: 547, y: y + 8 },
      start: { x: 48, y: y + 8 },
      thickness: 0.5,
    });
    line(signature.employeeName, 10, true);
    line(
      signature.signedAt
        ? `Unterschrieben am ${signature.signedAt.toLocaleString("de-DE")}`
        : "Unterschrift offen",
      8,
    );
    if (signature.signatureDataUrl?.startsWith("data:image/")) {
      try {
        const bytes = Buffer.from(
          signature.signatureDataUrl.split(",")[1],
          "base64",
        );
        const image = signature.signatureDataUrl.startsWith("data:image/jpeg")
          ? await pdf.embedJpg(bytes)
          : await pdf.embedPng(bytes);
        const scaled = image.scaleToFit(150, 38);
        page.drawImage(image, {
          height: scaled.height,
          width: scaled.width,
          x: 360,
          y: y - 8,
        });
      } catch {
        // Der Nachweis bleibt auch bei einer beschädigten Alt-Signatur exportierbar.
      }
    }
    y -= 35;
  }

  const bytes = await pdf.save();
  const fileName = `${slug(record.template.title)}-Unterweisungsnachweis.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}

function parseArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function safe(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[„“]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^\x20-\x7EÀ-ÿ]/g, "");
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
