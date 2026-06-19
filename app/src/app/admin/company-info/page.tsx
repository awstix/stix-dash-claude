import Image from "next/image";
import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { saveCompanyInfo } from "./actions";

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900";

export default async function CompanyInfoPage() {
  const company = await prisma.companyInfo.findUnique({
    where: { id: "default" },
  });

  return (
    <AppShell
      title="Firmeninfos"
      description="Zentrale Firmen-, Kontakt- und Social-Media-Daten für Formulare und PDF-Ausgaben."
    >
      <form
        action={saveCompanyInfo}
        className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <section>
          <h2 className="text-lg font-semibold text-gray-900">
            Firma und Logo
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Field
              defaultValue={company?.companyName ?? "Josef Stix GmbH & Co. KG"}
              label="Firmenname"
              name="companyName"
              required
            />
            <Field
              defaultValue={company?.legalName ?? ""}
              label="Zusätzliche Geschäftsbezeichnung"
              name="legalName"
            />
            <label className="lg:col-span-2">
              <span className="text-xs font-semibold text-gray-600">
                Firmenlogo
              </span>
              <input
                accept="image/*"
                className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold`}
                name="logo"
                type="file"
              />
            </label>
            {company?.logoPublicUrl ? (
              <div className="lg:col-span-2">
                <div className="relative h-32 w-full max-w-md rounded-xl border border-gray-200 bg-gray-50">
                  <Image
                    alt="Aktuelles Firmenlogo"
                    className="object-contain p-4"
                    fill
                    sizes="448px"
                    src={company.logoPublicUrl}
                  />
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input name="removeLogo" type="checkbox" />
                  Logo entfernen
                </label>
              </div>
            ) : null}
          </div>
        </section>

        <Section title="Anschrift">
          <Field defaultValue={company?.street ?? "Depotstraße 2"} label="Straße und Hausnummer" name="street" />
          <Field defaultValue={company?.postalCode ?? "63843"} label="PLZ" name="postalCode" />
          <Field defaultValue={company?.city ?? "Niedernberg"} label="Ort" name="city" />
          <Field defaultValue={company?.country ?? "Deutschland"} label="Land" name="country" />
        </Section>

        <Section title="Kontakt">
          <Field defaultValue={company?.phone ?? "06028 4076000"} label="Telefon" name="phone" />
          <Field defaultValue={company?.mobile ?? ""} label="Mobil" name="mobile" />
          <Field defaultValue={company?.email ?? "info@stix-bau.de"} label="E-Mail" name="email" type="email" />
          <Field defaultValue={company?.website ?? "https://www.stix-bau.de"} label="Website" name="website" type="url" />
        </Section>

        <Section title="Social Media">
          <Field defaultValue={company?.instagramUrl ?? ""} label="Instagram" name="instagramUrl" type="url" />
          <Field defaultValue={company?.linkedinUrl ?? ""} label="LinkedIn" name="linkedinUrl" type="url" />
          <Field defaultValue={company?.facebookUrl ?? ""} label="Facebook" name="facebookUrl" type="url" />
          <Field defaultValue={company?.youtubeUrl ?? ""} label="YouTube" name="youtubeUrl" type="url" />
          <Field defaultValue={company?.tiktokUrl ?? ""} label="TikTok" name="tiktokUrl" type="url" />
        </Section>

        <Section title="Rechtliche Angaben">
          <Field defaultValue={company?.managingDirector ?? ""} label="Geschäftsführer / Vertretungsberechtigte" name="managingDirector" />
          <Field defaultValue={company?.registryCourt ?? ""} label="Registergericht" name="registryCourt" />
          <Field defaultValue={company?.registryNumber ?? ""} label="Registernummer" name="registryNumber" />
          <Field defaultValue={company?.vatId ?? ""} label="USt-IdNr." name="vatId" />
          <Field defaultValue={company?.taxNumber ?? ""} label="Steuernummer" name="taxNumber" />
        </Section>

        <button
          className="rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700"
          type="submit"
        >
          Firmeninfos speichern
        </button>
      </form>
    </AppShell>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="border-t border-gray-200 pt-5">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  defaultValue,
  label,
  name,
  required = false,
  type = "text",
}: {
  defaultValue: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label>
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      <input
        className={inputClass}
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}
