import { headers } from "next/headers";
import { notFound } from "next/navigation";
import bwipjs from "bwip-js";
import QRCode from "qrcode";
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

async function getOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${proto}://${host}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const item = await prisma.inventoryItem.findUnique({
    where: {
      id: itemId,
    },
    select: {
      id: true,
      inventoryNumber: true,
      name: true,
      objectNumber: true,
    },
  });

  if (!item) {
    notFound();
  }

  const url = new URL(request.url);
  const symbology = url.searchParams.get("type") === "qr" ? "qr" : "datamatrix";
  const format = url.searchParams.get("format") === "png" ? "png" : "svg";
  const contentDisposition =
    url.searchParams.get("download") === "1" ? "attachment" : "inline";
  const origin = await getOrigin();
  const targetUrl = `${origin}/inventory/${item.id}`;
  const codeValue = item.objectNumber ?? item.inventoryNumber ?? item.id;
  const fileLabel = sanitizeFileName(
    [item.objectNumber, item.inventoryNumber, item.name].filter(Boolean).join("-") ||
      item.id,
  );
  const fileName = `inventar-${fileLabel}-${
    symbology === "datamatrix" ? "ecc200" : "qr"
  }.${format}`;

  if (symbology === "datamatrix") {
    if (format === "png") {
      const png = await bwipjs.toBuffer({
        backgroundcolor: "FFFFFF",
        bcid: "datamatrix",
        includetext: false,
        paddingheight: 12,
        paddingwidth: 12,
        scale: 10,
        text: codeValue,
      });

      return new Response(new Uint8Array(png), {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `${contentDisposition}; filename="${fileName}"`,
          "Content-Type": "image/png",
        },
      });
    }

    const svg = bwipjs.toSVG({
      bcid: "datamatrix",
      includetext: false,
      paddingheight: 12,
      paddingwidth: 12,
      scale: 10,
      text: codeValue,
    });

    return new Response(svg, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `${contentDisposition}; filename="${fileName}"`,
        "Content-Type": "image/svg+xml; charset=utf-8",
      },
    });
  }

  if (format === "png") {
    const png = await QRCode.toBuffer(targetUrl, {
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
      margin: 2,
      type: "png",
      width: 1024,
    });

    return new Response(new Uint8Array(png), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `${contentDisposition}; filename="${fileName}"`,
        "Content-Type": "image/png",
      },
    });
  }

  const svg = await QRCode.toString(targetUrl, {
    color: {
      dark: "#111827",
      light: "#ffffff",
    },
    errorCorrectionLevel: "H",
    margin: 2,
    type: "svg",
    width: 512,
  });

  return new Response(svg, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `${contentDisposition}; filename="${fileName}"`,
      "Content-Type": "image/svg+xml; charset=utf-8",
    },
  });
}
