import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth-access";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AccountPage() {
  const session = await requireSession();

  return (
    <AppShell
      title="Mein Konto"
      description="Eigene Zugangsdaten verwalten."
    >
      <div className="max-w-lg space-y-6 text-gray-950">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-950">Angemeldet als</h2>
          <p className="mt-1 text-sm text-gray-700">{session.user.name}</p>
          <p className="text-sm text-gray-500">{session.user.email}</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-950">
            Passwort ändern
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Mindestens 10 Zeichen. Du bleibst danach auf diesem Gerät
            angemeldet.
          </p>
          <ChangePasswordForm />
        </section>
      </div>
    </AppShell>
  );
}
