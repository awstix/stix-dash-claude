"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveCrewTimeEntry,
  saveCrewTimeEntry,
  type CrewTimeEmployeeInput,
} from "./actions";

type Entry = {
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
  id: string | null;
  notes: string;
  projectId: string;
  projectName: string;
  projectNumber: string;
  status: string;
  workDate: string;
};

const inputClass = "rounded-lg border border-gray-500 bg-white px-2 py-2 text-sm font-bold text-gray-950";

export function CrewTimekeepingClient({
  canApprove,
  entries: initialEntries,
}: {
  canApprove: boolean;
  entries: Entry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [entryMessages, setEntryMessages] = useState<Record<string, string>>({});
  const [entryErrors, setEntryErrors] = useState<Record<string, string>>({});
  const [activeEntryKey, setActiveEntryKey] = useState("");

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  function patchEntry(index: number, patch: Partial<Entry>) {
    setEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  }

  function applyDefaults(index: number) {
    const entry = entries[index];
    patchEntry(index, {
      employees: entry.employees.map((employee) => ({
        ...employee,
        break1From: entry.defaultBreak1From,
        break1To: entry.defaultBreak1To,
        break2From: entry.defaultBreak2From,
        break2To: entry.defaultBreak2To,
        endTime: entry.defaultEndTime,
        startTime: entry.defaultStartTime,
      })),
    });
  }

  function setAllAttendance(
    index: number,
    attendanceStatus: CrewTimeEmployeeInput["attendanceStatus"],
  ) {
    const now = currentTime();
    patchEntry(index, {
      employees: entries[index].employees.map((employee) => {
        if (
          (attendanceStatus === "BREAK" ||
            attendanceStatus === "CHECKED_OUT") &&
          !employee.isPresent
        ) {
          return employee;
        }
        return {
          ...employee,
          attendanceStatus,
          endTime:
            attendanceStatus === "CHECKED_OUT" ? now : employee.endTime,
          isPresent: attendanceStatus !== "NOT_CHECKED_IN",
        };
      }),
    });
    if (attendanceStatus === "CHECKED_OUT") {
      setEntryMessages((current) => ({
        ...current,
        [`${entries[index].projectId}:${entries[index].crewId}`]:
          `Feierabend ${now} Uhr als Arbeitsende vorgeschlagen. Bitte speichern oder einreichen.`,
      }));
    }
  }

  function patchEmployee(entryIndex: number, employeeIndex: number, patch: Partial<CrewTimeEmployeeInput>) {
    const employees = entries[entryIndex].employees.map((employee, index) =>
      index === employeeIndex ? { ...employee, ...patch } : employee,
    );
    patchEntry(entryIndex, { employees });
  }

  function save(index: number, status: "DRAFT" | "SUBMITTED") {
    const entryKey = `${entries[index].projectId}:${entries[index].crewId}`;
    setMessage("");
    setActiveEntryKey(entryKey);
    setEntryErrors((current) => ({ ...current, [entryKey]: "" }));
    setEntryMessages((current) => ({ ...current, [entryKey]: "" }));
    startTransition(async () => {
      try {
        const result = await saveCrewTimeEntry({ ...entries[index], status });
        patchEntry(index, { id: result.id, status: result.status });
        setEntryMessages((current) => ({
          ...current,
          [entryKey]:
            status === "SUBMITTED"
              ? "Gespeichert und zur Freigabe eingereicht."
              : "Entwurf wurde gespeichert.",
        }));
        setMessage(status === "SUBMITTED" ? "Zeiten zur Freigabe eingereicht." : "Entwurf gespeichert.");
        router.refresh();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
        setMessage(errorMessage);
        setEntryErrors((current) => ({ ...current, [entryKey]: errorMessage }));
      } finally {
        setActiveEntryKey("");
      }
    });
  }

  function approve(index: number) {
    const entry = entries[index];
    if (!entry.id) return;
    const entryKey = `${entry.projectId}:${entry.crewId}`;
    setActiveEntryKey(entryKey);
    setEntryErrors((current) => ({ ...current, [entryKey]: "" }));
    setEntryMessages((current) => ({ ...current, [entryKey]: "" }));
    startTransition(async () => {
      try {
        const result = await approveCrewTimeEntry(entry.id!);
        patchEntry(index, {
          approvedByName: result.approvedByName,
          status: result.status,
        });
        setEntryMessages((current) => ({
          ...current,
          [entryKey]: "Zeiten wurden freigegeben.",
        }));
        router.refresh();
      } catch (error) {
        setEntryErrors((current) => ({
          ...current,
          [entryKey]:
            error instanceof Error ? error.message : "Freigabe fehlgeschlagen.",
        }));
      } finally {
        setActiveEntryKey("");
      }
    });
  }

  return (
    <div className="space-y-5 text-gray-950">
      {message ? <div className="rounded-xl border border-gray-500 bg-white p-3 font-black text-gray-950">{message}</div> : null}
      {entries.map((entry, entryIndex) => (
        <section className="overflow-hidden rounded-2xl border border-gray-400 bg-white shadow-sm" key={`${entry.projectId}-${entry.crewId}`}>
          {(() => {
            const locked = entry.status === "APPROVED" && !canApprove;
            return <>
          <div className={`flex flex-wrap items-center justify-between gap-3 border-b p-4 ${entry.status === "APPROVED" ? "border-green-800 bg-green-50" : "border-gray-400 bg-gray-100"}`}>
            <div>
              <h2 className="text-lg font-black">{entry.projectNumber} · {entry.projectName}</h2>
              <p className="font-bold">{entry.crewName} · {statusLabel(entry.status)}</p>
            </div>
            {entry.approvedByName ? <span className="rounded-lg bg-green-800 px-3 py-2 text-sm font-black text-white">Freigegeben durch {entry.approvedByName}</span> : null}
            {locked ? <span className="rounded-lg border-2 border-green-900 bg-white px-3 py-2 text-sm font-black text-green-950">🔒 Freigegeben – Bearbeitung gesperrt</span> : null}
            {entryMessages[`${entry.projectId}:${entry.crewId}`] ? (
              <span className="rounded-lg border border-green-800 bg-white px-3 py-2 text-sm font-black text-green-900">
                ✓ {entryMessages[`${entry.projectId}:${entry.crewId}`]}
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 border-b border-gray-300 p-4 md:grid-cols-3 xl:grid-cols-7">
            <TimeField disabled={locked} label="Beginn" value={entry.defaultStartTime} onChange={(value) => patchEntry(entryIndex, { defaultStartTime: value })} />
            <TimeField disabled={locked} label="Ende" value={entry.defaultEndTime} onChange={(value) => patchEntry(entryIndex, { defaultEndTime: value })} />
            <TimeField disabled={locked} label="Pause 1 von" value={entry.defaultBreak1From} onChange={(value) => patchEntry(entryIndex, { defaultBreak1From: value })} />
            <TimeField disabled={locked} label="Pause 1 bis" value={entry.defaultBreak1To} onChange={(value) => patchEntry(entryIndex, { defaultBreak1To: value })} />
            <TimeField disabled={locked} label="Pause 2 von" value={entry.defaultBreak2From} onChange={(value) => patchEntry(entryIndex, { defaultBreak2From: value })} />
            <TimeField disabled={locked} label="Pause 2 bis" value={entry.defaultBreak2To} onChange={(value) => patchEntry(entryIndex, { defaultBreak2To: value })} />
            <button className="self-end rounded-lg bg-gray-950 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-gray-500" disabled={locked} onClick={() => applyDefaults(entryIndex)} type="button">Für alle übernehmen</button>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-gray-300 bg-white p-4">
            <span className="mr-2 self-center text-sm font-black">Status für gesamte Kolonne:</span>
            <button className="rounded-lg bg-blue-900 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-gray-500" disabled={locked} onClick={() => setAllAttendance(entryIndex, "CHECKED_IN")} type="button">Alle anmelden</button>
            <button className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-black text-gray-950 disabled:cursor-not-allowed disabled:bg-gray-500" disabled={locked} onClick={() => setAllAttendance(entryIndex, "BREAK")} type="button">Alle in Pause</button>
            <button className="rounded-lg bg-green-800 px-3 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-gray-500" disabled={locked} onClick={() => setAllAttendance(entryIndex, "CHECKED_OUT")} type="button">Alle Feierabend</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-gray-950 text-white">
                <tr>
                  <th className="p-3">Status</th><th className="p-3">Mitarbeiter</th><th className="p-3">Beginn</th><th className="p-3">Ende</th>
                  <th className="p-3">Pause 1</th><th className="p-3">Pause 2</th><th className="p-3">Bemerkung</th>
                </tr>
              </thead>
              <tbody>
                {entry.employees.map((employee, employeeIndex) => (
                  <tr className="border-b border-gray-300" key={employee.employeeId}>
                    <td className="p-2">
                      <select
                        disabled={locked}
                        className={`${inputClass} w-full min-w-36`}
                        onChange={(event) => {
                          const attendanceStatus = event.target.value as CrewTimeEmployeeInput["attendanceStatus"];
                          patchEmployee(entryIndex, employeeIndex, {
                            attendanceStatus,
                            endTime:
                              attendanceStatus === "CHECKED_OUT"
                                ? currentTime()
                                : employee.endTime,
                            isPresent: attendanceStatus !== "NOT_CHECKED_IN",
                          });
                        }}
                        value={employee.attendanceStatus}
                      >
                        <option value="NOT_CHECKED_IN">Nicht angemeldet</option>
                        <option value="CHECKED_IN">Angemeldet</option>
                        <option value="BREAK">Pause</option>
                        <option value="CHECKED_OUT">Feierabend</option>
                      </select>
                    </td>
                    <td className="p-3 font-black">{employee.employeeName}<div className="text-xs font-bold">{employee.roleLabel}</div></td>
                    <td className="p-2"><input className={inputClass} disabled={locked} type="time" value={employee.startTime} onChange={(event) => patchEmployee(entryIndex, employeeIndex, { startTime: event.target.value })} /></td>
                    <td className="p-2"><input className={inputClass} disabled={locked} type="time" value={employee.endTime} onChange={(event) => patchEmployee(entryIndex, employeeIndex, { endTime: event.target.value })} /></td>
                    <td className="p-2"><div className="flex gap-1"><input className={inputClass} disabled={locked} type="time" value={employee.break1From} onChange={(event) => patchEmployee(entryIndex, employeeIndex, { break1From: event.target.value })} /><input className={inputClass} disabled={locked} type="time" value={employee.break1To} onChange={(event) => patchEmployee(entryIndex, employeeIndex, { break1To: event.target.value })} /></div></td>
                    <td className="p-2"><div className="flex gap-1"><input className={inputClass} disabled={locked} type="time" value={employee.break2From} onChange={(event) => patchEmployee(entryIndex, employeeIndex, { break2From: event.target.value })} /><input className={inputClass} disabled={locked} type="time" value={employee.break2To} onChange={(event) => patchEmployee(entryIndex, employeeIndex, { break2To: event.target.value })} /></div></td>
                    <td className="p-2"><input className={`${inputClass} w-full`} disabled={locked} value={employee.notes} onChange={(event) => patchEmployee(entryIndex, employeeIndex, { notes: event.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-end gap-3 p-4">
            <label className="min-w-64 flex-1 text-sm font-black">Bemerkung zur Kolonne
              <input className={`${inputClass} mt-1 w-full`} disabled={locked} value={entry.notes} onChange={(event) => patchEntry(entryIndex, { notes: event.target.value })} />
            </label>
            <button className="rounded-xl border border-gray-600 bg-white px-4 py-3 font-black text-gray-950 disabled:cursor-not-allowed disabled:opacity-70" disabled={pending || locked} onClick={() => save(entryIndex, "DRAFT")} type="button">
              {pending && activeEntryKey === `${entry.projectId}:${entry.crewId}` ? "Wird gespeichert …" : "Entwurf speichern"}
            </button>
            <button className="rounded-xl bg-blue-900 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-70" disabled={pending || locked} onClick={() => save(entryIndex, "SUBMITTED")} type="button">
              {pending && activeEntryKey === `${entry.projectId}:${entry.crewId}` ? "Wird eingereicht …" : "Zur Freigabe einreichen"}
            </button>
            {canApprove && entry.id && entry.status === "SUBMITTED" ? (
              <button className="rounded-xl bg-green-800 px-4 py-3 font-black text-white disabled:cursor-wait disabled:opacity-70" disabled={pending} onClick={() => approve(entryIndex)} type="button">
                {pending && activeEntryKey === `${entry.projectId}:${entry.crewId}` ? "Wird freigegeben …" : "Zeiten freigeben"}
              </button>
            ) : null}
            <div aria-live="polite" className="w-full">
              {entryMessages[`${entry.projectId}:${entry.crewId}`] ? (
                <div className="mt-2 rounded-xl border-2 border-green-800 bg-green-50 px-4 py-3 text-base font-black text-green-950">
                  ✓ {entryMessages[`${entry.projectId}:${entry.crewId}`]}
                </div>
              ) : null}
              {entryErrors[`${entry.projectId}:${entry.crewId}`] ? (
                <div className="mt-2 rounded-xl border-2 border-red-800 bg-red-50 px-4 py-3 text-base font-black text-red-950">
                  Fehler: {entryErrors[`${entry.projectId}:${entry.crewId}`]}
                </div>
              ) : null}
            </div>
          </div>
          </>;
          })()}
        </section>
      ))}
      {!entries.length ? <div className="rounded-2xl border border-gray-400 bg-white p-8 text-center font-black">Für diesen Tag sind keine Kolonnen auf zugänglichen Baustellen eingeplant.</div> : null}
    </div>
  );
}

function TimeField({ disabled = false, label, onChange, value }: { disabled?: boolean; label: string; onChange: (value: string) => void; value: string }) {
  return <label className="text-sm font-black">{label}<input className={`${inputClass} mt-1 w-full`} disabled={disabled} onChange={(event) => onChange(event.target.value)} type="time" value={value} /></label>;
}

function statusLabel(status: string) {
  if (status === "APPROVED") return "Freigegeben";
  if (status === "SUBMITTED") return "Zur Freigabe";
  return "Entwurf";
}

function currentTime() {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
  }).format(new Date());
}
