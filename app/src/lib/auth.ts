import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";

import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  appName: "STIX Portal",
  baseURL: process.env.BETTER_AUTH_URL,
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  disabledPaths: ["/sign-up/email", "/is-username-available"],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
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
