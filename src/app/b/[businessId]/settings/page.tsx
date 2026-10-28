import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireUser } from "@/lib/auth";
import { countLeads, getBusiness } from "@/lib/data";
import { leadLimit, planName, PLANS, trialDaysLeft } from "@/lib/plans";
import { canEditBusiness } from "@/lib/roles";
import { renameBusiness } from "../actions";
import { deleteBusiness, loadSampleLeads, removeSampleLeads } from "./actions";

export const metadata = { title: "Settings · Clarivance" };

export default async function SettingsPage({ params }: PageProps<"/b/[businessId]/settings">) {
  const { businessId } = await params;
  const user = await requireUser();
  const [business, counts] = await Promise.all([getBusiness(businessId, user.id), countLeads(businessId)]);
  const b = business!;
  const edit = canEditBusiness(b.myRole);
  const owner = b.myRole === "owner";
  const limit = leadLimit(b.plan);
  const used = limit ? Math.min(1, counts.real / limit) : 1;
  const hidden = <input type="hidden" name="businessId" value={b.id} />;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="page-title">Settings</h1>
        <p className="text-muted">Business details, plan and usage, data and privacy.</p>
      </div>

      {edit && (
        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Business name</h2>
          <ActionForm action={renameBusiness} submitLabel="Save name">
            {hidden}
            <label className="field"><span>Name</span><input name="name" defaultValue={b.name} required minLength={2} maxLength={120} /></label>
          </ActionForm>
        </section>
      )}

      <section className="card flex flex-col gap-4" aria-labelledby="plan">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id="plan" className="font-semibold">Plan: {planName(b.plan)}</h2>
            {b.plan === "trial" && <p className="text-sm text-muted">{trialDaysLeft(b.trial_ends_at, new Date())} days left in your trial.</p>}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm"><span>Leads</span><span className="tabular-nums">{counts.real} / {limit.toLocaleString()}</span></div>
          <div className="bar-track" role="progressbar" aria-label="Leads used" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={counts.real}>
            <div className="bar-fill" style={{ width: `${used * 100}%`, background: used >= 0.9 ? "var(--warn)" : undefined }} />
          </div>
          <p className="text-xs text-muted">Sample leads don&apos;t count. When you reach the limit, new leads are refused until you upgrade or delete some.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["starter", "growth"] as const).map((p) => (
            <div key={p} className="rounded-xl border border-line p-4">
              <p className="font-semibold">{PLANS[p].name}</p>
              <p className="text-lg font-semibold">{PLANS[p].price}</p>
              <p className="text-sm text-muted">{PLANS[p].summary} Up to {PLANS[p].leads.toLocaleString()} leads.</p>
            </div>
          ))}
        </div>
        <p className="notice notice-info">
          Online payment isn&apos;t switched on yet, so you can&apos;t be charged here. To upgrade during the pilot, contact
          Clarivance and we&apos;ll change your plan by hand. Cancelling works the same way, and you can delete your data below at
          any time.
        </p>
      </section>

      <section id="sample" className="card flex flex-col gap-3 scroll-mt-20">
        <h2 className="font-semibold">Sample data</h2>
        <p className="text-sm text-muted">
          Six fictional leads with example.com addresses, so you can try the pipeline, filters, drafts and export. They&apos;re
          labelled &quot;Sample&quot; everywhere, kept out of your real numbers, and removed in one click.
        </p>
        {edit ? (
          <div className="flex flex-wrap gap-2">
            {counts.sample === 0 ? (
              <ActionForm action={loadSampleLeads} submitLabel="Load sample leads" pendingLabel="Loading…" buttonClassName="btn btn-ghost">{hidden}</ActionForm>
            ) : (
              <ActionForm action={removeSampleLeads} submitLabel={`Remove ${counts.sample} sample leads`} pendingLabel="Removing…" buttonClassName="btn btn-ghost" confirmMessage="Remove all sample leads and their drafts?">{hidden}</ActionForm>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Only owners and admins can change sample data.</p>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="font-semibold">Your data</h2>
        <ul className="flex flex-col gap-1 text-sm text-muted">
          <li>Your data is stored in Supabase (Postgres) and only members of this business can read it.</li>
          <li>Every important change is recorded in Activity.</li>
          <li>Clarivance doesn&apos;t sell your data or contact your leads.</li>
        </ul>
        <div><Link href={`/b/${b.id}/leads/export`} className="btn btn-ghost" prefetch={false}>Download all leads (CSV)</Link></div>
      </section>

      {owner && (
        <section className="card flex flex-col gap-3 border-[var(--danger)]">
          <h2 className="font-semibold text-[var(--danger)]">Delete this business</h2>
          <p className="text-sm text-muted">
            Permanently deletes {b.name} with all its leads, drafts, knowledge base, team access and activity. Download your
            leads first if you need them. This can&apos;t be undone.
          </p>
          <ActionForm action={deleteBusiness} submitLabel="Delete business forever" pendingLabel="Deleting…" buttonClassName="btn btn-danger" confirmMessage={`Really delete ${b.name} and everything in it?`}>
            {hidden}
            <label className="field"><span>Type the business name to confirm: <strong>{b.name}</strong></span><input name="confirmName" required autoComplete="off" /></label>
          </ActionForm>
        </section>
      )}
    </>
  );
}
