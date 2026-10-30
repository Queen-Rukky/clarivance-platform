// Lead pipeline vocabulary and the pure logic behind the leads pages:
// filters, CSV export, analytics and template drafts. No database access here.
import { z } from "zod";

export const LEAD_STATUSES = ["new", "qualified", "contacted", "replied", "meeting_booked", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  qualified: "Qualified",
  contacted: "Contacted",
  replied: "Replied",
  meeting_booked: "Meeting booked",
  won: "Won",
  lost: "Lost",
};

export const LEAD_SOURCES = ["manual", "website_chat", "whatsapp", "referral", "social", "event", "import", "sample"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  manual: "Added by hand",
  website_chat: "Website chat",
  whatsapp: "WhatsApp",
  referral: "Referral",
  social: "Social media",
  event: "Event",
  import: "Imported",
  sample: "Sample data",
};

// Sources a person can pick when adding a lead (chat sources arrive automatically later).
export const MANUAL_SOURCES = ["manual", "referral", "social", "event", "whatsapp", "website_chat"] as const;

export type Lead = {
  id: string;
  contact_name: string;
  contact_role: string;
  company: string;
  website: string;
  email: string;
  phone: string;
  industry: string;
  location: string;
  source: LeadSource;
  source_detail: string;
  enquiry: string;
  status: LeadStatus;
  score: number | null;
  score_reason: string;
  notes: string;
  next_action: string;
  follow_up_on: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
};

export function leadTitle(l: Pick<Lead, "company" | "contact_name" | "email" | "phone">): string {
  return l.company || l.contact_name || l.email || l.phone || "Unnamed lead";
}

// ---------------------------------------------------------------------------
// Filters (from the URL)
// ---------------------------------------------------------------------------

export const SORTS = {
  newest: "Newest first",
  oldest: "Oldest first",
  score: "Highest score",
  follow_up: "Follow-up date",
  name: "Name A–Z",
} as const;
export type Sort = keyof typeof SORTS;

