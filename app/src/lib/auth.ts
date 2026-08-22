import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";
import { isPasswordBreached } from "@/lib/password-breach-check";

export const auth = betterAuth({
  appName: "STIX Portal",
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  disabledPaths: ["/sign-up/email", "/is-username-available"],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // TODO: auf true stellen, sobald unter Admin > E-Mail-Versand echte
    // SMTP-Zugangsdaten hinterlegt sind (aktuell 0 Zeilen in EmailSettings -
    // mit true könnte sich sonst niemand mehr registrieren, weil die
    // Verifizierungs-Mail nie ankommt).
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const account = await prisma.user.findUnique({
        select: { username: true },
        where: { id: user.id },
      });
      const usernameLine = account?.username
        ? `<p>Dein Benutzername: <strong>${account.username}</strong></p>`
        : "";
      await sendEmail({
        html: `
          <p>Hallo ${user.name || ""},</p>
          <p>für dein STIX-Portal-Konto wurde ein Link zum Festlegen deines Passworts angefordert.</p>
          ${usernameLine}
          <p><a href="${url}">Passwort jetzt festlegen</a></p>
          <p>Der Link ist eine Stunde gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
        `,
        subject: "STIX Portal: Passwort festlegen",
        text: `Hallo ${user.name || ""},\n\nfür dein STIX-Portal-Konto wurde ein Link zum Festlegen deines Passworts angefordert.\n${account?.username ? `Dein Benutzername: ${account.username}\n` : ""}\nLink: ${url}\n\nDer Link ist eine Stunde gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.`,
        to: user.email,
      });
    },
  },
  emailVerification: {
    autoSignInAfterVerification: false,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        html: `
          <p>Hallo ${user.name || ""},</p>
          <p>bitte bestätige deine E-Mail-Adresse für dein STIX-Portal-Konto.</p>
          <p><a href="${url}">E-Mail-Adresse jetzt bestätigen</a></p>
          <p>Der Link ist eine Stunde gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
        `,
        subject: "STIX Portal: E-Mail-Adresse bestätigen",
        text: `Hallo ${user.name || ""},\n\nbitte bestätige deine E-Mail-Adresse für dein STIX-Portal-Konto.\n\nLink: ${url}\n\nDer Link ist eine Stunde gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.`,
        to: user.email,
      });
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "RateLimit",
    customRules: {
      // Deckt dieselbe Grenze wie /change-password ab - eingebaute
      // Sonderregeln decken /sign-in*, /change-password, /change-email
      // (3/10s) und /request-password-reset, /forget-password,
      // /send-verification-email (3/60s) bereits automatisch ab.
      "/reset-password": { window: 10, max: 3 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const password =
        ctx.path === "/admin/create-user"
          ? ctx.body?.password
          : ["/change-password", "/reset-password"].includes(ctx.path)
            ? ctx.body?.newPassword
            : undefined;

      if (password && (await isPasswordBreached(password))) {
        throw new APIError("BAD_REQUEST", {
          message:
            "Dieses Passwort wurde in bekannten Datenlecks gefunden. Bitte ein anderes Passwort wählen.",
        });
      }
    }),
  },
  plugins: [
    username({
      maxUsernameLength: 40,
      minUsernameLength: 3,
      usernameValidator: (value) => /^[a-zA-Z0-9._-]+$/.test(value),
    }),
    admin({
      defaultRole: "user",
    }),
    nextCookies(),
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  user: {
    additionalFields: {
      employeeId: {
        input: false,
        required: false,
        type: "string",
      },
      canApproveLeaveRequests: {
        defaultValue: false,
        input: false,
        required: false,
        type: "boolean",
      },
    },
  },
});
