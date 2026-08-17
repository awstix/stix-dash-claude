import { prisma } from "@/lib/prisma";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default async function ForgotPasswordPage() {
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
        <h2 className="mt-6 text-2xl font-black">Passwort vergessen</h2>
        <p className="mt-2 text-sm font-medium text-gray-700">
          Gib deine E-Mail-Adresse ein. Wenn dazu ein Konto existiert,
          schicken wir dir einen Link zum Zurücksetzen deines Passworts.
        </p>
        <ForgotPasswordForm />
      </section>
    </main>
  );
}
