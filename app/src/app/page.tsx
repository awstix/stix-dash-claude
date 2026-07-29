import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

const cards = [
  {
    title: "Dashboard",
    description: "Kennzahlen, offene Aufgaben und fällige Prüfungen.",
    href: "/dashboard",
  },
  {
    title: "Projekte",
    description: "Projektakten, Bautagesberichte, Dokumente, Fotos und Formulare.",
    href: "/projects",
  },
  {
    title: "Disposition",
    description: "Kolonnen, Mitarbeiter, Geräte, LKW, Asphalt und arbeitsfreie Tage.",
    href: "/crew-dispatch",
  },
  {
    title: "Inventar & Lager",
    description: "Inventar, Lagerbestände, Scanner, Etiketten und Erstprüfungen.",
    href: "/inventory",
  },
  {
    title: "Mitarbeiter",
    description: "Mitarbeiterverwaltung, Mitarbeiterakten und Führerscheinkontrollen.",
    href: "/employees",
  },
  {
    title: "Arbeitssicherheit",
    description: "GBU, Betriebsanweisungen, Beauftragungen, Gefahrstoffe und Unfälle.",
    href: "/safety",
  },
  {
    title: "Werkstatt",
    description: "Werkstattaufträge, Reparaturen und Werkstattformulare.",
    href: "/workshop",
  },
  {
    title: "Bestellung",
    description: "Mischgut-, Fremd-LKW- und Betonbestellungen.",
    href: "/orders",
  },
  {
    title: "Controlling",
    description: "Leistungsmeldungen und Verrechnungssätze prüfen und pflegen.",
    href: "/controlling/performance",
  },
  {
    title: "Administration",
    description: "Firma, Stammlisten, Kategorien, Berechtigungen und Datensicherung.",
    href: "/admin",
  },
];

export default async function Home() {
  const company = await prisma.companyInfo.findUnique({
    select: {
      companyName: true,
      logoPublicUrl: true,
    },
    where: { id: "default" },
  });

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-8 sm:px-6 lg:px-8 2xl:px-10">
      <div className="w-full">
        {company?.logoPublicUrl ? (
          <div className="flex min-h-24 items-center">
            <Image
              alt={company.companyName || "Firmenlogo"}
              className="h-auto max-h-28 w-auto max-w-[min(100%,440px)] object-contain object-left mix-blend-multiply"
              height={180}
              priority
              src={company.logoPublicUrl}
              width={520}
            />
            <h1 className="sr-only">
              Dashboard {company.companyName || "Stix"}
            </h1>
          </div>
        ) : (
          <h1 className="text-4xl font-bold text-gray-900">
            Dashboard {company?.companyName || "Stix"}
          </h1>
        )}

        <p className="mt-2 text-gray-600">
          Dispositionsdashboard für Bauunternehmen
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                {card.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
