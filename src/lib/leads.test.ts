import { describe, expect, it } from "vitest";
import {
  computeAnalytics,
  filtersToSearch,
  ilikeTerm,
  leadSchema,
  leadsToCsv,
  parseLeadFilters,
  templateDraft,
  type Lead,
} from "./leads";

const lead = (over: Partial<Lead>): Lead => ({
  id: "1",
  contact_name: "",
  contact_role: "",
  company: "",
  website: "",
  email: "",
  phone: "",
  industry: "",
  location: "",
  source: "manual",
  source_detail: "",
  enquiry: "",
  status: "new",
  score: null,
  score_reason: "",
  notes: "",
  next_action: "",
  follow_up_on: null,
  is_sample: false,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  ...over,
});

describe("lead filters", () => {
  it("ignores unknown values and round-trips through the URL", () => {
    const f = parseLeadFilters({ status: "won", source: "nope", min: "70", sort: "score", q: " clinic ", due: "1" });
    expect(f).toMatchObject({ status: "won", source: "", minScore: 70, sort: "score", q: "clinic", due: true });
    expect(parseLeadFilters(Object.fromEntries(new URLSearchParams(filtersToSearch(f).slice(1))))).toEqual(f);
    expect(parseLeadFilters({ min: "500" }).minScore).toBeNull();
  });

  it("strips characters that would break a search filter", () => {
    expect(ilikeTerm("a,b(c)*%")).toBe("*a b c*");
  });
});

describe("CSV export", () => {
  it("quotes commas and quotes and defuses formulas", () => {
    const csv = leadsToCsv([lead({ company: 'Acme, "Ltd"', notes: "=HYPERLINK(1)", status: "meeting_booked" })]);
    const [header, row] = csv.trim().split("\r\n");
    expect(header.startsWith("Company,Contact name")).toBe(true);
    expect(row).toContain('"Acme, ""Ltd"""');
    expect(row).toContain("'=HYPERLINK(1)");
    expect(row).toContain("Meeting booked");
  });
});

describe("analytics", () => {
  it("counts stages reached, conversion rates, sources and due follow-ups", () => {
    const leads = [
      { id: "a", status: "won" as const, source: "referral" as const, follow_up_on: null, created_at: "" },
      { id: "b", status: "contacted" as const, source: "referral" as const, follow_up_on: "2026-10-01", created_at: "" },
      { id: "c", status: "lost" as const, source: "manual" as const, follow_up_on: "2026-10-01", created_at: "" },
      { id: "d", status: "new" as const, source: "manual" as const, follow_up_on: "2026-12-01", created_at: "" },
    ];
    const history = [
      { lead_id: "a", status: "new" as const },
      { lead_id: "a", status: "won" as const },
      { lead_id: "c", status: "qualified" as const },
      { lead_id: "c", status: "lost" as const },
      { lead_id: "zzz", status: "won" as const },
    ];
    const a = computeAnalytics(leads, history, "2026-10-28");
    expect(a.total).toBe(4);
    expect(a.reached).toMatchObject({ new: 4, qualified: 3, contacted: 2, won: 1, lost: 1 });
    expect(a.conversions[0]).toEqual({ from: "new", to: "qualified", rate: 0.75 });
    expect(a.sources[0]).toMatchObject({ source: "referral", leads: 2, won: 1, winRate: 0.5 });
    expect(a.followUpsDue).toBe(1);
  });

  it("returns empty rates rather than dividing by zero", () => {
    const a = computeAnalytics([], [], "2026-10-28");
    expect(a.conversions.every((c) => c.rate === null)).toBe(true);
  });
});

describe("template drafts", () => {
  const base = { businessName: "Clarivance", senderName: "Bisi", lead: lead({}) };

  it("uses only facts on the record and lists what's missing", () => {
    const d = templateDraft({ ...base, offer: "", lead: lead({ company: "Acme" }) }, "email");
    expect(d.body).toContain("[Add a specific, factual reason");
    expect(d.body).toContain("[Describe in one sentence");
    expect(d.gaps).toEqual(["contact name", "a specific reason for contacting them", "your offer (add it in Setup)"]);
  });

  it("builds an opening, reason, value and one call to action", () => {
    const d = templateDraft(
      { ...base, offer: "we answer every enquiry in under a minute.", lead: lead({ contact_name: "Sample: Ada Bello", enquiry: "Need WhatsApp replies" }) },
      "email",
    );
    expect(d.body.startsWith("Hi Ada,")).toBe(true);
    expect(d.body).toContain('"Need WhatsApp replies"');
    expect(d.body).toContain("At Clarivance, we answer every enquiry in under a minute.");
    expect(d.body.match(/\?/g)).toHaveLength(1);
    expect(d.gaps).toEqual([]);
  });
});

describe("lead form validation", () => {
  const blank = {
    contact_name: "", contact_role: "", company: "", website: "", email: "", phone: "", industry: "", location: "",
    source_detail: "", enquiry: "", status: "new", score: "", score_reason: "", notes: "", next_action: "", follow_up_on: "",
  };

  it("needs some way to identify the lead", () => {
    expect(leadSchema.safeParse(blank).success).toBe(false);
    expect(leadSchema.safeParse({ ...blank, phone: "0801" }).success).toBe(true);
  });

  it("checks score and date", () => {
    expect(leadSchema.safeParse({ ...blank, company: "A", score: "101" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...blank, company: "A", follow_up_on: "tomorrow" }).success).toBe(false);
    expect(leadSchema.parse({ ...blank, company: "A", score: "70", follow_up_on: "2026-11-01" })).toMatchObject({ score: 70, follow_up_on: "2026-11-01" });
  });
});
