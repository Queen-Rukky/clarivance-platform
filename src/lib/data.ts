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
