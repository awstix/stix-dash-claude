import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";
import {
  leaveApprovalScope,
  leaveRequestIdsInProjectScope,
} from "@/lib/leave-request-access";
import { prisma } from "@/lib/prisma";
import {
  cancelLeaveRequest,
  changeLeaveRequest,
  createLeaveRequest,
  decideLeaveRequest,
  requestLeaveCancellation,
} from "./actions";

function date(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function requestStatus(request: { requestType: string; status: string }) {
  if (request.status === "PENDING" && request.requestType === "CHANGE") {
    return "Änderung wartet auf Freigabe";
  }
  if (request.status === "PENDING" && request.requestType === "CANCEL") {
    return "Rücknahme wartet auf Freigabe";
  }
  if (request.status === "APPROVED" && request.requestType === "CANCEL") {
    return "Rücknahme genehmigt";
  }
  return statusLabels[request.status] ?? request.status;
}

const statusLabels: Record<string, string> = {
  APPROVED: "Genehmigt",
  CANCELED: "Zurückgezogen",
  PENDING: "Offen",
  REJECTED: "Abgelehnt",
  SUPERSEDED: "Durch Änderung ersetzt",
};

export default async function LeaveRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const { error } = await searchParams;
  const scope = await leaveApprovalScope(session.user.id);
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id } });
  const allRequests = await prisma.leaveRequest.findMany({
    include: { decidedByUser: true, employee: true },
    orderBy: [{ status: "desc" }, { createdAt: "desc" }],
  });
  const scopedIds = scope.canApproveAll
    ? new Set(allRequests.map((request) => request.id))
    : await leaveRequestIdsInProjectScope(scope.projectIds, allRequests);
  const requests = allRequests.filter(
    (request) =>
      request.requesterUserId === session.user.id || scopedIds.has(request.id),
  );
  const approver = scope.canApproveAll || scope.projectIds.length > 0;
  const inputClass =
    "mt-2 w-full rounded-xl border border-gray-400 bg-white px-3 py-2 text-gray-950";

  return (
    <AppShell
      title="Urlaubsanträge"
      description="Urlaub beantragen, Bearbeitungsstand verfolgen und genehmigte Zeiträume automatisch in die Disposition übernehmen."
    >
      {currentUser?.employeeId ? (
        <section className="rounded-2xl border border-gray-300 bg-white p-6 text-gray-950 shadow-sm">
          {error === "end-before-start" ? (
            <p
              className="mb-5 rounded-xl border-2 border-red-700 bg-red-50 p-4 font-black text-red-950"
              role="alert"
            >
              Der letzte Urlaubstag darf nicht vor dem ersten Urlaubstag liegen.
              Bitte korrigiere den Zeitraum.
            </p>
          ) : null}
          <details>
            <summary className="inline-flex cursor-pointer list-none rounded-xl bg-gray-950 px-4 py-2 font-bold text-white">
              + Urlaub beantragen
            </summary>
            <form action={createLeaveRequest} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-bold">
                Antragsart
                <select className={inputClass} name="absenceType">
                  <option value="VACATION">Urlaub</option>
                  <option value="TIME_ACCOUNT">Zeitkonto / Überstundenabbau</option>
                </select>
              </label>
              <label className="text-sm font-bold">
                Stunden bei Zeitkonto
                <input className={inputClass} min="0.25" name="timeHours" step="0.25" type="number" />
              </label>
              <label className="text-sm font-bold">
                Von
                <input className={inputClass} name="startDate" required type="date" />
              </label>
              <label className="text-sm font-bold">
                Bis
                <input className={inputClass} name="endDate" required type="date" />
              </label>
              <label className="text-sm font-bold">
                Umfang
                <select className={inputClass} name="dayPortion">
                  <option value="FULL">Ganzer Tag / Zeitraum</option>
                  <option value="FIRST_HALF">Erste Tageshälfte</option>
                  <option value="SECOND_HALF">Zweite Tageshälfte</option>
                </select>
              </label>
              <label className="text-sm font-bold">
                Bemerkung (optional)
                <input className={inputClass} name="reason" />
              </label>
              <button className="w-fit rounded-xl bg-gray-950 px-4 py-2.5 font-bold text-white">
                Antrag absenden
              </button>
            </form>
          </details>
        </section>
      ) : (
        <p className="rounded-2xl border border-amber-500 bg-amber-50 p-5 font-bold text-amber-950">
          Dein Konto muss zuerst im Adminbereich mit einer Mitarbeiterakte
          verknüpft werden.
        </p>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-gray-300 bg-white text-gray-950 shadow-sm">
        <div className="border-b border-gray-300 p-5">
          <h2 className="text-xl font-black">
            {approver ? "Offene und bearbeitete Anträge" : "Meine Anträge"}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-3">Mitarbeiter</th>
                <th className="p-3">Zeitraum</th>
                <th className="p-3">Art</th>
                <th className="p-3">Umfang</th>
                <th className="p-3">Status</th>
                <th className="p-3">Bemerkung</th>
                <th className="p-3">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr className="border-t border-gray-300" key={request.id}>
                  <td className="p-3 font-bold">
                    {request.employee.lastName}, {request.employee.firstName}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {date(request.startDate)} – {date(request.endDate)}
                  </td>
                  <td className="p-3 font-black">
                    {request.absenceType === "TIME_ACCOUNT"
                      ? `Zeitkonto · ${request.timeHours?.toLocaleString("de-DE") ?? "—"} Std.`
                      : "Urlaub"}
                  </td>
                  <td className="p-3">
                    {request.dayPortion === "FIRST_HALF"
                      ? "Erste Tageshälfte"
                      : request.dayPortion === "SECOND_HALF"
                        ? "Zweite Tageshälfte"
                        : "Ganzer Tag"}
                  </td>
                  <td className="p-3 font-black">{requestStatus(request)}</td>
                  <td className="p-3">{request.reason ?? request.decisionNote ?? "—"}</td>
                  <td className="p-3">
                    {scopedIds.has(request.id) && request.status === "PENDING" ? (
                      <form action={decideLeaveRequest} className="flex flex-wrap gap-2">
                        <input name="id" type="hidden" value={request.id} />
                        <button className="rounded-lg bg-green-700 px-3 py-2 font-bold text-white" name="decision" value="APPROVED">
                          Genehmigen
                        </button>
                        <button className="rounded-lg bg-red-700 px-3 py-2 font-bold text-white" name="decision" value="REJECTED">
                          Ablehnen
                        </button>
                      </form>
                    ) : request.requesterUserId === session.user.id &&
                      ["PENDING", "APPROVED"].includes(request.status) &&
                      request.requestType === "NEW" ? (
                      <div className="flex flex-wrap gap-2">
                        <details>
                          <summary className="cursor-pointer list-none rounded-lg border border-gray-500 bg-white px-3 py-2 font-bold">
                            Bearbeiten
                          </summary>
                          <form action={changeLeaveRequest} className="mt-2 grid min-w-[280px] gap-2 rounded-xl border border-gray-300 bg-gray-50 p-3">
                            <input name="id" type="hidden" value={request.id} />
                            <select className={inputClass} defaultValue={request.absenceType} name="absenceType">
                              <option value="VACATION">Urlaub</option>
                              <option value="TIME_ACCOUNT">Zeitkonto / Überstundenabbau</option>
                            </select>
                            <input className={inputClass} defaultValue={request.timeHours ?? ""} min="0.25" name="timeHours" placeholder="Stunden" step="0.25" type="number" />
                            <input className={inputClass} defaultValue={request.startDate.toISOString().slice(0, 10)} name="startDate" required type="date" />
                            <input className={inputClass} defaultValue={request.endDate.toISOString().slice(0, 10)} name="endDate" required type="date" />
                            <select className={inputClass} defaultValue={request.dayPortion} name="dayPortion">
                              <option value="FULL">Ganzer Tag / Zeitraum</option>
                              <option value="FIRST_HALF">Erste Tageshälfte</option>
                              <option value="SECOND_HALF">Zweite Tageshälfte</option>
                            </select>
                            <input className={inputClass} defaultValue={request.reason ?? ""} name="reason" placeholder="Bemerkung" />
                            <button className="rounded-lg bg-gray-950 px-3 py-2 font-bold text-white">
                              Änderung zur Prüfung senden
                            </button>
                          </form>
                        </details>
                        <form action={requestLeaveCancellation}>
                          <input name="id" type="hidden" value={request.id} />
                          <button className="rounded-lg border border-red-700 bg-white px-3 py-2 font-bold text-red-800">
                            Rücknahme beantragen
                          </button>
                        </form>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 ? (
                <tr>
                  <td className="p-8 text-center font-semibold text-gray-950" colSpan={7}>
                    Keine Urlaubsanträge vorhanden.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
