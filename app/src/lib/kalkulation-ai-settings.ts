import { prisma } from "@/lib/prisma";

export async function getAiSettings() {
  return prisma.kalkulationAiSettings.findUnique({ where: { id: "default" } });
}

export function isAiConfigured(
  settings: Awaited<ReturnType<typeof getAiSettings>>,
): settings is NonNullable<typeof settings> & {
  apiKey: string;
  model: string;
} {
  return Boolean(settings?.enabled && settings.apiKey && settings.model);
}
