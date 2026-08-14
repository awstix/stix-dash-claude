import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id fehlt." }, { status: 400 });
  }

  const progress = await prisma.importProgress.findUnique({
    where: { id },
    select: {
      processed: true,
      status: true,
      total: true,
    },
  });

  if (!progress) {
    return NextResponse.json({ processed: 0, status: "unknown", total: 0 });
  }

  return NextResponse.json(progress);
}
