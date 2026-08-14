import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";

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
