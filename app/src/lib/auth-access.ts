import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  const roles = String(session.user.role ?? "")
    .split(",")
    .map((role) => role.trim());
  if (!roles.includes("admin")) redirect("/dashboard");
  return session;
}
