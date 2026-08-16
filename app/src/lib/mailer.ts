import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export async function getEmailSettings() {
  return prisma.emailSettings.findUnique({ where: { id: "default" } });
}

export function isEmailConfigured(
  settings: Awaited<ReturnType<typeof getEmailSettings>>,
): settings is NonNullable<typeof settings> & {
  fromAddress: string;
  smtpHost: string;
} {
  return Boolean(
    settings?.enabled && settings.smtpHost && settings.fromAddress,
  );
}

function buildTransport(
  settings: NonNullable<Awaited<ReturnType<typeof getEmailSettings>>>,
) {
  return nodemailer.createTransport({
    auth:
      settings.smtpUser && settings.smtpPassword
        ? { pass: settings.smtpPassword, user: settings.smtpUser }
        : undefined,
    host: settings.smtpHost ?? undefined,
    port: settings.smtpPort,
    secure: settings.smtpSecure,
  });
}

/** Sends an email using the admin-configured SMTP settings (see
 * /admin/email-settings). Throws if email isn't configured or the send
 * fails - callers decide whether that should block the calling action. */
export async function sendEmail({
  attachments,
  html,
  subject,
  text,
  to,
}: {
  attachments?: { content: Buffer; contentType: string; filename: string }[];
  html: string;
  subject: string;
  text: string;
  to: string;
}) {
  const settings = await getEmailSettings();
  if (!isEmailConfigured(settings)) {
    throw new Error(
      "E-Mail-Versand ist nicht konfiguriert. Bitte unter Admin > E-Mail-Versand einrichten.",
    );
  }

  const transport = buildTransport(settings);
  const fromHeader = settings.fromName
    ? `"${settings.fromName}" <${settings.fromAddress}>`
    : settings.fromAddress;

  await transport.sendMail({
    attachments,
    from: fromHeader,
    html,
    subject,
    text,
    to,
  });
}
