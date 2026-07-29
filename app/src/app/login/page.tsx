import Image from "next/image";

import { prisma } from "@/lib/prisma";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const params = await searchParams;
  const company = await prisma.companyInfo.findUnique({
    select: {
      companyName: true,
      logoPublicUrl: true,
    },
    where: { id: "default" },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <section className="w-full max-w-md rounded-2xl border border-gray-300 bg-white p-7 text-gray-950 shadow-xl">
        {company?.logoPublicUrl ? (
          <Image
            alt={company.companyName || "Firmenlogo"}
            className="mx-auto h-auto max-h-24 w-auto max-w-full object-contain"
            height={140}
            priority
            src={company.logoPublicUrl}
            width={380}
          />
        ) : (
          <h1 className="text-2xl font-black">{company?.companyName || "STIX Portal"}</h1>
        )}
        <h1 className="mt-6 text-2xl font-black">Portal-Anmeldung</h1>
        <p className="mt-2 text-sm font-medium text-gray-700">
          Anmeldung mit E-Mail-Adresse oder dem vom Administrator vergebenen
          Benutzernamen.
        </p>
        {params.setup === "done" ? (
          <p className="mt-4 rounded-xl border border-green-500 bg-green-50 p-3 text-sm font-bold text-green-950">
            Administratorkonto wurde angelegt. Du kannst dich jetzt anmelden.
          </p>
        ) : null}
        <LoginForm />
      </section>
    </main>
  );
}
