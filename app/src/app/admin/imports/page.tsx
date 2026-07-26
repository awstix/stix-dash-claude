import { redirect } from "next/navigation";

export default async function ImportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    created?: string;
    updated?: string;
    skipped?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }

  redirect(`/employees/imports${query.size ? `?${query.toString()}` : ""}`);
}
