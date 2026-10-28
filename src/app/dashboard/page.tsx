import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth";
import { listMyBusinesses, type BusinessSummary } from "@/lib/data";
import { createBusiness } from "./actions";

export const metadata = { title: "Dashboard · Clarivance" };

export default async function DashboardPage() {
  const user = await requireUser();
  let businesses: BusinessSummary[] = [];
  let loadError: string | null = null;
  try {
    businesses = await listMyBusinesses(user.id);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load your businesses.";
  }

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6">
        <section className="flex flex-col gap-3">
          <h1 className="text-xl font-semibold">Your businesses</h1>
          {loadError && <p role="alert" className="notice notice-error">{loadError}</p>}
          {loadError ? null : businesses.length === 0 ? (
            <p className="text-muted">You&apos;re not part of a business yet. Create one below, or ask an owner to add you.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {businesses.map((b) => (
                <li key={b.id}>
                  <Link href={`/b/${b.id}`} className="card flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{b.name}</span>
                    <span className="pill">{b.role}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Create a business</h2>
          <ActionForm action={createBusiness} submitLabel="Create business" pendingLabel="Creating…">
            <label className="field">
              <span>Business name</span>
              <input name="name" required minLength={2} maxLength={120} placeholder="e.g. Clarivance" />
            </label>
          </ActionForm>
        </section>
      </main>
    </>
  );
}
