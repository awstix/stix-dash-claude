import Image from "next/image";

import { prisma } from "@/lib/prisma";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const company = await prisma.companyInfo.findUnique({
    select: { companyName: true, logoPublicUrl: true },
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
          <h1 className="text-2xl font-black">
            {company?.companyName || "STIX Portal"}
          </h1>
        )}
        <h1 className="mt-6 text-2xl font-black">Portalkonto anlegen</h1>
        <p className="mt-2 text-sm font-semibold text-gray-950">
          Dein Geburtsdatum wird automatisch mit deiner Mitarbeiterakte
          abgeglichen. Danach muss das Konto einmal freigegeben werden.
        </p>
        <RegisterForm />
      </section>
    </main>
  );
}
