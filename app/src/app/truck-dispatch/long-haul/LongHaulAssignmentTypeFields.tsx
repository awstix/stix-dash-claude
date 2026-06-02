"use client";

import { useEffect, useMemo, useState } from "react";

export type AsphaltOpenPositionForLongHaulForm = {
  asphaltDispatchEntryId: string;
  crew: string;
  projectNumber: string;
  projectName: string;
  asphaltMixNumber: string | null;
  asphaltMixName: string | null;
  openTons: number;
};

function formatTons(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function notifySelectedAsphaltOpenTons(openTons: number) {
  window.dispatchEvent(
    new CustomEvent("longhaul-asphalt-open-tons-change", {
      detail: {
        openTons,
      },
    }),
  );
}

export function LongHaulAssignmentTypeFields({
  asphaltCrews,
  asphaltOpenPositions,
  defaultAssignmentType = "CONSTRUCTION",
  defaultAsphaltCrew = "",
  defaultAsphaltDispatchEntryId = "",
}: {
  asphaltCrews: string[];
  asphaltOpenPositions: AsphaltOpenPositionForLongHaulForm[];
  defaultAssignmentType?: string;
  defaultAsphaltCrew?: string;
  defaultAsphaltDispatchEntryId?: string;
}) {
  const [assignmentType, setAssignmentType] = useState(defaultAssignmentType);
  const [selectedAsphaltCrew, setSelectedAsphaltCrew] = useState(
    defaultAsphaltCrew,
  );
  const [selectedDispatchEntryId, setSelectedDispatchEntryId] = useState(
    defaultAsphaltDispatchEntryId,
  );

  const isAsphalt = assignmentType === "ASPHALT";

  const filteredAsphaltOpenPositions = useMemo(() => {
    if (!selectedAsphaltCrew) {
      return asphaltOpenPositions;
    }

    return asphaltOpenPositions.filter(
      (position) => position.crew === selectedAsphaltCrew,
    );
  }, [asphaltOpenPositions, selectedAsphaltCrew]);

  const selectedPosition = useMemo(
    () =>
      filteredAsphaltOpenPositions.find(
        (position) => position.asphaltDispatchEntryId === selectedDispatchEntryId,
      ),
    [filteredAsphaltOpenPositions, selectedDispatchEntryId],
  );

  const selectedOpenTons = isAsphalt ? selectedPosition?.openTons ?? 0 : 0;

  useEffect(() => {
    notifySelectedAsphaltOpenTons(selectedOpenTons);
  }, [selectedOpenTons]);

  return (
    <>
      <label className="block text-sm font-medium text-gray-700">
        Art
        <select
          name="assignmentType"
          value={assignmentType}
          onChange={(event) => {
            const nextType = event.target.value;
            setAssignmentType(nextType);

            if (nextType !== "ASPHALT") {
              setSelectedAsphaltCrew("");
              setSelectedDispatchEntryId("");
              notifySelectedAsphaltOpenTons(0);
            }
          }}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        >
          <option value="CONSTRUCTION">Normale Baumaßnahme</option>
          <option value="ASPHALT">Asphaltmaßnahme</option>
        </select>
      </label>

      {isAsphalt ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-3">
          <div className="text-sm font-semibold text-orange-950">
            Asphaltmaßnahme
          </div>

          <label className="mt-3 block text-sm font-medium text-orange-950">
            Asphaltkolonne
            <select
              name="asphaltCrew"
              value={selectedAsphaltCrew}
              onChange={(event) => {
                setSelectedAsphaltCrew(event.target.value);
                setSelectedDispatchEntryId("");
                notifySelectedAsphaltOpenTons(0);
              }}
              className="mt-1 w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-600"
            >
              <option value="">Alle Asphaltkolonnen anzeigen</option>
              {asphaltCrews.map((crew) => (
                <option key={crew} value={crew}>
                  {crew}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block text-sm font-semibold text-orange-950">
            Asphaltposition aus Tages-Disposition
            <select
              name="asphaltDispatchEntryId"
              value={selectedDispatchEntryId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedDispatchEntryId(nextId);

                const nextPosition = filteredAsphaltOpenPositions.find(
                  (position) => position.asphaltDispatchEntryId === nextId,
                );

                notifySelectedAsphaltOpenTons(nextPosition?.openTons ?? 0);
              }}
              required={isAsphalt}
              className="mt-2 w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-600"
            >
              <option value="">Asphaltposition wählen</option>

              {filteredAsphaltOpenPositions.map((position) => (
                <option
                  key={position.asphaltDispatchEntryId}
                  value={position.asphaltDispatchEntryId}
                >
                  {position.crew} · {position.projectNumber} · {position.projectName} ·{" "}
                  {position.asphaltMixNumber ?? "-"} ·{" "}
                  {position.asphaltMixName ?? "-"} · offen{" "}
                  {formatTons(position.openTons)} t
                </option>
              ))}
            </select>
          </label>

          <input
            type="hidden"
            name="selectedAsphaltOpenTons"
            value={selectedOpenTons}
          />

          {selectedPosition ? (
            <div className="mt-3 rounded-lg border border-orange-300 bg-white p-3 text-xs font-medium text-orange-950">
              Tourenvorschlag aktiv: {selectedPosition.crew} · offen{" "}
              {formatTons(selectedPosition.openTons)} t. Unten im Bereich
              LKW-STIX wird der Vorschlag automatisch vorbereitet.
            </div>
          ) : null}

          {asphaltOpenPositions.length === 0 ? (
            <div className="mt-3 rounded-lg border border-orange-300 bg-white p-3 text-xs font-medium text-orange-900">
              Für diesen Tag gibt es aktuell keine offene Asphaltposition aus
              der Asphaltdisposition.
            </div>
          ) : null}

          {asphaltOpenPositions.length > 0 &&
          selectedAsphaltCrew &&
          filteredAsphaltOpenPositions.length === 0 ? (
            <div className="mt-3 rounded-lg border border-orange-300 bg-white p-3 text-xs font-medium text-orange-900">
              Für diese Asphaltkolonne gibt es an diesem Tag keine offene
              Asphaltposition.
            </div>
          ) : null}

          <p className="mt-2 text-xs leading-5 text-orange-800">
            Wenn du eine Asphaltkolonne wählst, werden darunter nur noch die
            offenen Asphaltpositionen dieser Kolonne angezeigt. Ohne Auswahl
            werden alle offenen Asphaltpositionen dieses Tages angezeigt.
          </p>
        </div>
      ) : (
        <>
          <input type="hidden" name="selectedAsphaltOpenTons" value="0" />
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            Für normale Baumaßnahmen bitte unten Projekt, Material und Menge
            eintragen. Die Asphaltposition wird erst bei Art „Asphaltmaßnahme“
            angezeigt.
          </div>
        </>
      )}
    </>
  );
}
