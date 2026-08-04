"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ActionIcon";
import { portalModules } from "@/lib/portal-features";
import { savePermissionsForRoleAction, type FeaturePermission } from "./actions";

type PermissionState = Record<string, FeaturePermission>;

const emptyPermission: FeaturePermission = {
  canCreate: false,
  canDelete: false,
  canEdit: false,
  canRead: false,
  projectScope: "all",
};

function keyFor(moduleKey: string, featureKey: string) {
  return `${moduleKey}::${featureKey}`;
}

export function PermissionMatrixEditor({
  initialPermissions,
  roleKey,
  roleLabel,
}: {
  initialPermissions: PermissionState;
  roleKey: string;
  roleLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [permissions, setPermissions] = useState<PermissionState>(initialPermissions);
  const [activeModuleKey, setActiveModuleKey] = useState(portalModules[0].key);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [dismissedErrorKey, setDismissedErrorKey] = useState(0);

  function getPermission(moduleKey: string, featureKey: string): FeaturePermission {
    return permissions[keyFor(moduleKey, featureKey)] ?? emptyPermission;
  }

  function updatePermission(moduleKey: string, featureKey: string, patch: Partial<FeaturePermission>) {
    setPermissions((current) => ({
      ...current,
      [keyFor(moduleKey, featureKey)]: { ...getPermission(moduleKey, featureKey), ...patch },
    }));
    setIsDirty(true);
    setIsSaved(false);
  }

  function setAllInModule(moduleKey: string, granted: boolean) {
    setPermissions((current) => {
      const next = { ...current };
      const targetModule = portalModules.find((module) => module.key === moduleKey);

      targetModule?.features.forEach((feature) => {
        const key = keyFor(moduleKey, feature.key);
        next[key] = {
          ...(next[key] ?? emptyPermission),
          canCreate: granted,
          canDelete: granted,
          canEdit: granted,
          canRead: granted,
        };
      });

      return next;
    });
    setIsDirty(true);
    setIsSaved(false);
  }

  function save() {
    const formData = new FormData();
    formData.set("roleKey", roleKey);

    for (const portalModule of portalModules) {
      for (const feature of portalModule.features) {
        const permission = getPermission(portalModule.key, feature.key);
        if (permission.canRead) formData.set(`perm__${portalModule.key}__${feature.key}__read`, "on");
        if (permission.canCreate) formData.set(`perm__${portalModule.key}__${feature.key}__create`, "on");
        if (permission.canEdit) formData.set(`perm__${portalModule.key}__${feature.key}__edit`, "on");
        if (permission.canDelete) formData.set(`perm__${portalModule.key}__${feature.key}__delete`, "on");
        formData.set(`perm__${portalModule.key}__${feature.key}__scope`, permission.projectScope);
      }
    }

    startTransition(async () => {
      const result = await savePermissionsForRoleAction({ error: null, errorKey }, formData);
      if (result.error) {
        setError(result.error);
        setErrorKey(result.errorKey);
      } else {
        setIsDirty(false);
        setIsSaved(true);
        router.refresh();
      }
    });
  }

  const activeModule =
    portalModules.find((portalModule) => portalModule.key === activeModuleKey) ?? portalModules[0];
  const visibleError = error && errorKey !== dismissedErrorKey ? error : null;

  const activeFeatureRows = activeModule.features.map((feature, index) => {
    const previousGroup = activeModule.features[index - 1]?.group;
    const showGroup = Boolean(feature.group && feature.group !== previousGroup);
    return { feature, showGroup };
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Rechte für: {roleLabel}</h2>
          <p className="mt-1 text-sm text-gray-600">
            Änderungen gelten erst nach „Speichern&rdquo;. Die Rolle „Administrator&rdquo; sieht und darf
            unabhängig von dieser Matrix immer alles.
          </p>
        </div>
        <button
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
          disabled={isPending || !isDirty}
          onClick={save}
          type="button"
        >
          {isPending ? "Speichert..." : isDirty ? "Speichern *" : isSaved ? "Gespeichert" : "Speichern"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-white px-4 pt-3">
        {portalModules.map((portalModule) => (
          <button
            className={`rounded-t-lg border-b-2 px-3 py-2 text-sm font-semibold ${
              portalModule.key === activeModuleKey
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
            key={portalModule.key}
            onClick={() => setActiveModuleKey(portalModule.key)}
            type="button"
          >
            {portalModule.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeModule.note ? <p className="mb-3 text-xs text-gray-500">{activeModule.note}</p> : null}
        <div className="mb-3 flex gap-2">
          <button
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            onClick={() => setAllInModule(activeModule.key, true)}
            type="button"
          >
            Alles auswählen
          </button>
          <button
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            onClick={() => setAllInModule(activeModule.key, false)}
            type="button"
          >
            Alles abwählen
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3">Seite / Kachel</th>
                <th className="p-3 text-center">Lesen</th>
                <th className="p-3 text-center">Erstellen</th>
                <th className="p-3 text-center">Bearbeiten</th>
                <th className="p-3 text-center">Löschen</th>
                <th className="p-3">Projekt-Scope</th>
              </tr>
            </thead>
            <tbody>
              {activeFeatureRows.map(({ feature, showGroup }) => {
                const permission = getPermission(activeModule.key, feature.key);

                return (
                  <tr className="border-t border-gray-100" key={feature.key}>
                    <td className="p-3 font-medium text-gray-900">
                      {showGroup ? (
                        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-gray-500">
                          {feature.group}
                        </span>
                      ) : null}
                      {feature.label}
                    </td>
                    <td className="p-3 text-center">
                      <input
                        checked={permission.canRead}
                        className="h-4 w-4"
                        onChange={(event) =>
                          updatePermission(activeModule.key, feature.key, { canRead: event.target.checked })
                        }
                        type="checkbox"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        checked={permission.canCreate}
                        className="h-4 w-4"
                        onChange={(event) =>
                          updatePermission(activeModule.key, feature.key, { canCreate: event.target.checked })
                        }
                        type="checkbox"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        checked={permission.canEdit}
                        className="h-4 w-4"
                        onChange={(event) =>
                          updatePermission(activeModule.key, feature.key, { canEdit: event.target.checked })
                        }
                        type="checkbox"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        checked={permission.canDelete}
                        className="h-4 w-4"
                        onChange={(event) =>
                          updatePermission(activeModule.key, feature.key, { canDelete: event.target.checked })
                        }
                        type="checkbox"
                      />
                    </td>
                    <td className="p-3">
                      <select
                        className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-900"
                        onChange={(event) =>
                          updatePermission(activeModule.key, feature.key, {
                            projectScope: event.target.value === "own" ? "own" : "all",
                          })
                        }
                        value={permission.projectScope}
                      >
                        <option value="all">Alle Projekte</option>
                        <option value="own">Nur eigene</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {visibleError ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-gray-950/45 p-4"
          role="alertdialog"
        >
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Eingabe prüfen</h3>
                <p className="mt-2 text-sm leading-6 text-gray-700">{visibleError}</p>
              </div>
              <button
                aria-label="Fehlermeldung schließen"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-xl font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setDismissedErrorKey(errorKey)}
                type="button"
              >
                <ActionIcon className="h-4 w-4" name="close" />
              </button>
            </div>
            <button
              className="mt-5 w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
              onClick={() => setDismissedErrorKey(errorKey)}
              type="button"
            >
              Eingaben korrigieren
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
