import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signedUrl } from "@/lib/storage";

export const runtime = "nodejs";

const STORAGE_BUCKET = "uploads";

export async function GET() {
  const lastRun = await prisma.importProgress.findFirst({
    where: {
      status: "done",
      reportStoragePath: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { reportStoragePath: true },
  });

  if (!lastRun?.reportStoragePath) {
    return NextResponse.json(
      { error: "Noch kein Importbericht vorhanden." },
      { status: 404 },
    );
  }

  const url = await signedUrl(STORAGE_BUCKET, lastRun.reportStoragePath, 60 * 5);
  return NextResponse.redirect(url);
}
