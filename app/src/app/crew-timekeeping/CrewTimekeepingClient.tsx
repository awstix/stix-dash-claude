"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getBookableEmployees,
  saveCrewTeamPreference,
  saveCrewTimeEntry,
  startBooking,
  switchEmployeeProject,
  type BookableEmployee,
  type CrewTimeEmployeeInput,
} from "./actions";

type Booking = {
  activityLabel: string | null;
  approvedByName: string;
  crewId: string;
  crewName: string;
  defaultBreak1From: string;
  defaultBreak1To: string;
  defaultBreak2From: string;
  defaultBreak2To: string;
  defaultEndTime: string;
  defaultStartTime: string;
  employees: CrewTimeEmployeeInput[];
  id: string;
  notes: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  status: string;
  workDate: string;
};

type Activity = { id: string; label: string };
type CrewOption = { id: string; name: string };
type SwitchTargetProject = { id: string; name: string; projectNumber: string };

const inputClass = "rounded-lg border border-gray-500 bg-white px-2 py-2 text-sm font-bold text-gray-950";

function currentTime() {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin",
 hour: "2-digit", hour12: false, minute: "2-digit" }).format(new Date());
}

function isBookingActive(booking: Booking) {
  return booking.employees.some(
    (employee) => employee.isPresent && (employee.attendanceStatus === "CHECKED_IN" || employee.attendanceStatus === "BREAK"),
  );
}

function statusLabel(status: string) {
  if (status === "APPROVED") return "Freigegeben";
  if (status === "SUBMITTED") return "Zur Freigabe";
  return "Entwurf";
}

