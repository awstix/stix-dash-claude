import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-access";
import { markAllNotificationsRead } from "./actions";
import { ChangelogDeleteButton } from "./ChangelogDeleteButton";
import { ChangelogForm } from "./ChangelogForm";
import { NotificationReadCheckbox } from "./NotificationReadCheckbox";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    erfasser?: string;
    mitarbeiter?: string;
    status?: string;
    text?: string;
    typ?: string;
  }>;
}) {
  const session = await requireSession();
  const admin = String(session.user.role ?? "")
    .split(",")
    .map((role) => role.trim())
    .includes("admin");
  const params = await searchParams;
  const status = params.status ?? "offen";
  const text = (params.text ?? "").trim();
  const erfasser = (params.erfasser ?? "").trim();
  const mitarbeiter = (params.mitarbeiter ?? "").trim();
  const typ = (params.typ ?? "").trim();

  const [changelogEntries, notifications] = await Promise.all([
    prisma.changelogEntry.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    }),
    admin
      ? prisma.notification.findMany({
          orderBy: [{ occurredAt: "desc" }],
          where: {
            ...(status === "offen" ? { read: false } : status === "erledigt" ? { read: true } : {}),
            ...(text ? { message: { contains: text } } : {}),
            ...(erfasser ? { erfasserName: { contains: erfasser } } : {}),
            ...(mitarbeiter ? { employeeName: { contains: mitarbeiter } } : {}),
            ...(typ ? { type: { contains: typ } } : {}),
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <AppShell
      title="Benachrichtigungen"
      description="Was ist neu im Portal - und, für Admins, Konflikt-Meldungen aus der Personalzeiterfassung."
    >
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-gray-900">Was ist neu</h2>
        {admin ? <ChangelogForm /> : null}
        <div className="space-y-3">
          {changelogEntries.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm font-semibold text-gray-500 shadow-sm">
              Noch keine Einträge.
            </div>
          ) : (
            changelogEntries.map((entry) => (
              <article
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
                key={entry.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-500">
                    {formatDateTime(entry.createdAt)}
                    {entry.authorName ? ` · ${entry.authorName}` : ""}
                  </p>
                  {admin ? <ChangelogDeleteButton id={entry.id} /> : null}
                </div>
                <h3 className="mt-1 text-sm font-bold text-gray-900">{entry.title}</h3>
                {entry.description ? (
                  <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                    {entry.description}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      {admin ? (
        <section>
          <h2 className="mb-3 text-xl font-semibold text-gray-900">
            Konflikt-Meldungen
          </h2>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              {notifications.length} Meldung{notifications.length === 1 ? "" : "en"} aus der
              Personalzeiterfassung
            </p>
            <form action={markAllNotificationsRead}>
              <button
                className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                type="submit"
              >
                Alle als erledigt markieren
              </button>
            </form>
          </div>

          <form
            className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-5"
            method="get"
          >
            <label className="text-xs font-semibold text-gray-700">
              Text
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                defaultValue={text}
                name="text"
                type="text"
              />
            </label>
            <label className="text-xs font-semibold text-gray-700">
              Erfasser
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                defaultValue={erfasser}
                name="erfasser"
                type="text"
              />
            </label>
            <label className="text-xs font-semibold text-gray-700">
              Mitarbeiter
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                defaultValue={mitarbeiter}
                name="mitarbeiter"
                type="text"
              />
            </label>
            <label className="text-xs font-semibold text-gray-700">
              Typ
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                defaultValue={typ}
                name="typ"
                type="text"
              />
            </label>
            <label className="text-xs font-semibold text-gray-700">
              Status
              <select
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                defaultValue={status}
                name="status"
              >
                <option value="offen">Offen</option>
                <option value="erledigt">Erledigt</option>
                <option value="alle">Alle</option>
              </select>
            </label>
            <div className="flex items-end xl:col-span-5">
              <button
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                type="submit"
              >
                Filtern
              </button>
            </div>
          </form>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-gray-900 text-white">
                  <tr>
                    <th className="p-3">Erledigt</th>
                    <th className="p-3">Text</th>
                    <th className="p-3">Erfasser</th>
                    <th className="p-3">Mitarbeiter</th>
                    <th className="p-3">Zeitpunkt</th>
                    <th className="p-3">Typ</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((notification) => (
                    <tr className="border-b border-gray-100 align-top" key={notification.id}>
                      <td className="p-3">
                        <NotificationReadCheckbox id={notification.id} read={notification.read} />
                      </td>
                      <td className="max-w-md p-3 whitespace-pre-wrap text-gray-800">
                        {notification.message}
                      </td>
                      <td className="p-3 text-gray-700">{notification.erfasserName}</td>
                      <td className="p-3 text-gray-700">{notification.employeeName}</td>
                      <td className="p-3 text-gray-700">{formatDateTime(notification.occurredAt)}</td>
                      <td className="p-3 text-gray-700">{notification.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-sm font-semibold text-gray-500">
                Keine Benachrichtigungen gefunden.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
