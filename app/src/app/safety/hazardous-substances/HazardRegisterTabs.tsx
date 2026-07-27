"use client";

import { useState, type ReactNode } from "react";

const tabs = [
  ["hazardous", "Gefährliche Gefahrstoffe"],
  ["withoutBa", "Gefahrstoffe ohne BA"],
  ["rules", "Gef.Stoff – Regelwerke"],
] as const;

export function HazardRegisterTabs({
  hazardous,
  rules,
  withoutBa,
}: {
  hazardous: ReactNode;
  rules: ReactNode;
  withoutBa: ReactNode;
}) {
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number][0]>("hazardous");
  const content = {
    hazardous,
    rules,
    withoutBa,
  };

  return (
    <div>
      <div
        aria-label="Gefahrstoffkataster-Reiter"
        className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-gray-300 bg-white p-2 shadow-sm"
        role="tablist"
      >
        {tabs.map(([id, label]) => {
          const isActive = activeTab === id;
          return (
            <button
              aria-selected={isActive}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                isActive
                  ? "bg-gray-950 text-white shadow-sm"
                  : "text-gray-800 hover:bg-gray-100"
              }`}
              key={id}
              onClick={() => setActiveTab(id)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{content[activeTab]}</div>
    </div>
  );
}
