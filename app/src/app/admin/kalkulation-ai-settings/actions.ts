"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { getAiProvider } from "@/lib/kalkulation-ai-provider";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function saveAiSettings(formData: FormData) {
  await requireAdmin();

  const provider = text(formData, "provider") || "anthropic";
  const enabled = formData.get("enabled") === "on";
  const model = text(formData, "model") || null;
  const apiKeyInput = text(formData, "apiKey");
  const maxCandidatesRaw = text(formData, "maxCandidates");
  const maxCandidates = maxCandidatesRaw ? Number.parseInt(maxCandidatesRaw, 10) : 5;

  if (enabled && (!model || !apiKeyInput)) {
    const existing = await prisma.kalkulationAiSettings.findUnique({ where: { id: "default" } });
    if (!existing?.apiKey || !model) {
      throw new Error("Zum Aktivieren werden Modell und API-Key benötigt.");
    }
  }
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 20) {
    throw new Error("Die Anzahl Kandidaten muss zwischen 1 und 20 liegen.");
  }

  const existing = await prisma.kalkulationAiSettings.findUnique({
    where: { id: "default" },
  });

  await prisma.kalkulationAiSettings.upsert({
    create: {
      apiKey: apiKeyInput || null,
      enabled,
      id: "default",
      maxCandidates,
      model,
      provider,
    },
    update: {
      // Leeres Feld = bestehenden Key behalten, damit man Anbieter/Modell
      // ändern kann, ohne den Key jedes Mal neu einzugeben.
      apiKey: apiKeyInput || existing?.apiKey || null,
      enabled,
      maxCandidates,
      model,
      provider,
    },
    where: { id: "default" },
  });

  revalidatePath("/admin/kalkulation-ai-settings");
  redirect("/admin/kalkulation-ai-settings?saved=1");
}

export async function testAiConnection() {
  await requireAdmin();

  const settings = await prisma.kalkulationAiSettings.findUnique({ where: { id: "default" } });
  if (!settings?.apiKey || !settings.model) {
    redirect(
      "/admin/kalkulation-ai-settings?test=error&message=" +
        encodeURIComponent("Bitte zuerst Modell und API-Key speichern."),
    );
  }

  const testedAt = new Date();
  try {
    const aiProvider = getAiProvider(settings.provider);
    await aiProvider.matchBatch({
      apiKey: settings.apiKey,
      model: settings.model,
      items: [
        {
          lineItemId: "test",
          rawText: "Erdaushub Bodenklasse 3-5 maschinell",
          unit: "m3",
          quantity: 10,
          candidates: [
            { positionId: "test-pos", code: "01.01", title: "Erdaushub Bodenklasse 3-5", unit: "m3", similarityScore: 1, criticalTokenMismatch: false },
          ],
        },
      ],
    });
    await prisma.kalkulationAiSettings.update({
      data: { lastTestAt: testedAt, lastTestErrorText: null, lastTestSuccess: true },
      where: { id: "default" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    await prisma.kalkulationAiSettings
      .update({
        data: { lastTestAt: testedAt, lastTestErrorText: message, lastTestSuccess: false },
        where: { id: "default" },
      })
      .catch(() => undefined);
    revalidatePath("/admin/kalkulation-ai-settings");
    redirect("/admin/kalkulation-ai-settings?test=error&message=" + encodeURIComponent(message));
  }

  revalidatePath("/admin/kalkulation-ai-settings");
  redirect("/admin/kalkulation-ai-settings?test=success");
}
