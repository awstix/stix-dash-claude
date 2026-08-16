import { NextRequest } from "next/server";
import { requireProjectAccess, resolveActorName } from "@/lib/auth-access";
import { buildDirectionsPdf } from "@/lib/directions-pdf";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  await requireProjectAccess(projectId);
  const actorName = await resolveActorName();

  const result = await buildDirectionsPdf(projectId, actorName);
  if (!result) {
    return new Response("Projekt nicht gefunden.", { status: 404 });
  }

  return new Response(new Uint8Array(result.bytes), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `inline; filename="${result.fileName}"`,
      "Content-Type": "application/pdf",
    },
  });
}
