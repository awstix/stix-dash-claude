type EmployeeQualificationBadgeItem = {
  category: string;
  lastReviewedAt: Date | null;
  name: string;
  reviewIntervalMonths: number;
};

export function EmployeeQualificationBadges({
  qualifications,
}: {
  qualifications: EmployeeQualificationBadgeItem[];
}) {
  if (qualifications.length === 0) {
    return (
      <span className="text-[11px] font-medium text-gray-400">
        Keine Fahrberechtigung hinterlegt
      </span>
    );
  }

  const visibleQualifications = qualifications.slice(0, 3);
  const remainingCount = qualifications.length - visibleQualifications.length;

  return (
    <details className="group relative w-fit">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-1 [&::-webkit-details-marker]:hidden">
        {visibleQualifications.map((qualification) => (
          <QualificationPill
            key={qualification.name}
            qualification={qualification}
          />
        ))}
        {remainingCount > 0 ? (
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700">
            +{remainingCount}
          </span>
        ) : null}
        <span className="ml-0.5 text-[10px] font-semibold text-gray-400 group-open:hidden">
          Details
        </span>
      </summary>

      <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
        <div className="text-xs font-semibold text-gray-900">
          Fahr- und Maschinenberechtigungen
        </div>
        <div className="mt-2 space-y-2">
          {qualifications.map((qualification) => {
            const review = getReviewState(qualification);

            return (
              <div
                className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 px-2.5 py-2"
                key={qualification.name}
              >
                <div>
                  <div className="text-xs font-semibold text-gray-900">
                    {qualification.name}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-500">
                    {getCategoryLabel(qualification.category)}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${review.className}`}
                >
                  {review.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function QualificationPill({
  qualification,
}: {
  qualification: EmployeeQualificationBadgeItem;
}) {
  const review = getReviewState(qualification);
  const categoryClass =
    qualification.category === "DRIVER_LICENSE"
      ? "bg-blue-100 text-blue-800"
      : qualification.category === "MACHINE_LICENSE"
        ? "bg-orange-100 text-orange-900"
        : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${categoryClass} ${
        review.tone === "overdue" ? "ring-1 ring-red-400" : ""
      }`}
      title={`${qualification.name} · ${review.label}`}
    >
      {getQualificationShortLabel(qualification.name)}
    </span>
  );
}

function getQualificationShortLabel(name: string) {
  const driverLicenseMatch = name.match(/^Führerschein\s+(.+)$/i);

  if (driverLicenseMatch) {
    return driverLicenseMatch[1];
  }

  const shortLabels: Record<string, string> = {
    Bagger: "Bagger",
    Hubarbeitsbühne: "Hub",
    Radlader: "Radlader",
    Stapler: "Stapler",
    Walze: "Walze",
  };

  return shortLabels[name] ?? (name.length > 12 ? `${name.slice(0, 11)}…` : name);
}

function getReviewState(qualification: EmployeeQualificationBadgeItem) {
  if (!qualification.lastReviewedAt) {
    return {
      className: "bg-red-100 text-red-800",
      label: "ungeprüft",
      tone: "overdue",
    };
  }

  const dueDate = new Date(qualification.lastReviewedAt);
  dueDate.setUTCMonth(
    dueDate.getUTCMonth() + qualification.reviewIntervalMonths,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (daysUntilDue < 0) {
    return {
      className: "bg-red-100 text-red-800",
      label: "überfällig",
      tone: "overdue",
    };
  }

  if (daysUntilDue <= 30) {
    return {
      className: "bg-amber-100 text-amber-800",
      label: `bis ${formatDate(dueDate)}`,
      tone: "due",
    };
  }

  return {
    className: "bg-emerald-100 text-emerald-800",
    label: "geprüft",
    tone: "valid",
  };
}

function getCategoryLabel(category: string) {
  if (category === "DRIVER_LICENSE") return "Führerschein";
  if (category === "MACHINE_LICENSE") return "Maschinenschein";
  return "Sonstige Berechtigung";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
