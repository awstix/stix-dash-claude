import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-access";
import { markAllNotificationsRead } from "./actions";
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
  await requireAdmin();
  const params = await searchParams;
  const status = params.status ?? "offen";
  const text = (params.text ?? "").trim();
  const erfasser = (params.erfasser ?? "").trim();
  const mitarbeiter = (params.mitarbeiter ?? "").trim();
  const typ = (params.typ ?? "").trim();

  const notifications = await prisma.notification.findMany({
    orderBy: [{ occurredAt: "desc" }],
    where: {
      ...(status === "offen" ? { read: false } : status === "erledigt" ? { read: true } : {}),
      ...(text ? { message: { contains: text } } : {}),
      ...(erfasser ? { erfasserName: { contains: erfasser } } : {}),
      ...(mitarbeiter ? { employeeName: { contains: mitarbeiter } } : {}),
      ...(typ ? { type: { contains: typ } } : {}),
    },
  });

  return (
    <AppShell
      title="Benachrichtigungen"
      description="Konflikt-Meldungen aus der Personalzeiterfassung – überschneidende Zeiteinträge oder Zeiteinträge, die sich mit einer Mitarbeiterdisposition (Urlaub, Krank, Innung u.a.) überschneiden."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">
          {notifications.length} Benachrichtigung{notifications.length === 1 ? "" : "en"}
        </h2>
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
    </AppShell>
  );
}