export function CrewTimekeepingClient({
  activities,
  bookings,
  crewOptions,
  myEmployeeId,
  selectedCrew,
  switchTargetProjects,
  workDate,
}: {
  activities: Activity[];
  bookings: Booking[];
  crewOptions: CrewOption[];
  myEmployeeId: string | null;
  selectedCrew: CrewOption | null;
  switchTargetProjects: SwitchTargetProject[];
  workDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [openPanel, setOpenPanel] = useState<"start" | "switch" | "team" | null>(null);
  const [switchBookingId, setSwitchBookingId] = useState<string | null>(null);

  function changeCrew(crewId: string) {
    router.push(`/crew-timekeeping?crew=${crewId}`);
  }

  function runAction(action: () => Promise<unknown>, successMessage: string) {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        await action();
        setMessage(successMessage);
        setOpenPanel(null);
        router.refresh();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Aktion fehlgeschlagen.");
      }
    });
  }

  function stampBooking(booking: Booking, field: "break1From" | "break1To" | "break2From" | "break2To" | "endTime") {
    const now = currentTime();
    const statusByField = {
      break1From: "BREAK",
      break1To: "CHECKED_IN",
      break2From: "BREAK",
      break2To: "CHECKED_IN",
      endTime: "CHECKED_OUT",
    } as const;
    const employees = booking.employees.map((employee) =>
      employee.isPresent ? { ...employee, [field]: now, attendanceStatus: statusByField[field] } : employee,
    );
    runAction(
      () =>
        saveCrewTimeEntry({
          activityLabel: booking.activityLabel,
          crewId: booking.crewId,
          crewName: booking.crewName,
          defaultBreak1From: booking.defaultBreak1From,
          defaultBreak1To: booking.defaultBreak1To,
          defaultBreak2From: booking.defaultBreak2From,
          defaultBreak2To: booking.defaultBreak2To,
          defaultEndTime: booking.defaultEndTime,
          defaultStartTime: booking.defaultStartTime,
          employees,
          notes: booking.notes,
          projectId: booking.projectId,
          projectName: booking.projectName,
          projectNumber: booking.projectNumber,
          workDate: booking.workDate,
        }),
      field === "endTime" ? "Feierabend gebucht." : "Pause gebucht.",
    );
  }

  const activeBookings = bookings.filter(isBookingActive);
  const inactiveBookings = bookings.filter((booking) => !isBookingActive(booking));

  return (
    <div className="space-y-5 text-gray-950">
      {crewOptions.length === 0 ? (
        <div className="rounded-2xl border border-gray-400 bg-white p-8 text-center font-black">
          Dir ist keine Kolonne zugeordnet.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-400 bg-white p-4">
            {crewOptions.length > 1 ? (
              <label className="font-black">
                Kolonne
                <select
                  className={`${inputClass} ml-2`}
                  onChange={(event) => changeCrew(event.target.value)}
                  value={selectedCrew?.id ?? ""}
                >
                  {crewOptions.map((crew) => (
                    <option key={crew.id} value={crew.id}>
                      {crew.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="text-xl font-black">👷 {selectedCrew?.name}</span>
            )}
            {selectedCrew ? (
              <button
                className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-black text-gray-800 hover:bg-gray-50"
                onClick={() => setOpenPanel(openPanel === "team" ? null : "team")}
                type="button"
              >
                ⋮ Team zusammenstellen
              </button>
            ) : null}
          </div>

          {message ? (
            <div className="rounded-xl border border-green-800 bg-green-50 p-3 font-black text-green-950">✓ {message}</div>
          ) : null}
          {error ? (
            <div className="rounded-xl border border-red-800 bg-red-50 p-3 font-black text-red-950">Fehler: {error}</div>
          ) : null}

          {openPanel === "team" && selectedCrew ? (
            <TeamPreferencePanel
              crewId={selectedCrew.id}
              onClose={() => setOpenPanel(null)}
              onSaved={() => {
                setMessage("Team-Zusammenstellung gespeichert.");
                setOpenPanel(null);
                router.refresh();
              }}
              workDate={workDate}
            />
          ) : null}

          {activeBookings.length === 0 && openPanel !== "start" ? (
            <div className="rounded-2xl border-2 border-dashed border-blue-800 bg-blue-50 p-6 text-center">
              <button
                className="rounded-xl bg-blue-900 px-6 py-4 text-lg font-black text-white disabled:opacity-60"
                disabled={pending || !selectedCrew}
                onClick={() => setOpenPanel("start")}
                type="button"
              >
                ▶ Start
              </button>
            </div>
          ) : null}

          {openPanel === "start" && selectedCrew ? (
            <BookingFlowPanel
              activities={activities}
              crew={selectedCrew}
              myEmployeeId={myEmployeeId}
              onCancel={() => setOpenPanel(null)}
              onSubmit={(values) =>
                runAction(
                  () =>
                    startBooking({
                      activityId: values.activityId,
                      crewId: selectedCrew.id,
                      employeeIds: values.employeeIds,
                      mode: "LIVE",
                      projectId: values.projectId,
                      startTime: currentTime(),
                      workDate,
                    }),
                  "Angemeldet.",
                )
              }
              pending={pending}
              switchTargetProjects={switchTargetProjects}
              workDate={workDate}
            />
          ) : null}

          {activeBookings.map((booking) => (
            <div className="space-y-2" key={booking.id}>
              <div className="overflow-hidden rounded-2xl border border-gray-400 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-300 bg-green-50 p-4">
                  <div>
                    <h2 className="text-lg font-black">
                      {booking.projectNumber} · {booking.projectName}
                    </h2>
                    <p className="font-bold text-gray-700">
                      {booking.activityLabel ?? "—"} · läuft seit {booking.defaultStartTime} Uhr ·{" "}
                      {booking.employees.filter((employee) => employee.isPresent).length} Mitarbeiter
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 p-4">
                  <button
                    className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-black text-gray-950 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pending}
                    onClick={() => stampBooking(booking, "break1From")}
                    type="button"
                  >
                    Pause Beginn
                  </button>
                  <button
                    className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-black text-gray-950 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pending}
                    onClick={() => stampBooking(booking, "break1To")}
                    type="button"
                  >
                    Pause Ende
                  </button>
                  <button
                    className="rounded-lg bg-purple-800 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pending}
                    onClick={() => {
                      setSwitchBookingId(booking.id);
                      setOpenPanel("switch");
                    }}
                    type="button"
                  >
                    Baustelle wechseln
                  </button>
                  <button
                    className="rounded-lg bg-green-800 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pending}
                    onClick={() => stampBooking(booking, "endTime")}
                    type="button"
                  >
                    Feierabend
                  </button>
                </div>
              </div>

              {openPanel === "switch" && switchBookingId === booking.id ? (
                <SwitchPanel
                  activities={activities}
                  booking={booking}
                  myEmployeeId={myEmployeeId}
                  onCancel={() => setOpenPanel(null)}
                  onSubmit={(values) =>
                    runAction(
                      () =>
                        switchEmployeeProject({
                          activityId: values.activityId,
                          employeeIds: values.employeeIds,
                          entry: {
                            activityLabel: booking.activityLabel,
                            crewId: booking.crewId,
                            crewName: booking.crewName,
                            defaultBreak1From: booking.defaultBreak1From,
                            defaultBreak1To: booking.defaultBreak1To,
                            defaultBreak2From: booking.defaultBreak2From,
                            defaultBreak2To: booking.defaultBreak2To,
                            defaultEndTime: booking.defaultEndTime,
                            defaultStartTime: booking.defaultStartTime,
                            employees: booking.employees,
                            notes: booking.notes,
                            projectId: booking.projectId,
                            projectName: booking.projectName,
                            projectNumber: booking.projectNumber,
                            workDate: booking.workDate,
                          },
                          switchTime: currentTime(),
                          toProjectId: values.projectId,
                        }),
                      "Baustelle gewechselt.",
                    )
                  }
                  pending={pending}
                  switchTargetProjects={switchTargetProjects.filter((project) => project.id !== booking.projectId)}
                />
              ) : null}
            </div>
          ))}

          {inactiveBookings.length > 0 ? (
            <div className="space-y-1 rounded-2xl border border-gray-300 bg-gray-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-gray-500">Heute bereits beendet</p>
              {inactiveBookings.map((booking) => (
                <p className="text-sm font-bold text-gray-700" key={booking.id}>
                  {booking.projectNumber} · {booking.projectName} — {booking.defaultStartTime}–
                  {booking.employees.find((employee) => employee.attendanceStatus === "CHECKED_OUT")?.endTime ?? booking.defaultEndTime} Uhr
                  · {statusLabel(booking.status)}
                </p>
              ))}
            </div>
          ) : null}

          {selectedCrew ? (
            <details className="rounded-2xl border border-dashed border-gray-400 bg-white p-4">
              <summary className="cursor-pointer text-sm font-black text-gray-700">
                Zeiten nachträglich erfassen (Nacherfassung)
              </summary>
              <BackdatedBookingForm
                activities={activities}
                crew={selectedCrew}
                myEmployeeId={myEmployeeId}
                onSubmit={(values) =>
                  runAction(
                    () =>
                      startBooking({
                        activityId: values.activityId,
                        crewId: selectedCrew.id,
                        employeeIds: values.employeeIds,
                        endTime: values.endTime,
                        mode: "NACHERFASSUNG",
                        projectId: values.projectId,
                        startTime: values.startTime,
                        workDate: values.workDate,
                      }),
                    "Nacherfassung gespeichert.",
                  )
                }
                pending={pending}
                switchTargetProjects={switchTargetProjects}
              />
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}

function EmployeePicker({
  audience,
  crewId,
  onChange,
  selectedIds,
  workDate,
}: {
  audience: "self" | "crew";
  crewId: string;
  onChange: (ids: string[]) => void;
  selectedIds: string[];
  workDate: string;
}) {
  const [roster, setRoster] = useState<{ crewMembers: BookableEmployee[]; otherEmployees: BookableEmployee[] } | null>(null);

  useEffect(() => {
    if (audience !== "crew") return;
    let cancelled = false;
    getBookableEmployees({ crewId, workDate }).then((result) => {
      if (cancelled) return;
      setRoster(result);
      onChange(
        [...result.crewMembers, ...result.otherEmployees]
          .filter((employee) => employee.selected && !employee.bookedElsewhere)
          .map((employee) => employee.employeeId),
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, crewId, workDate]);

  if (audience !== "crew") return null;
  if (!roster) return <p className="text-sm font-bold text-gray-500">Lade Kolonne …</p>;

  function toggle(employeeId: string) {
    onChange(selectedIds.includes(employeeId) ? selectedIds.filter((id) => id !== employeeId) : [...selectedIds, employeeId]);
  }

  function renderGroup(label: string, options: BookableEmployee[]) {
    if (!options.length) return null;
    return (
      <div key={label}>
        <p className="mt-2 text-xs font-black uppercase tracking-wide text-gray-500">{label}</p>
        <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {options.map((employee) => (
            <label
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm font-bold ${
                employee.bookedElsewhere ? "border-gray-200 bg-gray-100 text-gray-400" : "border-gray-300 bg-white text-gray-950"
              }`}
              key={employee.employeeId}
            >
              <input
                checked={selectedIds.includes(employee.employeeId)}
                disabled={employee.bookedElsewhere}
                onChange={() => toggle(employee.employeeId)}
                type="checkbox"
              />
              {employee.employeeName}
              {employee.bookedElsewhere ? <span className="text-xs font-black text-red-600">(anderswo aktiv)</span> : null}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-300 bg-gray-50 p-3">
      {renderGroup("Eigene Kolonne", roster.crewMembers)}
      {renderGroup("Freie Mitarbeiter", roster.otherEmployees)}
    </div>
  );
}

function BookingFlowPanel({
  activities,
  crew,
  myEmployeeId,
  onCancel,
  onSubmit,
  pending,
  switchTargetProjects,
  workDate,
}: {
  activities: Activity[];
  crew: CrewOption;
  myEmployeeId: string | null;
  onCancel: () => void;
  onSubmit: (values: { activityId: string; employeeIds: string[]; projectId: string }) => void;
  pending: boolean;
  switchTargetProjects: SwitchTargetProject[];
  workDate: string;
}) {
  const [audience, setAudience] = useState<"self" | "crew">(myEmployeeId ? "self" : "crew");
  const [employeeIds, setEmployeeIds] = useState<string[]>(myEmployeeId ? [myEmployeeId] : []);
  const [projectId, setProjectId] = useState("");
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");

  function setAudienceMode(mode: "self" | "crew") {
    setAudience(mode);
    if (mode === "self" && myEmployeeId) setEmployeeIds([myEmployeeId]);
  }

  const canSubmit = employeeIds.length > 0 && Boolean(projectId) && Boolean(activityId);

  return (
    <div className="space-y-3 rounded-2xl border border-blue-800 bg-blue-50 p-4">
      <h3 className="text-lg font-black">Anmelden</h3>
      <div className="flex gap-2">
        <button
          className={`rounded-lg px-3 py-2 text-sm font-black ${audience === "self" ? "bg-blue-900 text-white" : "border border-gray-400 bg-white text-gray-800"}`}
          disabled={!myEmployeeId}
          onClick={() => setAudienceMode("self")}
          type="button"
        >
          Für mich
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm font-black ${audience === "crew" ? "bg-blue-900 text-white" : "border border-gray-400 bg-white text-gray-800"}`}
          onClick={() => setAudienceMode("crew")}
          type="button"
        >
          Für meine Kolonne
        </button>
      </div>

      <EmployeePicker audience={audience} crewId={crew.id} onChange={setEmployeeIds} selectedIds={employeeIds} workDate={workDate} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-black text-gray-700">
          Kostenstelle / Baustelle
          <select className={`${inputClass} mt-1 w-full`} onChange={(event) => setProjectId(event.target.value)} value={projectId}>
            <option value="">Baustelle wählen …</option>
            {switchTargetProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectNumber} · {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-black text-gray-700">
          Tätigkeit
          <select className={`${inputClass} mt-1 w-full`} onChange={(event) => setActivityId(event.target.value)} value={activityId}>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          className="rounded-xl bg-blue-900 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending || !canSubmit}
          onClick={() => onSubmit({ activityId, employeeIds, projectId })}
          type="button"
        >
          Jetzt anmelden
        </button>
        <button className="rounded-xl border border-gray-400 bg-white px-4 py-3 font-black text-gray-800" onClick={onCancel} type="button">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function SwitchPanel({
  activities,
  booking,
  myEmployeeId,
  onCancel,
  onSubmit,
  pending,
  switchTargetProjects,
}: {
  activities: Activity[];
  booking: Booking;
  myEmployeeId: string | null;
  onCancel: () => void;
  onSubmit: (values: { activityId: string; employeeIds: string[]; projectId: string }) => void;
  pending: boolean;
  switchTargetProjects: SwitchTargetProject[];
}) {
  const activeEmployees = booking.employees.filter(
    (employee) => employee.isPresent && (employee.attendanceStatus === "CHECKED_IN" || employee.attendanceStatus === "BREAK"),
  );
  const [audience, setAudience] = useState<"self" | "crew">("crew");
  const [employeeIds, setEmployeeIds] = useState<string[]>(activeEmployees.map((employee) => employee.employeeId));
  const [projectId, setProjectId] = useState("");
  const currentActivity = activities.find((activity) => activity.label === booking.activityLabel);
  const [activityId, setActivityId] = useState(currentActivity?.id ?? activities[0]?.id ?? "");

  function setAudienceMode(mode: "self" | "crew") {
    setAudience(mode);
    setEmployeeIds(
      mode === "self" && myEmployeeId ? [myEmployeeId] : activeEmployees.map((employee) => employee.employeeId),
    );
  }

  function toggle(employeeId: string) {
    setEmployeeIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
  }

  const canSubmit = employeeIds.length > 0 && Boolean(projectId) && Boolean(activityId);

  return (
    <div className="space-y-3 rounded-2xl border border-purple-800 bg-purple-50 p-4">
      <h3 className="text-lg font-black">Baustelle wechseln</h3>
      <div className="flex gap-2">
        <button
          className={`rounded-lg px-3 py-2 text-sm font-black ${audience === "self" ? "bg-purple-800 text-white" : "border border-gray-400 bg-white text-gray-800"}`}
          disabled={!myEmployeeId}
          onClick={() => setAudienceMode("self")}
          type="button"
        >
          Nur ich
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm font-black ${audience === "crew" ? "bg-purple-800 text-white" : "border border-gray-400 bg-white text-gray-800"}`}
          onClick={() => setAudienceMode("crew")}
          type="button"
        >
          Ganze Kolonne
        </button>
      </div>

      {audience === "crew" ? (
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {activeEmployees.map((employee) => (
            <label
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm font-bold text-gray-950"
              key={employee.employeeId}
            >
              <input checked={employeeIds.includes(employee.employeeId)} onChange={() => toggle(employee.employeeId)} type="checkbox" />
              {employee.employeeName}
            </label>
          ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-black text-gray-700">
          Neue Baustelle
          <select className={`${inputClass} mt-1 w-full`} onChange={(event) => setProjectId(event.target.value)} value={projectId}>
            <option value="">Zielbaustelle wählen …</option>
            {switchTargetProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectNumber} · {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-black text-gray-700">
          Tätigkeit
          <select className={`${inputClass} mt-1 w-full`} onChange={(event) => setActivityId(event.target.value)} value={activityId}>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <button
          className="rounded-xl bg-purple-800 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending || !canSubmit}
          onClick={() => onSubmit({ activityId, employeeIds, projectId })}
          type="button"
        >
          Wechseln
        </button>
        <button className="rounded-xl border border-gray-400 bg-white px-4 py-3 font-black text-gray-800" onClick={onCancel} type="button">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function TeamPreferencePanel({
  crewId,
  onClose,
  onSaved,
  workDate,
}: {
  crewId: string;
  onClose: () => void;
  onSaved: () => void;
  workDate: string;
}) {
  const [roster, setRoster] = useState<{ crewMembers: BookableEmployee[]; otherEmployees: BookableEmployee[] } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getBookableEmployees({ crewId, workDate }).then((result) => {
      if (cancelled) return;
      setRoster(result);
      setSelectedIds(
        [...result.crewMembers, ...result.otherEmployees]
          .filter((employee) => employee.selected)
          .map((employee) => employee.employeeId),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [crewId, workDate]);

  function toggle(employeeId: string) {
    setSelectedIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
  }

  function save() {
    setError("");
    startTransition(async () => {
      try {
        await saveCrewTeamPreference({ crewId, employeeIds: selectedIds });
        onSaved();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Speichern fehlgeschlagen.");
      }
    });
  }

  if (!roster) {
    return <p className="text-sm font-bold text-gray-500">Lade …</p>;
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-400 bg-white p-4">
      <h3 className="text-lg font-black">Team zusammenstellen</h3>
      <p className="text-xs font-bold text-gray-600">Wird für künftige Buchungen dieser Kolonne gemerkt.</p>
      {error ? (
        <div className="rounded-lg border border-red-800 bg-red-50 p-2 text-sm font-black text-red-950">Fehler: {error}</div>
      ) : null}
      {[
        ["Eigene Kolonne", roster.crewMembers],
        ["Freie Mitarbeiter", roster.otherEmployees],
      ].map(([label, options]) => (
        <div key={label as string}>
          <p className="text-xs font-black uppercase tracking-wide text-gray-500">{label as string}</p>
          <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {(options as BookableEmployee[]).map((employee) => (
              <label
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm font-bold text-gray-950"
                key={employee.employeeId}
              >
                <input checked={selectedIds.includes(employee.employeeId)} onChange={() => toggle(employee.employeeId)} type="checkbox" />
                {employee.employeeName}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          className="rounded-xl bg-gray-900 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          onClick={save}
          type="button"
        >
          Speichern
        </button>
        <button className="rounded-xl border border-gray-400 bg-white px-4 py-3 font-black text-gray-800" onClick={onClose} type="button">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function BackdatedBookingForm({
  activities,
  crew,
  myEmployeeId,
  onSubmit,
  pending,
  switchTargetProjects,
}: {
  activities: Activity[];
  crew: CrewOption;
  myEmployeeId: string | null;
  onSubmit: (values: {
    activityId: string;
    employeeIds: string[];
    endTime: string;
    projectId: string;
    startTime: string;
    workDate: string;
  }) => void;
  pending: boolean;
  switchTargetProjects: SwitchTargetProject[];
}) {
  const [audience, setAudience] = useState<"self" | "crew">(myEmployeeId ? "self" : "crew");
  const [employeeIds, setEmployeeIds] = useState<string[]>(myEmployeeId ? [myEmployeeId] : []);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("16:00");
  const [projectId, setProjectId] = useState("");
  const [activityId, setActivityId] = useState(activities[0]?.id ?? "");

  function setAudienceMode(mode: "self" | "crew") {
    setAudience(mode);
    if (mode === "self" && myEmployeeId) setEmployeeIds([myEmployeeId]);
  }

  const canSubmit =
    employeeIds.length > 0 && Boolean(projectId) && Boolean(activityId) && Boolean(date) && Boolean(startTime) && Boolean(endTime);

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-amber-700 bg-amber-50 p-4">
      <p className="text-xs font-bold text-amber-900">
        Für bereits vergangene Zeiträume – wird als Nacherfassung markiert und in der Stundenkontrolle entsprechend
        gekennzeichnet (wer, wann, was).
      </p>
      <div className="flex gap-2">
        <button
          className={`rounded-lg px-3 py-2 text-sm font-black ${audience === "self" ? "bg-amber-700 text-white" : "border border-gray-400 bg-white text-gray-800"}`}
          disabled={!myEmployeeId}
          onClick={() => setAudienceMode("self")}
          type="button"
        >
          Für mich
        </button>
        <button
          className={`rounded-lg px-3 py-2 text-sm font-black ${audience === "crew" ? "bg-amber-700 text-white" : "border border-gray-400 bg-white text-gray-800"}`}
          onClick={() => setAudienceMode("crew")}
          type="button"
        >
          Für meine Kolonne
        </button>
      </div>
      <EmployeePicker audience={audience} crewId={crew.id} onChange={setEmployeeIds} selectedIds={employeeIds} workDate={date} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-black text-gray-700">
          Datum
          <input className={`${inputClass} mt-1 w-full`} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </label>
        <label className="text-xs font-black text-gray-700">
          Von
          <input className={`${inputClass} mt-1 w-full`} onChange={(event) => setStartTime(event.target.value)} type="time" value={startTime} />
        </label>
        <label className="text-xs font-black text-gray-700">
          Bis
          <input className={`${inputClass} mt-1 w-full`} onChange={(event) => setEndTime(event.target.value)} type="time" value={endTime} />
        </label>
        <label className="text-xs font-black text-gray-700">
          Tätigkeit
          <select className={`${inputClass} mt-1 w-full`} onChange={(event) => setActivityId(event.target.value)} value={activityId}>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs font-black text-gray-700">
        Baustelle
        <select className={`${inputClass} mt-1 w-full max-w-sm`} onChange={(event) => setProjectId(event.target.value)} value={projectId}>
          <option value="">Baustelle wählen …</option>
          {switchTargetProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectNumber} · {project.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="rounded-xl bg-amber-700 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending || !canSubmit}
        onClick={() => onSubmit({ activityId, employeeIds, endTime, projectId, startTime, workDate: date })}
        type="button"
      >
        Nachträglich buchen
      </button>
    </div>
  );
}
