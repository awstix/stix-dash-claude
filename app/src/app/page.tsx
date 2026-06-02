import Link from "next/link";

const cards = [
  {
    title: "Dashboard",
    description: "Übersicht über alle relevanten Informationen.",
    href: "/dashboard",
  },
  {
    title: "Projekte",
    description: "Baustellen, Bauleiter, Status und Auftragssummen verwalten.",
    href: "/projects",
  },
  {
    title: "Asphaltdisposition",
    description: "Wochenplanung für die Kolonnen Stürmer und Becker.",
    href: "/asphalt-dispatch",
  },
  {
    title: "LKW-Einteilung",
    description: "Langstrecke, Kurzstrecke, eigene LKW und Fremdfahrzeuge.",
    href: "/truck-dispatch",
  },
  {
    title: "Bestellung",
    description: "Mischgut-, Fremd-LKW- und Betonbestellung für den Folgetag.",
    href: "/orders",
  },
  {
    title: "Admin Backend",
    description: "Fahrer, Fahrzeuge, Materiallisten und Sortenlisten pflegen.",
    href: "/admin",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-4xl font-bold text-gray-900">Dashboard Stix</h1>

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
