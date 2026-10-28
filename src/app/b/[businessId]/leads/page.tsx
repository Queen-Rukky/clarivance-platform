import Link from "next/link";
import { countLeads, getBusiness, listLeads } from "@/lib/data";
import { requireUser } from "@/lib/auth";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  leadTitle,
  parseLeadFilters,
  SORTS,
  SOURCE_LABELS,
  STATUS_LABELS,
} from "@/lib/leads";
import { leadLimit } from "@/lib/plans";

export const metadata = { title: "Leads · Clarivance" };

export default async function LeadsPage({ params, searchParams }: PageProps<"/b/[businessId]/leads">) {
  const { businessId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const f = parseLeadFilters(sp);
  const base = `/b/${businessId}/leads`;
  const [business, leads, counts] = await Promise.all([getBusiness(businessId, user.id), listLeads(businessId, f), countLeads(businessId)]);
  const filtered = Boolean(f.q || f.status || f.source || f.minScore !== null || f.industry || f.location || f.due);
  const today = new Date().toISOString().slice(0, 10);
  const total = counts.real + counts.sample;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="page-title">Leads</h1>
          <p className="text-muted">{counts.real} of {leadLimit(business!.plan).toLocaleString()} on your plan{counts.sample > 0 && `, plus ${counts.sample} sample`}</p>
        </div>
        <Link href={`${base}/new`} className="btn btn-primary">Add lead</Link>
      </div>

      {sp.deleted === "1" && <p role="status" className="notice notice-ok">Lead deleted.</p>}

      <form method="get" className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filter leads">
        <label className="field lg:col-span-2"><span>Search</span><input name="q" type="search" defaultValue={f.q} placeholder="Name, company, email, phone, notes" /></label>
        <label className="field">
          <span>Stage</span>
          <select name="status" className="select" defaultValue={f.status}>
            <option value="">All stages</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Source</span>
          <select name="source" className="select" defaultValue={f.source}>
            <option value="">All sources</option>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="field"><span>Industry</span><input name="industry" defaultValue={f.industry} /></label>
        <label className="field"><span>Location</span><input name="location" defaultValue={f.location} /></label>
        <label className="field"><span>Minimum score</span><input name="min" type="number" min={0} max={100} inputMode="numeric" defaultValue={f.minScore ?? ""} /></label>
        <label className="field">
          <span>Sort</span>
          <select name="sort" className="select" defaultValue={f.sort}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="due" value="1" defaultChecked={f.due} /> Follow-up due</label>
        <div className="flex flex-wrap items-center gap-2 lg:col-span-3 lg:justify-end">
          {filtered && <Link href={base} className="btn btn-ghost">Clear filters</Link>}
          <button type="submit" className="btn btn-primary">Apply filters</button>
        </div>
      </form>

      {total === 0 ? (
        <div className="card flex flex-col items-start gap-3">
          <h2 className="font-semibold">No leads yet</h2>
          <p className="text-sm text-muted">
            Add enquiries as they come in. When the AI chat is switched on, website and WhatsApp enquiries will arrive here by
            themselves. Want to look around first? Load fictional sample leads from Settings.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/new`} className="btn btn-primary">Add a lead</Link>
            <Link href={`/b/${businessId}/settings#sample`} className="btn btn-ghost">Load sample leads</Link>
          </div>
        </div>
      ) : leads.length === 0 ? (
        <p className="card text-muted">No leads match these filters. <Link href={base} className="underline">Clear filters</Link></p>
      ) : (
        <form method="get" action={`${base}/export`} className="flex flex-col gap-3">
          {Object.entries({ q: f.q, status: f.status, source: f.source, min: f.minScore?.toString() ?? "", industry: f.industry, location: f.location, due: f.due ? "1" : "", sort: f.sort })
            .filter(([, v]) => v)
            .map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted">{leads.length} {leads.length === 1 ? "lead" : "leads"}{leads.length === 500 && " (showing the first 500; narrow the filters to see more)"}</p>
            <button type="submit" className="btn btn-ghost">Export ticked, or all shown, to CSV</button>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" className="w-8"><span className="sr-only">Select</span></th>
                  <th scope="col">Lead</th>
                  <th scope="col">Stage</th>
                  <th scope="col" className="text-right">Score</th>
                  <th scope="col" className="hidden md:table-cell">Source</th>
                  <th scope="col" className="hidden lg:table-cell">Next action</th>
                  <th scope="col">Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => {
                  const due = l.follow_up_on && l.follow_up_on <= today && l.status !== "won" && l.status !== "lost";
                  return (
                    <tr key={l.id}>
                      <td><input type="checkbox" name="id" value={l.id} aria-label={`Select ${leadTitle(l)}`} /></td>
                      <td className="min-w-48">
                        <Link href={`${base}/${l.id}`} className="font-medium hover:underline">{leadTitle(l)}</Link>
                        {l.is_sample && <span className="tag tag-sample ml-2">Sample</span>}
                        <p className="text-xs text-muted">{[l.contact_name !== leadTitle(l) && l.contact_name, l.industry, l.location].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td><span className={`tag ${l.status === "lost" ? "tag-muted" : ""}`}>{STATUS_LABELS[l.status]}</span></td>
                      <td className="text-right tabular-nums">{l.score ?? <span className="text-muted">–</span>}</td>
                      <td className="hidden md:table-cell">{SOURCE_LABELS[l.source]}</td>
                      <td className="hidden max-w-56 truncate lg:table-cell">{l.next_action || <span className="text-muted">–</span>}</td>
                      <td className={`whitespace-nowrap ${due ? "font-semibold text-[var(--warn)]" : ""}`}>
                        {l.follow_up_on ? new Date(l.follow_up_on + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : <span className="text-muted">–</span>}
                        {due && <span className="sr-only"> (due)</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      )}
    </>
  );
}
