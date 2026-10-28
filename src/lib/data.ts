import "server-only";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
import { isRole, type Role } from "@/lib/roles";
import {
  ilikeTerm,
  type AnalyticsLead,
  type HistoryRow,
  type Lead,
  type LeadFilters,
  type LeadStatus,
} from "@/lib/leads";

// All reads go through the signed-in user's client, so RLS decides what
// comes back. A business the user doesn't belong to simply isn't found.

export type BusinessSummary = { id: string; name: string; role: Role };

export async function listMyBusinesses(userId: string): Promise<BusinessSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_members")
    .select("role, businesses ( id, name )")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listMyBusinesses failed", error);
    throw new Error(friendlyDbError(error, "Could not load your businesses."));
  }

  return (data ?? []).flatMap((row) => {
    const biz = Array.isArray(row.businesses) ? row.businesses[0] : row.businesses;
    if (!biz || !isRole(row.role)) return [];
    return [{ id: biz.id as string, name: biz.name as string, role: row.role }];
  });
}

export type Plan = "trial" | "starter" | "growth" | "cancelled";
export type BusinessDetail = {
  id: string;
  name: string;
  created_at: string;
  plan: Plan;
  trial_ends_at: string;
  myRole: Role | null;
};

export async function getBusiness(businessId: string, userId: string): Promise<BusinessDetail | null> {
  const supabase = await createClient();
  const [{ data: biz, error }, { data: membership }] = await Promise.all([
    supabase.from("businesses").select("id, name, created_at, plan, trial_ends_at").eq("id", businessId).maybeSingle(),
    supabase.from("business_members").select("role").eq("business_id", businessId).eq("user_id", userId).maybeSingle(),
  ]);
  if (error || !biz) return null;
  return { ...(biz as Omit<BusinessDetail, "myRole">), myRole: isRole(membership?.role) ? membership.role : null };
}

export type Member = { user_id: string; email: string; role: Role; created_at: string };

export async function listMembers(businessId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_members", { p_business: businessId });
  if (error) throw new Error(`Could not load members: ${error.message}`);
  return ((data ?? []) as Member[]).filter((m) => isRole(m.role));
}

export type Invite = { id: string; email: string; role: Role; created_at: string };

// Only owners and admins can see invites; everyone else gets an empty list.
export async function listInvites(businessId: string): Promise<Invite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .select("id, email, role, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listInvites failed", error);
    return [];
  }
  return ((data ?? []) as Invite[]).filter((i) => isRole(i.role));
}

