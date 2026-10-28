import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { countLeads, getAnalyticsData, getBusiness, getProfile } from "@/lib/data";
import {
  computeAnalytics,
  FUNNEL,
  parseRange,
  percent,
  RANGES,
  rangeStart,
  SOURCE_LABELS,
  STATUS_LABELS,
} from "@/lib/leads";
import { leadLimit, planName, trialDaysLeft } from "@/lib/plans";

export const metadata = { title: "Overview · Clarivance" };

export default async function OverviewPage({ params, searchParams }: PageProps<"/b/[businessId]">) {
  const { businessId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const business = (await getBusiness(businessId, user.id))!;
  const range = parseRange(sp.range);
  const showSample = sp.data === "sample";
  const base = `/b/${businessId}`;

  const now = new Date();
  const [profile, counts, data] = await Promise.all([
    getProfile(businessId),
    countLeads(businessId),
    getAnalyticsData(businessId, rangeStart(range, now), showSample),
  ]);
  const a = computeAnalytics(data.leads, data.history, now.toISOString().slice(0, 10));
  const funnelMax = Math.max(1, ...FUNNEL.map((s) => a.reached[s]));
  const setupDone = Boolean(profile.onboarding_completed_at);
  const limit = leadLimit(business.plan);
  const link = (over: Record<string, string>) => {
    const p = new URLSearchParams({ range, ...(showSample ? { data: "sample" } : {}), ...over });
    if (p.get("data") === "real") p.delete("data");
    return `${base}?${p}`;
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="page-title">Overview</h1>
        <p className="text-muted">
          {planName(business.plan)}
          {business.plan === "trial" && ` · ${trialDaysLeft(business.trial_ends_at, now)} days left`} · {counts.real} of{" "}
          {limit.toLocaleString()} leads used
        </p>
      </div>

      {!setupDone && (
        <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Finish setting up {business.name}</p>
            <p className="text-sm text-muted">Six short questions about what you sell and who you sell to. Skip anything you&apos;re unsure of.</p>
          </div>
          <Link href={`${base}/setup?step=${Math.min(6, profile.onboarding_step + 1)}`} className="btn btn-primary shrink-0">
            {profile.onboarding_step > 0 ? "Continue setup" : "Start setup"}
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
          <Link key={r} href={link({ range: r })} aria-current={r === range ? "true" : undefined} className={`nav-link ${r === range ? "nav-link-active" : ""}`}>
            {RANGES[r]}
          </Link>
        ))}
        <span className="mx-1 h-6 w-px bg-line" aria-hidden />
        <Link href={link({ data: "real" })} aria-current={!showSample ? "true" : undefined} className={`nav-link ${!showSample ? "nav-link-active" : ""}`}>
          Your data
        </Link>
        {counts.sample > 0 && (
          <Link href={link({ data: "sample" })} aria-current={showSample ? "true" : undefined} className={`nav-link ${showSample ? "nav-link-active" : ""}`}>
            Sample data
          </Link>
        )}
      </div>

      {showSample && (
        <p className="notice notice-sample">You&apos;re looking at fictional sample records. These numbers are not real business results.</p>
      )}

      {a.total === 0 ? (
        <div className="card flex flex-col items-start gap-3">
          <h2 className="font-semibold">No leads {range === "all" ? "yet" : `in the ${RANGES[range].toLowerCase()}`}</h2>
          <p className="text-sm text-muted">
            Numbers appear here as soon as you add leads. Every figure is calculated from your own records; nothing is estimated.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/leads/new`} className="btn btn-primary">Add a lead</Link>
            {counts.sample === 0 && <Link href={`${base}/settings#sample`} className="btn btn-ghost">Try with sample data</Link>}
          </div>
        </div>
      ) : (
        <>
          <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Leads" value={a.total} href={`${base}/leads`} />
            <Stat label="Qualified (reached)" value={a.reached.qualified} />
            <Stat label="Contacted (reached)" value={a.reached.contacted} />
            <Stat label="Replies (reached)" value={a.reached.replied} />
            <Stat label="Meetings booked" value={a.reached.meeting_booked} />
            <Stat label="Won" value={a.byStatus.won} />
            <Stat label="Lost" value={a.byStatus.lost} />
            <Stat label="Follow-ups due" value={a.followUpsDue} href={`${base}/leads?due=1`} highlight={a.followUpsDue > 0} />
          </section>

          <section className="card flex flex-col gap-4">
            <div>
              <h2 className="font-semibold">Pipeline</h2>
              <p className="text-sm text-muted">Leads that reached each stage, and the share that moved on to the next.</p>
            </div>
            <ol className="flex flex-col gap-3">
              {FUNNEL.map((s, i) => (
                <li key={s} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_3rem_6rem]">
                  <span className="font-medium">{STATUS_LABELS[s]}</span>
                  <span className="bar-track" aria-hidden>
                    <span className="bar-fill block" style={{ width: `${(a.reached[s] / funnelMax) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums">{a.reached[s]}</span>
                  <span className="hidden text-right text-xs text-muted sm:block">
                    {i > 0 ? `${percent(a.conversions[i - 1].rate)} from ${STATUS_LABELS[FUNNEL[i - 1]].toLowerCase()}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="card flex flex-col gap-3">
            <h2 className="font-semibold">Where leads come from</h2>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th scope="col">Source</th><th scope="col" className="text-right">Leads</th><th scope="col" className="text-right">Won</th><th scope="col" className="text-right">Win rate</th></tr>
                </thead>
                <tbody>
                  {a.sources.map((s) => (
                    <tr key={s.source}>
                      <td>{SOURCE_LABELS[s.source]}</td>
                      <td className="text-right tabular-nums">{s.leads}</td>
                      <td className="text-right tabular-nums">{s.won}</td>
                      <td className="text-right tabular-nums">{percent(s.winRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">Win rates on small numbers move a lot. Treat them as a guide until you have 20+ leads per source.</p>
          </section>
        </>
      )}
    </>
  );
}

function Stat({ label, value, href, highlight }: { label: string; value: number; href?: string; highlight?: boolean }) {
  const body = (
    <>
      <span className={`stat-value ${highlight ? "text-[var(--warn)]" : ""}`}>{value.toLocaleString()}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  return href ? (
    <Link href={href} className="stat flex flex-col gap-1 hover:border-[var(--accent)]">{body}</Link>
  ) : (
    <div className="stat flex flex-col gap-1">{body}</div>
  );
}
