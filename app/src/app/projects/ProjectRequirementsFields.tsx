"use client";

export function ProjectRequirementsFields({
  dvgw,
  guetezeichenKanalbau,
  lieferscheine,
  onDvgwChange,
  onGuetezeichenKanalbauChange,
  onLieferscheineChange,
}: {
  dvgw: boolean;
  guetezeichenKanalbau: boolean;
  lieferscheine: boolean;
  onDvgwChange: (value: boolean) => void;
  onGuetezeichenKanalbauChange: (value: boolean) => void;
  onLieferscheineChange: (value: boolean) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">Anforderungen</label>
      <div className="mt-2 space-y-2 rounded-xl border border-gray-300 bg-white px-3 py-3">
        <RequirementCheckbox checked={dvgw} label="DVGW" onChange={onDvgwChange} />
        <RequirementCheckbox
          checked={guetezeichenKanalbau}
          label="Gütezeichen Kanalbau"
          onChange={onGuetezeichenKanalbauChange}
        />
        <RequirementCheckbox checked={lieferscheine} label="Lieferscheine" onChange={onLieferscheineChange} />
      </div>
    </div>
  );
}

function RequirementCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-800">
      <input
        checked={checked}
        className="h-4 w-4 rounded border-gray-300"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}
