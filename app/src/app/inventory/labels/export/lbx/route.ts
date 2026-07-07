import { createInventoryLabelLbx } from "@/lib/inventory-lbx";
import { getLiveLabelExportPayload } from "../shared";

export async function POST(request: Request) {
  const payload = await getLiveLabelExportPayload(await request.formData());
  const lbx = createInventoryLabelLbx({
    blocks: payload.blocks,
    companyName: payload.companyInfo?.companyName ?? null,
    item: payload.item,
    template: payload.template,
  });

  return new Response(new Uint8Array(lbx), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="inventar-${payload.fileLabel}.lbx"`,
      "Content-Type": "application/octet-stream",
    },
  });
}
