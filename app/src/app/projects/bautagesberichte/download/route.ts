import { prisma } from "@/lib/prisma";
import { createZipArchive } from "@/lib/zip";
import { generateDailyReportPdf } from "../export/route";

export const dynamic = "force-dynamic";

type DownloadRequest = {
  all?: boolean;
  reportIds?: string[];
};

export async function POST(request: Request) {
  let input: DownloadRequest;

  try {
    input = (await request.json()) as DownloadRequest;
  } catch {
    return new Response("Ungültige Download-Anfrage.", {
      status: 400,
    });
  }

  const reportIds = Array.isArray(input.reportIds)
    ? Array.from(
        new Set(
          input.reportIds
            .map((reportId) => String(reportId ?? "").trim())
            .filter(Boolean),
        ),
      )
    : [];

  if (input.all !== true && reportIds.length === 0) {
    return new Response("Keine Bautagesberichte ausgewählt.", {
      status: 400,
    });
  }

  const reports = await prisma.projectDailyReport.findMany({
    where: input.all === true ? undefined : { id: { in: reportIds } },
    include: {
      project: {
        select: {
          projectNumber: true,
        },
      },
    },
    orderBy: [
      {
        project: {
          projectNumber: "asc",
        },
      },
      { reportDate: "asc" },
      { createdAt: "asc" },
    ],
  });

  if (reports.length === 0) {
    return new Response("Keine Bautagesberichte gefunden.", {
      status: 404,
    });
  }

  const entries = [];

  for (const report of reports) {
    const dateKey = report.reportDate.toISOString().slice(0, 10);
    const result = await generateDailyReportPdf({
      dateKey,
      projectId: report.projectId,
      sheetNumber:
        report.reportNumber?.toString() || report.sheetNumber || "1",
    });

    if (result) {
      entries.push(result);
    }
  }

  if (entries.length === 0) {
    return new Response("Bautagesberichte konnten nicht erzeugt werden.", {
      status: 500,
    });
  }

  const archive = createZipArchive(
    entries.map((entry) => ({
      bytes: entry.bytes,
      fileName: entry.fileName,
    })),
  );

  return new Response(archive, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="Bautagesberichte_${new Date()
        .toISOString()
        .slice(0, 10)}.zip"`,
      "Content-Type": "application/zip",
    },
  });
}
