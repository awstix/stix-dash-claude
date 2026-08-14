import { prisma } from "@/lib/prisma";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; token?: string }>;
}) {
  const params = await searchParams;
  const company = await prisma.companyInfo.findUnique({
    select: { companyName: true },
    where: { id: "default" },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <section className="w-full max-w-md rounded-2xl border border-gray-300 bg-white p-7 text-gray-950 shadow-xl">
        <h1 className="text-2xl font-black">
          {company?.companyName || "STIX Portal"}
        </h1>
        <h2 className="mt-6 text-2xl font-black">Passwort festlegen</h2>

        {params.error || !params.token ? (
          <p className="mt-4 rounded-xl border border-red-400 bg-red-50 p-3 text-sm font-bold text-red-950">
            Dieser Link ist ungültig oder abgelaufen. Bitte einen neuen
            anfordern lassen.
          </p>
        ) : (
          <ResetPasswordForm token={params.token} />
        )}
      </section>
    </main>
  );
}
