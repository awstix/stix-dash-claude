import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeObjectNumber(value: string) {
  const text = value.trim();

  if (!/^\d{1,6}$/.test(text)) return null;

  return String(Number.parseInt(text, 10)).padStart(6, "0");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const objectNumber = normalizeObjectNumber(query);

  if (!query) {
    return NextResponse.json({ itemId: null }, { status: 400 });
  }

  const searchFields = [
    objectNumber ? { objectNumber } : null,
    { inventoryNumber: query },
    { stixId: query },
    { serialNumber: query },
  ].filter((field): field is NonNullable<typeof field> => field !== null);

  const item = await prisma.inventoryItem.findFirst({
    where: {
      OR: searchFields,
    },
    orderBy: [{ objectNumber: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      objectNumber: true,
    },
  });

  if (!item) {
    return NextResponse.json({ itemId: null }, { status: 404 });
  }

  return NextResponse.json({
    itemId: item.id,
    name: item.name,
    objectNumber: item.objectNumber,
    target: `/inventory/${item.id}`,
  });
}
