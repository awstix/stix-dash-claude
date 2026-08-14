import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signedUrl } from "@/lib/storage";

export const runtime = "nodejs";

const STORAGE_BUCKET = "uploads";

export async function GET() {
  // Not restricted to status "done" - a run that errored out or hit the
  // platform timeout partway through still writes a report for whatever
  // rows it did manage to process before dying, and that should stay
  // reachable here too instead of only successful runs.
  const lastRun = await prisma.importProgress.findFirst({
    where: {
      kind: "inventory",
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