// Turns invites sent to the user's (confirmed) email into memberships.
export async function acceptMyInvites(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_my_invites");
  if (error) {
    console.error("accept_my_invites failed", error);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

export type ActivityEntry = {
  id: number;
  action: string;
  actor_user_id: string | null;
  actor_agent: string | null;
  entity_type: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export async function listActivity(businessId: string, limit = 30): Promise<ActivityEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, action, actor_user_id, actor_agent, entity_type, details, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load activity: ${error.message}`);
  return (data ?? []) as ActivityEntry[];
}

export type Profile = {
  website: string;
  offer: string;
  ideal_industries: string;
  ideal_locations: string;
  company_size: string;
  decision_maker: string;
  lead_sources: string[];
  contact_channels: string[];
  exclusions: string;
  qualification_rules: string;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  about: string;
  location: string;
  contact_email: string;
  contact_phone: string;
  opening_hours: string;
  tone: string;
};

export type Service = {
  id: string;
  name: string;
  description: string;
  price_type: "fixed" | "from" | "range" | "ask_owner";
  price_min: number | null;
  price_max: number | null;
  currency: string;
  status: "draft" | "approved";
};

export type Faq = { id: string; question: string; answer: string; status: "draft" | "approved" };

export const EMPTY_PROFILE: Profile = {
  website: "",
  offer: "",
  ideal_industries: "",
  ideal_locations: "",
  company_size: "",
  decision_maker: "",
  lead_sources: [],
  contact_channels: [],
  exclusions: "",
  qualification_rules: "",
  onboarding_step: 0,
  onboarding_completed_at: null,
  about: "",
  location: "",
  contact_email: "",
  contact_phone: "",
  opening_hours: "",
  tone: "",
};

const PROFILE_COLUMNS =
  "website, offer, ideal_industries, ideal_locations, company_size, decision_maker, lead_sources, contact_channels, " +
  "exclusions, qualification_rules, onboarding_step, onboarding_completed_at, about, location, contact_email, " +
  "contact_phone, opening_hours, tone";

export async function getProfile(businessId: string): Promise<Profile> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("business_profiles").select(PROFILE_COLUMNS).eq("business_id", businessId).maybeSingle();
  if (error) {
    console.error("getProfile failed", error);
    throw new Error(friendlyDbError(error, "Could not load your setup."));
  }
  return (data as unknown as Profile | null) ?? EMPTY_PROFILE;
}

export async function getKnowledgeBase(businessId: string): Promise<{ profile: Profile; services: Service[]; faqs: Faq[] }> {
  const supabase = await createClient();
  const [profile, services, faqs] = await Promise.all([
    supabase
      .from("business_profiles")
      .select(PROFILE_COLUMNS)
      .eq("business_id", businessId)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, name, description, price_type, price_min, price_max, currency, status")
      .eq("business_id", businessId)
      .order("name"),
    supabase
      .from("knowledge_items")
      .select("id, question, answer, status")
      .eq("business_id", businessId)
      .order("created_at"),
  ]);
  const error = profile.error ?? services.error ?? faqs.error;
  if (error) {
    console.error("getKnowledgeBase failed", error);
    throw new Error(friendlyDbError(error, "Could not load the knowledge base."));
  }
  return {
    profile: (profile.data as unknown as Profile | null) ?? EMPTY_PROFILE,
    // numeric columns arrive as strings or numbers depending on size
    services: ((services.data ?? []) as Service[]).map((s) => ({
      ...s,
      price_min: s.price_min === null ? null : Number(s.price_min),
      price_max: s.price_max === null ? null : Number(s.price_max),
    })),
    faqs: (faqs.data ?? []) as Faq[],
  };
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export const LEAD_COLUMNS =
  "id, contact_name, contact_role, company, website, email, phone, industry, location, source, source_detail, " +
  "enquiry, status, score, score_reason, notes, next_action, follow_up_on, is_sample, created_at, updated_at";

export async function listLeads(businessId: string, f: LeadFilters, limit = 500): Promise<Lead[]> {
  const supabase = await createClient();
  let query = supabase.from("leads").select(LEAD_COLUMNS).eq("business_id", businessId);
  if (f.q) {
    const term = ilikeTerm(f.q);
    query = query.or(
      ["company", "contact_name", "email", "phone", "website", "notes"].map((c) => `${c}.ilike.${term}`).join(","),
    );
  }
  if (f.status) query = query.eq("status", f.status);
  if (f.source) query = query.eq("source", f.source);
  if (f.minScore !== null) query = query.gte("score", f.minScore);
  if (f.industry) query = query.ilike("industry", ilikeTerm(f.industry).replace(/\*/g, "%"));
  if (f.location) query = query.ilike("location", ilikeTerm(f.location).replace(/\*/g, "%"));
  if (f.due) {
    query = query.lte("follow_up_on", new Date().toISOString().slice(0, 10)).not("status", "in", "(won,lost)");
  }
  const order: Record<typeof f.sort, [string, boolean]> = {
    newest: ["created_at", false],
    oldest: ["created_at", true],
    score: ["score", false],
    follow_up: ["follow_up_on", true],
    name: ["company", true],
  };
  const [column, ascending] = order[f.sort];
  const { data, error } = await query.order(column, { ascending, nullsFirst: false }).order("created_at", { ascending: false }).limit(limit);
  if (error) {
    console.error("listLeads failed", error);
    throw new Error(friendlyDbError(error, "Could not load leads."));
  }
  return (data ?? []) as unknown as Lead[];
}

export async function getLead(businessId: string, leadId: string): Promise<Lead | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select(LEAD_COLUMNS).eq("business_id", businessId).eq("id", leadId).maybeSingle();
  if (error) {
    console.error("getLead failed", error);
    throw new Error(friendlyDbError(error, "Could not load this lead."));
  }
  return data as unknown as Lead | null;
}

export type Duplicate = { id: string; company: string; contact_name: string; email: string; status: LeadStatus; matched_on: string };

export async function listDuplicates(leadId: string): Promise<Duplicate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lead_duplicates", { p_lead: leadId });
  if (error) {
    console.error("lead_duplicates failed", error);
    return [];
  }
  return (data ?? []) as Duplicate[];
}

export type StageChange = { status: LeadStatus; changed_at: string; changed_by: string | null };

export async function listLeadHistory(leadId: string): Promise<StageChange[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_stage_history")
    .select("status, changed_at, changed_by")
    .eq("lead_id", leadId)
    .order("changed_at", { ascending: true });
  return (data ?? []) as StageChange[];
}

export type OutreachDraft = {
  id: string;
  channel: "email" | "social" | "whatsapp";
  subject: string;
  body: string;
  generated_by: "template" | "ai" | "user";
  status: "draft" | "approved";
  created_at: string;
};

export async function listDrafts(leadId: string): Promise<OutreachDraft[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("outreach_drafts")
    .select("id, channel, subject, body, generated_by, status, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return (data ?? []) as OutreachDraft[];
}

// Everything the overview needs, for real or sample records separately.
export async function getAnalyticsData(businessId: string, since: string | null, sample: boolean) {
  const supabase = await createClient();
  let leads = supabase
    .from("leads")
    .select("id, status, source, follow_up_on, created_at")
    .eq("business_id", businessId)
    .eq("is_sample", sample);
  if (since) leads = leads.gte("created_at", since);
  const history = supabase
    .from("lead_stage_history")
    .select("lead_id, status")
    .eq("business_id", businessId)
    .eq("is_sample", sample);
  const [l, h] = await Promise.all([leads.limit(10000), history.limit(50000)]);
  const error = l.error ?? h.error;
  if (error) {
    console.error("getAnalyticsData failed", error);
    throw new Error(friendlyDbError(error, "Could not load your numbers."));
  }
  return { leads: (l.data ?? []) as AnalyticsLead[], history: (h.data ?? []) as HistoryRow[] };
}

export async function countLeads(businessId: string): Promise<{ real: number; sample: number }> {
  const supabase = await createClient();
  const [real, sample] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("is_sample", false),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("is_sample", true),
  ]);
  return { real: real.count ?? 0, sample: sample.count ?? 0 };
}
