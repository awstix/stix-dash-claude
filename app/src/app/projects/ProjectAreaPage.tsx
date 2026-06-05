import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { ProjectAreaKey, ProjectNavigation } from "./ProjectNavigation";

export async function ProjectAreaPage({
  active,
  description,
  emptyText,
  title,
}: {
  active: ProjectAreaKey;
  description: string;
  emptyText: string;
  title: string;
}) {
  const projects = await prisma.project.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <AppShell title={`Projekte ${title}`} description={description}>
      <ProjectNavigation active={active} />

      <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{emptyText}</p>
        <p className="mt-3 text-xs font-semibold text-gray-500">
          Rechtefilter vorbereitet: aktuell werden alle Projekte angezeigt. Die
          Einschränkung auf zugeteilte Baustellen folgt mit Benutzer/Rollen.
        </p>
      </section>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 font-semibold">Projekt</th>
                <th className="p-4 font-semibold">Bauleiter</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">{title}</th>
                <th className="p-4 font-semibold">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Noch keine Projekte vorhanden.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="border-t border-gray-100">
                    <td className="p-4 align-top">
                      <div className="font-semibold text-gray-900">
                        {project.projectNumber}
                      </div>
                      <div className="mt-1 text-gray-600">{project.name}</div>
                    </td>
                    <td className="p-4 align-top text-gray-700">
                      {project.constructionManager || "-"}
                    </td>
                    <td className="p-4 align-top text-gray-700">
                      {project.status}
                    </td>
                    <td className="p-4 align-top text-gray-500">
                      Noch keine Einträge.
                    </td>
                    <td className="p-4 align-top">
                      <Link
                        href={`/projects/${project.id}`}
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                      >
                        Projektakte
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
