import { AppShell } from "@/components/AppShell";
import { InventoryScannerClient } from "./InventoryScannerClient";

export default function InventoryScannerPage() {
  return (
    <AppShell
      title="Inventar-Scanner"
      description="Mobiler Einstieg zum Scannen von Inventar-Codes, Schadenmeldungen und Objektinformationen."
    >
      <InventoryScannerClient />
    </AppShell>
  );
}
