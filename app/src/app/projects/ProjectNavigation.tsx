import Link from "next/link";

export const projectAreaNavigation = [
  { key: "overview", label: "Übersicht", href: "/projects" },
  { key: "performance", label: "Leistung", href: "/projects/performance" },
  { key: "photos", label: "Fotos", href: "/projects/fotos" },
  { key: "documents", label: "Dokumente", href: "/projects/dokumente" },
  { key: "forms", label: "Formulare", href: "/projects/formulare" },
  { key: "notes", label: "Notizen", href: "/projects/notizen" },
  {
    key: "daily-reports",
    label: "Bautagesberichte",
    href: "/projects/bautagesberichte",
  },
] as const;

export type ProjectAreaKey = (typeof projectAreaNavigation)[number]["key"];

export function ProjectNavigation({ active }: { active: ProjectAreaKey }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {projectAreaNavigation.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={
            item.key === active
              ? "rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          }
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
