import { createFullBackupArchive } from "@/lib/data-maintenance";

export const runtime = "nodejs";

export async function GET() {
  const backup = createFullBackupArchive();
  const body = new Uint8Array(backup.bytes);

  return new Response(body, {
    headers: {
      "Content-Disposition": `attachment; filename="${backup.fileName}"`,
      "Content-Type": "application/zip",
    },
  });
}
