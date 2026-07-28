export function SafetyParticipantSummary({ names }: { names: string[] }) {
  const uniqueNames = Array.from(
    new Set(names.map((name) => name.trim()).filter(Boolean)),
  );

  if (!uniqueNames.length) {
    return <span className="text-gray-500">Keine Person zugeordnet</span>;
  }

  return (
    <div>
      <p className="font-bold text-gray-950">
        {uniqueNames.length} {uniqueNames.length === 1 ? "Person" : "Personen"}
      </p>
      <p className="mt-1 max-w-[28rem] text-xs leading-5 text-gray-600">
        {uniqueNames.join(", ")}
      </p>
    </div>
  );
}