export type LeadFilters = {
  q: string;
  status: LeadStatus | "";
  source: LeadSource | "";
  minScore: number | null;
  industry: string;
  location: string;
  due: boolean;
  sort: Sort;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseLeadFilters(params: Record<string, string | string[] | undefined>): LeadFilters {
  const status = first(params.status);
  const source = first(params.source);
  const sort = first(params.sort);
  const min = Number.parseInt(first(params.min), 10);
  return {
    q: first(params.q).trim().slice(0, 100),
    status: (LEAD_STATUSES as readonly string[]).includes(status) ? (status as LeadStatus) : "",
    source: (LEAD_SOURCES as readonly string[]).includes(source) ? (source as LeadSource) : "",
    minScore: Number.isFinite(min) && min >= 0 && min <= 100 ? min : null,
    industry: first(params.industry).trim().slice(0, 100),
    location: first(params.location).trim().slice(0, 100),
    due: first(params.due) === "1",
    sort: sort in SORTS ? (sort as Sort) : "newest",
  };
}

export function filtersToSearch(f: LeadFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status) p.set("status", f.status);
  if (f.source) p.set("source", f.source);
  if (f.minScore !== null) p.set("min", String(f.minScore));
  if (f.industry) p.set("industry", f.industry);
  if (f.location) p.set("location", f.location);
  if (f.due) p.set("due", "1");
  if (f.sort !== "newest") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

// Escapes text for a PostgREST ilike pattern inside an or() filter.
export function ilikeTerm(text: string): string {
  return `*${text.replace(/[\\%_*,()."]/g, " ").trim()}*`;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export const CSV_COLUMNS: [keyof Lead, string][] = [
  ["company", "Company"],
  ["contact_name", "Contact name"],
  ["contact_role", "Contact role"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["website", "Website"],
  ["industry", "Industry"],
  ["location", "Location"],
  ["status", "Status"],
  ["score", "Score"],
  ["score_reason", "Score reason"],
  ["source", "Source"],
  ["source_detail", "Source detail"],
  ["next_action", "Next action"],
  ["follow_up_on", "Follow-up date"],
  ["notes", "Notes"],
  ["is_sample", "Sample record"],
  ["created_at", "Created"],
];

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Stop spreadsheet apps treating a cell as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function leadsToCsv(leads: Lead[]): string {
  const header = CSV_COLUMNS.map(([, label]) => csvCell(label)).join(",");
  const rows = leads.map((l) =>
    CSV_COLUMNS.map(([key]) => {
      if (key === "status") return csvCell(STATUS_LABELS[l.status]);
      if (key === "source") return csvCell(SOURCE_LABELS[l.source]);
      if (key === "is_sample") return csvCell(l.is_sample ? "yes" : "no");
      return csvCell(l[key]);
    }).join(","),
  );
  return [header, ...rows].join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

// The happy path, in order. "Reached" a stage means the lead was ever in it
// or any later stage, so skipped stages still count.
export const FUNNEL: LeadStatus[] = ["new", "qualified", "contacted", "replied", "meeting_booked", "won"];

export type HistoryRow = { lead_id: string; status: LeadStatus };
export type AnalyticsLead = Pick<Lead, "id" | "status" | "source" | "follow_up_on" | "created_at">;

export type Analytics = {
  total: number;
  byStatus: Record<LeadStatus, number>;
  reached: Record<LeadStatus, number>;
  conversions: { from: LeadStatus; to: LeadStatus; rate: number | null }[];
  sources: { source: LeadSource; leads: number; won: number; winRate: number | null }[];
  followUpsDue: number;
};

export function computeAnalytics(leads: AnalyticsLead[], history: HistoryRow[], today: string): Analytics {
  const ids = new Set(leads.map((l) => l.id));
  const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const l of leads) byStatus[l.status] += 1;

  const furthest = new Map<string, number>();
  const ever = new Map<string, Set<LeadStatus>>();
  for (const h of history) {
    if (!ids.has(h.lead_id)) continue;
    const idx = FUNNEL.indexOf(h.status);
    if (idx > (furthest.get(h.lead_id) ?? -1)) furthest.set(h.lead_id, idx);
    if (!ever.has(h.lead_id)) ever.set(h.lead_id, new Set());
    ever.get(h.lead_id)!.add(h.status);
  }
  for (const l of leads) {
    const idx = FUNNEL.indexOf(l.status);
    if (idx > (furthest.get(l.id) ?? -1)) furthest.set(l.id, idx);
  }

  const reached = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const l of leads) {
    const f = furthest.get(l.id) ?? 0;
    FUNNEL.forEach((s, i) => {
      if (i <= f) reached[s] += 1;
    });
    if (l.status === "lost" || ever.get(l.id)?.has("lost")) reached.lost += 1;
  }

  const conversions = FUNNEL.slice(1).map((to, i) => {
    const from = FUNNEL[i];
    return { from, to, rate: reached[from] ? reached[to] / reached[from] : null };
  });

  const sourceMap = new Map<LeadSource, { leads: number; won: number }>();
  for (const l of leads) {
    const s = sourceMap.get(l.source) ?? { leads: 0, won: 0 };
    s.leads += 1;
    if (l.status === "won") s.won += 1;
    sourceMap.set(l.source, s);
  }
  const sources = [...sourceMap.entries()]
    .map(([source, s]) => ({ source, ...s, winRate: s.leads ? s.won / s.leads : null }))
    .sort((a, b) => b.leads - a.leads);

  const followUpsDue = leads.filter(
    (l) => l.follow_up_on && l.follow_up_on <= today && l.status !== "won" && l.status !== "lost",
  ).length;

  return { total: leads.length, byStatus, reached, conversions, sources, followUpsDue };
}

export const RANGES = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", all: "All time" } as const;
export type Range = keyof typeof RANGES;

export function parseRange(v: string | string[] | undefined): Range {
  const s = first(v);
  return s in RANGES ? (s as Range) : "30";
}

export function rangeStart(range: Range, now: Date): string | null {
  if (range === "all") return null;
  return new Date(now.getTime() - Number(range) * 864e5).toISOString();
}

export function percent(rate: number | null): string {
  return rate === null ? "–" : `${Math.round(rate * 100)}%`;
}

// ---------------------------------------------------------------------------
// Template outreach drafts (used until an AI key is configured)
// ---------------------------------------------------------------------------

export type DraftContext = {
  businessName: string;
  offer: string;
  lead: Pick<Lead, "contact_name" | "company" | "industry" | "location" | "enquiry" | "status">;
  senderName: string;
};

export type Draft = { subject: string; body: string; gaps: string[] };

function firstName(name: string) {
  return name.replace(/^sample:\s*/i, "").trim().split(/\s+/)[0] ?? "";
}

// Builds a plain draft from facts already on the record. It never adds facts:
// anything missing is listed in `gaps` and left as a [bracketed] prompt. The
// wording follows the writing rules in outreach-rules.ts.
export function templateDraft(ctx: DraftContext, channel: "email" | "social" | "whatsapp"): Draft {
  const gaps: string[] = [];
  const name = firstName(ctx.lead.contact_name);
  if (!name) gaps.push("contact name");
  const greeting = name ? `Hi ${name},` : "Hello,";

  let reason: string;
  if (ctx.lead.enquiry) {
    reason = `Thanks for getting in touch about this: "${ctx.lead.enquiry.slice(0, 200)}".`;
  } else if (ctx.lead.company && ctx.lead.industry) {
    const where = ctx.lead.location ? ` in ${ctx.lead.location}` : "";
    reason = `${ctx.lead.company} came up while I was looking at ${ctx.lead.industry.toLowerCase()} businesses${where}.`;
  } else {
    gaps.push("a specific reason for contacting them");
    reason = "[Add a specific, factual reason you're contacting them.]";
  }

  let value: string;
  if (ctx.offer) {
    value = `At ${ctx.businessName}, ${ctx.offer.trim().replace(/\.$/, "")}.`;
  } else {
    gaps.push("your offer (add it in Setup)");
    value = `[Describe in one sentence how ${ctx.businessName} can help.]`;
  }

  const cta =
    ctx.lead.status === "meeting_booked"
      ? "Is there anything you'd like me to prepare before we meet?"
      : "Would a 15-minute call this week be useful?";

  const sign = ctx.senderName ? `\n\n${ctx.senderName}\n${ctx.businessName}` : `\n\n${ctx.businessName}`;
  const body =
    channel === "email"
      ? `${greeting}\n\n${reason}\n\n${value}\n\n${cta}${sign}`
      : `${greeting} ${reason} ${value} ${cta}`;
  // Short, lowercase-led and without the person's name (see outreach-rules.ts).
  const subject =
    channel !== "email" ? "" : ctx.lead.enquiry ? "your enquiry" : ctx.lead.company ? `idea for ${ctx.lead.company}` : "a thought";
  return { subject, body, gaps };
}

// ---------------------------------------------------------------------------
// Validation for the lead form
// ---------------------------------------------------------------------------

const optional = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);

export const leadSchema = z
  .object({
    contact_name: optional(200),
    contact_role: optional(200),
    company: optional(200),
    website: optional(300),
    email: z.union([z.literal(""), z.email("Enter a valid email address.").transform((v) => v.toLowerCase())]),
    phone: optional(50),
    industry: optional(120),
    location: optional(200),
    source_detail: optional(500),
    enquiry: optional(4000),
    status: z.enum(LEAD_STATUSES, "Choose a stage."),
    score: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : Number(v)))
      .pipe(z.number().int("Score must be a whole number.").min(0).max(100, "Score must be 0 to 100.").nullable()),
    score_reason: optional(2000),
    notes: optional(8000),
    next_action: optional(500),
    follow_up_on: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a valid follow-up date.")
      .transform((v) => (v === "" ? null : v)),
  })
  .refine((v) => Boolean(v.contact_name || v.company || v.email || v.phone), {
    message: "Add at least a name, company, email or phone number.",
  });

export const newLeadSchema = z.intersection(leadSchema, z.object({ source: z.enum(MANUAL_SOURCES, "Choose a source.") }));
