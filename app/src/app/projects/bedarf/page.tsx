import { ActionIcon } from "@/components/ActionIcon";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import {
  createProjectRequirementItem,
  deleteProjectRequirementItem,
  updateProjectRequirementItem,
} from "../actions";
import { OrderCountdown } from "../../orders/OrderCountdown";
import { ProjectNavigation } from "../ProjectNavigation";
import { RequirementDeadlineForm } from "../RequirementDeadlineForm";
import { RequirementDoneCheckbox } from "../RequirementDoneCheckbox";
import { RequirementReorderList } from "../RequirementReorderList";
import { getAccessibleProjectIds } from "@/lib/auth-access";

const categoryOptions = [
  { label: "Schnitt", value: "SCHNITT" },
  { label: "Verguss", value: "VERGUSS" },
  { label: "LKW-Bedarf", value: "LKW" },
  { label: "Gerätebedarf", value: "GERAETE" },
  { label: "Sonstiges (Nachunternehmer / Leistungen / Materialien)", value: "SONSTIGES" },
];

export default async function ProjectRequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; sort?: string; status?: string }>;
}) {
  const { projectId: selectedProjectId = "", sort = "date", status = "offen" } = await searchParams;
  const accessibleProjectIds = await getAccessibleProjectIds();
  const projects = await prisma.project.findMany({
    where:
      accessibleProjectIds === null
        ? undefined
        : { id: { in: accessibleProjectIds } },
    include: {
      requirementItems: true,
    },
    orderBy: [{ status: "asc" }, { projectNumber: "asc" }],
  });

  const items = projects
    .flatMap((project) =>
      project.requirementItems
        .filter((item) => (status === "alle" ? true : status === "erledigt" ? item.done : !item.done))
        .map((item) => ({ ...item, project })),
    )
    .sort((a, b) => {
      if (sort === "created") {
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      const aTime = a.neededDate ? a.neededDate.getTime() : Infinity;
      const bTime = b.neededDate ? b.neededDate.getTime() : Infinity;
      if (aTime !== bTime) return aTime - bTime;
      return a.sortOrder - b.sortOrder;
    });

  return (
    <AppShell
      title="Projekte Bedarf"
      description="Bedarf je Baustelle – Schnitt, Verguss, LKW, Geräte und sonstige Nachunternehmer/Leistungen/Materialien. Bauleiter, Admin und Disposition können abhaken, sobald etwas verteilt oder bestellt ist."
    >
      <ProjectNavigation active="requirements" />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Bedarf erfassen</h2>
          <p className="mt-1 text-sm text-gray-600">
            Bedarf für morgen muss bis 16:00 Uhr erfasst sein, damit Dispo ihn
            noch sicher einplanen kann.
          </p>
          <ProjectRequirementForm
            defaultProjectId={selectedProjectId}
            projects={projects}
          />
        </section>

        <OrderCountdown deadlineHour={16} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 p-5">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Bedarfsliste</h2>
            <p className="mt-1 text-sm text-gray-600">
              {items.length} Eintrag{items.length === 1 ? "" : "e"} über alle Projekte.
            </p>
          </div>
          <form className="flex flex-wrap items-end gap-2" method="get">
            {selectedProjectId ? (
              <input name="projectId" type="hidden" value={selectedProjectId} />
            ) : null}
            <select
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={status}
              name="status"
            >
              <option value="offen">Offen</option>
              <option value="erledigt">Erledigt</option>
              <option value="alle">Alle</option>
            </select>
            <select
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue={sort}
              name="sort"
            >
              <option value="date">Nach benötigt am</option>
              <option value="created">Nach Erfassungsdatum</option>
            </select>
            <button
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
              type="submit"
            >
              Anzeigen
            </button>
          </form>
        </div>

        {items.length === 0 ? (
          <p className="p-8 text-center text-sm font-medium text-gray-500">
            Kein Bedarf erfasst.
          </p>
        ) : sort === "created" ? (
          <div className="divide-y divide-gray-100">
            {items.map((item) => (
              <RequirementRow item={item} key={item.id} />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {groupItemsByNeededDate(items).map((group) => (
              <div key={group.key} className="p-3">
                <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {group.label}
                </p>
                <RequirementReorderList ids={group.items.map((item) => item.id)}>
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                    {group.items.map((item, index) => (
                      <RequirementRow
                        draggable
                        item={item}
                        key={item.id}
                        position={group.items.length > 1 ? index + 1 : undefined}
                      />
                    ))}
                  </div>
                </RequirementReorderList>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

type RequirementListItem = {
  category: string;
  createdAt: Date;
  createdByName: string | null;
  description: string;
  done: boolean;
  doneByName: string | null;
  id: string;
  neededDate: Date | null;
  project: { name: string; projectNumber: string };
  projectId: string;
  sortOrder: number;
};

function groupItemsByNeededDate(items: RequirementListItem[]) {
  const groups = new Map<string, { items: RequirementListItem[]; label: string; sortKey: number }>();
  for (const item of items) {
    const key = item.neededDate ? formatDateInput(item.neededDate) : "ohne-datum";
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, {
        items: [item],
        label: item.neededDate ? `Benötigt am ${formatDate(item.neededDate)}` : "Ohne Datum",
        sortKey: item.neededDate ? item.neededDate.getTime() : Infinity,
      });
    }
  }
  return Array.from(groups.entries())
    .map(([key, group]) => ({ key, ...group }))
    .sort((a, b) => a.sortKey - b.sortKey);
}

function RequirementRow({
  draggable = false,
  item,
  position,
}: {
  draggable?: boolean;
  item: RequirementListItem;
  position?: number;
}) {
  return (
    <div
      className="flex items-start gap-4 p-5"
      data-requirement-id={draggable ? item.id : undefined}
      draggable={draggable}
    >
      {draggable ? (
        <div className="flex cursor-grab flex-col items-center gap-1 pt-1 text-gray-400" title="Zum Sortieren ziehen">
          <ActionIcon name="move" className="h-4 w-4" />
          {position ? <span className="text-[11px] font-bold text-gray-500">{position}</span> : null}
        </div>
      ) : null}
      <div className="pt-1">
        <RequirementDoneCheckbox done={item.done} id={item.id} projectId={item.projectId} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
            {item.project.projectNumber} · {item.project.name}
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
            {getCategoryLabel(item.category)}
          </span>
          {item.neededDate ? (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">
              Benötigt am {formatDate(item.neededDate)}
              {position ? ` · Reihenfolge ${position}` : ""}
            </span>
          ) : null}
        </div>
        <p className={`mt-2 text-sm ${item.done ? "text-gray-400 line-through" : "text-gray-900"}`}>
          {item.description}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Erfasst {formatDate(item.createdAt)}
          {item.createdByName ? ` von ${item.createdByName}` : ""}
          {item.done && item.doneByName ? ` · Erledigt von ${item.doneByName}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <details className="relative">
          <summary
            className="inline-flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            title="Bearbeiten"
          >
            <ActionIcon name="edit" className="h-4 w-4" />
          </summary>
          <div className="absolute right-0 z-10 mt-2 w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            <EditProjectRequirementItemForm item={item} />
          </div>
        </details>
        <form action={deleteProjectRequirementItemAction}>
          <input name="id" type="hidden" value={item.id} />
          <input name="projectId" type="hidden" value={item.projectId} />
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700 hover:bg-red-50"
            title="Löschen"
            type="submit"
          >
            <ActionIcon name="delete" className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

async function createProjectRequirementItemAction(formData: FormData) {
  "use server";

  await createProjectRequirementItem({
    category: text(formData.get("category")),
    description: text(formData.get("description")),
    neededDate: text(formData.get("neededDate")),
    projectId: text(formData.get("projectId")),
  });
}

async function updateProjectRequirementItemAction(formData: FormData) {
  "use server";

  await updateProjectRequirementItem({
    category: text(formData.get("category")),
    description: text(formData.get("description")),
    id: text(formData.get("id")),
    neededDate: text(formData.get("neededDate")),
    projectId: text(formData.get("projectId")),
    sortOrder: Number(text(formData.get("sortOrder"))) || 0,
  });
}

async function deleteProjectRequirementItemAction(formData: FormData) {
  "use server";

  await deleteProjectRequirementItem({
    id: text(formData.get("id")),
    projectId: text(formData.get("projectId")),
  });
}

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getCategoryLabel(value: string) {
  return categoryOptions.find((option) => option.value === value)?.label ?? value;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function ProjectRequirementForm({
  defaultProjectId = "",
  projects,
}: {
  defaultProjectId?: string;
  projects: {
    id: string;
    name: string;
    projectNumber: string;
  }[];
}) {
  return (
    <RequirementDeadlineForm
      action={createProjectRequirementItemAction}
      className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-6"
    >
      <label className="text-xs font-semibold text-gray-700 lg:col-span-2">
        Projekt
        <select
          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          defaultValue={defaultProjectId}
          name="projectId"
          required
        >
          <option value="">Projekt wählen</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectNumber} · {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-gray-700">
        Kategorie
        <select
          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          defaultValue="SCHNITT"
          name="category"
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-gray-700 lg:col-span-3">
        Beschreibung
        <input
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          name="description"
          placeholder="z.B. 2 LKW für Asphalttransport KW32"
          required
        />
      </label>
      <label className="text-xs font-semibold text-gray-700">
        Wann benötigt
        <input
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          name="neededDate"
          type="date"
        />
        <span className="mt-1 block text-[11px] font-normal text-gray-500">
          Reihenfolge wird automatisch ans Ende des Tages gesetzt, danach per Drag &amp; Drop änderbar.
        </span>
      </label>
      <div className="lg:col-span-6">
        <button
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          type="submit"
        >
          Bedarf speichern
        </button>
      </div>
    </RequirementDeadlineForm>
  );
}

function EditProjectRequirementItemForm({
  item,
}: {
  item: {
    category: string;
    description: string;
    id: string;
    neededDate: Date | null;
    projectId: string;
    sortOrder: number;
  };
}) {
  return (
    <RequirementDeadlineForm
      action={updateProjectRequirementItemAction}
      className="grid grid-cols-1 gap-3"
    >
      <input name="id" type="hidden" value={item.id} />
      <input name="projectId" type="hidden" value={item.projectId} />
      <label className="text-xs font-semibold text-gray-700">
        Kategorie
        <select
          className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          defaultValue={item.category}
          name="category"
        >
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-gray-700">
        Beschreibung
        <input
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={item.description}
          name="description"
          required
        />
      </label>
      <label className="text-xs font-semibold text-gray-700">
        Wann benötigt
        <input
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={item.neededDate ? formatDateInput(item.neededDate) : ""}
          name="neededDate"
          type="date"
        />
      </label>
      <label className="text-xs font-semibold text-gray-700">
        Reihenfolge
        <input
          className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
          defaultValue={item.sortOrder}
          min={0}
          name="sortOrder"
          type="number"
        />
      </label>
      <button
        className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        type="submit"
      >
        Änderungen speichern
      </button>
    </RequirementDeadlineForm>
  );
}
