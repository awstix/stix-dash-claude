"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type AsphaltOpenPositionForLongHaulForm = {
  asphaltDispatchEntryId: string;
  crew: string;
  projectNumber: string;
  projectName: string;
  asphaltMixNumber: string | null;
  asphaltMixName: string | null;
  openTons: number;
};

export type LongHaulConstructionProjectOption = {
  id: string;
  projectNumber: string;
  name: string;
  constructionManager: string | null;
};

export type LongHaulConstructionMaterialOption = {
  id: string;
  name: string;
  unit: string;
  category: string | null;
};

export type LongHaulConstructionAsphaltOption = {
  id: string;
  mixNumber: string;
  name: string;
  shortName: string | null;
  unit: string;
  category: string | null;
};

function formatTons(value: number) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function getOptionGroup(category: string | null | undefined) {
  const text = category?.trim();
  return text ? text : "Ohne Gruppe";
}

function getUniqueGroups(categories: (string | null | undefined)[]) {
  return Array.from(new Set(categories.map(getOptionGroup))).sort((a, b) =>
    a.localeCompare(b, "de")
  );
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
  asphaltOpenPositions,
  defaultAssignmentType = "CONSTRUCTION",
  defaultAsphaltDispatchEntryId = "",
}: {
  asphaltOpenPositions: AsphaltOpenPositionForLongHaulForm[];
  defaultAssignmentType?: string;
  defaultAsphaltDispatchEntryId?: string;
}) {
  const [assignmentType, setAssignmentType] = useState(defaultAssignmentType);
  const [selectedDispatchEntryId, setSelectedDispatchEntryId] = useState(
    defaultAsphaltDispatchEntryId,
  );

  const isAsphalt = assignmentType === "ASPHALT";

  const selectedPosition = useMemo(
    () =>
      asphaltOpenPositions.find(
        (position) => position.asphaltDispatchEntryId === selectedDispatchEntryId,
      ),
    [asphaltOpenPositions, selectedDispatchEntryId],
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

          <label className="mt-3 block text-sm font-semibold text-orange-950">
            Asphaltposition aus Tages-Disposition
            <select
              name="asphaltDispatchEntryId"
              value={selectedDispatchEntryId}
              onChange={(event) => {
                const nextId = event.target.value;
                setSelectedDispatchEntryId(nextId);

                const nextPosition = asphaltOpenPositions.find(
                  (position) => position.asphaltDispatchEntryId === nextId,
                );

                notifySelectedAsphaltOpenTons(nextPosition?.openTons ?? 0);
              }}
              required={isAsphalt}
              className="mt-2 w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-600"
            >
              <option value="">Asphaltposition wählen</option>

              {asphaltOpenPositions.map((position) => (
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

          <p className="mt-2 text-xs leading-5 text-orange-800">
            Die gewählte Asphaltposition übernimmt Baustelle, Sorte und offene
            Menge.
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

export function LongHaulConstructionFields({
  projects,
  materials,
  asphaltMixes,
  defaultAssignmentType = "CONSTRUCTION",
  defaultMaterialSource = "MATERIAL",
  defaultProjectId = "",
  defaultMaterialTypeId = "",
  defaultAsphaltMixTypeId = "",
  defaultMaterialQuantity = 0,
}: {
  projects: LongHaulConstructionProjectOption[];
  materials: LongHaulConstructionMaterialOption[];
  asphaltMixes: LongHaulConstructionAsphaltOption[];
  defaultAssignmentType?: string;
  defaultMaterialSource?: "MATERIAL" | "ASPHALT";
  defaultProjectId?: string;
  defaultMaterialTypeId?: string;
  defaultAsphaltMixTypeId?: string;
  defaultMaterialQuantity?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [assignmentType, setAssignmentType] = useState(defaultAssignmentType);
  const [materialSource, setMaterialSource] = useState(defaultMaterialSource);
  const [materialGroup, setMaterialGroup] = useState(() => {
    const defaultItem =
      defaultMaterialSource === "ASPHALT"
        ? asphaltMixes.find((asphalt) => asphalt.id === defaultAsphaltMixTypeId)
        : materials.find((material) => material.id === defaultMaterialTypeId);

    return defaultItem ? getOptionGroup(defaultItem.category) : "";
  });
  const [selectedMaterialTypeId, setSelectedMaterialTypeId] =
    useState(defaultMaterialTypeId);
  const [selectedAsphaltMixTypeId, setSelectedAsphaltMixTypeId] =
    useState(defaultAsphaltMixTypeId);
  const materialGroups = useMemo(
    () => getUniqueGroups(materials.map((material) => material.category)),
    [materials]
  );
  const asphaltGroups = useMemo(
    () => getUniqueGroups(asphaltMixes.map((asphalt) => asphalt.category)),
    [asphaltMixes]
  );
  const filteredMaterials = materialGroup
    ? materials.filter(
        (material) => getOptionGroup(material.category) === materialGroup
      )
    : materials;
  const filteredAsphaltMixes = materialGroup
    ? asphaltMixes.filter(
        (asphalt) => getOptionGroup(asphalt.category) === materialGroup
      )
    : asphaltMixes;

  useEffect(() => {
    const form = containerRef.current?.closest("form");
    const select = form?.querySelector<HTMLSelectElement>(
      'select[name="assignmentType"]',
    );

    if (!select) {
      return;
    }

    const assignmentTypeSelect = select;

    function syncAssignmentType() {
      setAssignmentType(assignmentTypeSelect.value);
    }

    syncAssignmentType();
    assignmentTypeSelect.addEventListener("change", syncAssignmentType);

    return () => {
      assignmentTypeSelect.removeEventListener("change", syncAssignmentType);
    };
  }, []);

  if (assignmentType !== "CONSTRUCTION") {
    return <div ref={containerRef} />;
  }

  return (
    <div ref={containerRef} className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-sm font-semibold text-gray-900">
        Normale Baumaßnahme
      </div>

      <label className="mt-3 block text-sm font-medium text-gray-700">
        Art der Ladung
        <select
          name="constructionMaterialSource"
          value={materialSource}
          onChange={(event) => {
            setMaterialSource(event.target.value as "MATERIAL" | "ASPHALT");
            setMaterialGroup("");
            setSelectedMaterialTypeId("");
            setSelectedAsphaltMixTypeId("");
          }}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        >
          <option value="MATERIAL">Material</option>
          <option value="ASPHALT">Asphalt</option>
        </select>
      </label>

      <label className="mt-3 block text-sm font-medium text-gray-700">
        Projekt
        <select
          name="projectId"
          defaultValue={defaultProjectId}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        >
          <option value="">Projekt wählen</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectNumber} · {project.name}
              {project.constructionManager
                ? ` · ${project.constructionManager}`
                : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-sm font-medium text-gray-700">
        {materialSource === "ASPHALT" ? "Asphaltgruppe" : "Materialgruppe"}
        <select
          name="constructionMaterialGroup"
          value={materialGroup}
          onChange={(event) => {
            setMaterialGroup(event.target.value);
            setSelectedMaterialTypeId("");
            setSelectedAsphaltMixTypeId("");
          }}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        >
          <option value="">
            {materialSource === "ASPHALT"
              ? "Alle Asphaltgruppen"
              : "Alle Materialgruppen"}
          </option>
          {(materialSource === "ASPHALT" ? asphaltGroups : materialGroups).map(
            (group) => (
              <option key={group} value={group}>
                {group}
              </option>
            )
          )}
        </select>
      </label>

      <label className="mt-3 block text-sm font-medium text-gray-700">
        {materialSource === "ASPHALT" ? "Asphaltsorte" : "Material"}
        {materialSource === "ASPHALT" ? (
          <select
            name="asphaltMixTypeId"
            value={selectedAsphaltMixTypeId}
            onChange={(event) => setSelectedAsphaltMixTypeId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          >
            <option value="">Asphaltsorte wählen</option>
            {filteredAsphaltMixes.map((asphalt) => (
              <option key={asphalt.id} value={asphalt.id}>
                {asphalt.mixNumber} · {asphalt.shortName ?? asphalt.name} ·{" "}
                {asphalt.unit}
                {asphalt.category ? ` · ${asphalt.category}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <select
            name="materialTypeId"
            value={selectedMaterialTypeId}
            onChange={(event) => setSelectedMaterialTypeId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
          >
            <option value="">Material wählen</option>
            {filteredMaterials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} · {material.unit}
                {material.category ? ` · ${material.category}` : ""}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="mt-3 block text-sm font-medium text-gray-700">
        Materialmenge
        <input
          name="materialQuantity"
          type="number"
          step="0.01"
          defaultValue={defaultMaterialQuantity}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900"
        />
      </label>
    </div>
  );
}
