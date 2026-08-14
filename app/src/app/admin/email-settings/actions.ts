"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-access";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function saveEmailSettings(formData: FormData) {
  await requireAdmin();

  const provider = text(formData, "provider") || "custom";
  const enabled = formData.get("enabled") === "on";
  const smtpHost = text(formData, "smtpHost") || null;
  const smtpPortRaw = text(formData, "smtpPort");
  const smtpPort = smtpPortRaw ? Number.parseInt(smtpPortRaw, 10) : 587;
  const smtpSecure = formData.get("smtpSecure") === "on";
  const smtpUser = text(formData, "smtpUser") || null;
  const smtpPasswordInput = text(formData, "smtpPassword");
  const fromAddress = text(formData, "fromAddress") || null;
  const fromName = text(formData, "fromName") || null;

  if (enabled && (!smtpHost || !fromAddress)) {
    throw new Error(
      "Zum Aktivieren werden mindestens SMTP-Server und Absenderadresse benötigt.",
    );
  }
  if (!Number.isInteger(smtpPort) || smtpPort <= 0 || smtpPort > 65535) {
    throw new Error("Der Port muss eine gültige Zahl sein.");
  }

  const existing = await prisma.emailSettings.findUnique({
    where: { id: "default" },
  });

  await prisma.emailSettings.upsert({
    create: {
      enabled,
      fromAddress,
      fromName,
      id: "default",
      provider,
      smtpHost,
      smtpPassword: smtpPasswordInput || null,
      smtpPort,
      smtpSecure,
      smtpUser,
    },
    update: {
      enabled,
      fromAddress,
      fromName,
      provider,
      smtpHost,
      // Leeres Feld = Passwort behalten, damit man die anderen Werte
      // bearbeiten kann, ohne das Passwort jedes Mal neu einzugeben.
      smtpPassword: smtpPasswordInput || existing?.smtpPassword || null,
      smtpPort,
      smtpSecure,
      smtpUser,
    },
    where: { id: "default" },
  });

  revalidatePath("/admin/email-settings");
  redirect("/admin/email-settings?saved=1");
}

export async function sendTestEmail(formData: FormData) {
  await requireAdmin();
  const recipient = text(formData, "testRecipient");

  if (!recipient) {
    redirect(
      "/admin/email-settings?test=error&message=" +
        encodeURIComponent("Bitte eine Empfängeradresse angeben."),
    );
  }

  const sentAt = new Date();
  try {
    await sendEmail({
      html: "<p>Diese Test-E-Mail bestätigt, dass der E-Mail-Versand im STIX Portal korrekt konfiguriert ist.</p>",
      subject: "STIX Portal: Test-E-Mail",
      text: "Diese Test-E-Mail bestätigt, dass der E-Mail-Versand im STIX Portal korrekt konfiguriert ist.",
      to: recipient,
    });
    await prisma.emailSettings.update({
      data: {
        lastTestErrorText: null,
        lastTestSentAt: sentAt,
        lastTestSuccess: true,
      },
      where: { id: "default" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler.";
    await prisma.emailSettings
      .update({
        data: {
          lastTestErrorText: message,
          lastTestSentAt: sentAt,
          lastTestSuccess: false,
        },
        where: { id: "default" },
      })
      .catch(() => undefined);
    revalidatePath("/admin/email-settings");
    redirect(
      "/admin/email-settings?test=error&message=" + encodeURIComponent(message),
    );
  }

  revalidatePath("/admin/email-settings");
  redirect("/admin/email-settings?test=success");
}
