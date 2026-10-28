import "server-only";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
import { isRole, type Role } from "@/lib/roles";

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

export type BusinessDetail = { id: string; name: string; created_at: string; myRole: Role | null };

export async function getBusiness(businessId: string, userId: string): Promise<BusinessDetail | null> {
  const supabase = await createClient();
  const [{ data: biz, error }, { data: membership }] = await Promise.all([
    supabase.from("businesses").select("id, name, created_at").eq("id", businessId).maybeSingle(),
    supabase.from("business_members").select("role").eq("business_id", businessId).eq("user_id", userId).maybeSingle(),
  ]);
  if (error || !biz) return null;
  return { ...biz, myRole: isRole(membership?.role) ? membership.role : null };
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
  about: "",
  location: "",
  contact_email: "",
  contact_phone: "",
  opening_hours: "",
  tone: "",
};

export async function getKnowledgeBase(businessId: string): Promise<{ profile: Profile; services: Service[]; faqs: Faq[] }> {
  const supabase = await createClient();
  const [profile, services, faqs] = await Promise.all([
    supabase
      .from("business_profiles")
      .select("about, location, contact_email, contact_phone, opening_hours, tone")
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
    profile: (profile.data as Profile | null) ?? EMPTY_PROFILE,
    // numeric columns arrive as strings or numbers depending on size
    services: ((services.data ?? []) as Service[]).map((s) => ({
      ...s,
      price_min: s.price_min === null ? null : Number(s.price_min),
      price_max: s.price_max === null ? null : Number(s.price_max),
    })),
    faqs: (faqs.data ?? []) as Faq[],
  };
}
