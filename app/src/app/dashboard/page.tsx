import { AppShell } from "@/components/AppShell";

export default function DashboardPage() {
  return (
    <AppShell
      title="Dashboard"
      description="Rollenbasierte Übersicht über Projekte, Dispositionen und offene Aufgaben."
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <InfoCard title="Aktive Projekte" value="0" />
        <InfoCard title="Asphalt morgen" value="0 t" />
        <InfoCard title="Bestellung Status" value="Entwurf" />
      </div>
    </AppShell>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
