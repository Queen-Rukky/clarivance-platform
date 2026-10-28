"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { friendlyDbError, type ActionState } from "@/lib/errors";
import { isRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { addMemberSchema, businessNameSchema, firstIssue, memberChangeSchema } from "@/lib/validation";

// Every action re-checks the user here; the database then enforces roles.

export async function renameBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const businessId = z.uuid().safeParse(formData.get("businessId"));
  const name = businessNameSchema.safeParse(formData.get("name"));
  if (!businessId.success) return { error: "Unknown business." };
  if (!name.success) return { error: firstIssue(name.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .update({ name: name.data })
    .eq("id", businessId.data)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: "You don't have permission to do that." };

  await supabase.rpc("log_activity", {
    p_business: businessId.data,
    p_action: "business.renamed",
    p_entity_type: "business",
    p_entity_id: businessId.data,
    p_details: { name: name.data },
  });
  revalidatePath(`/b/${businessId.data}`, "layout");
  return { ok: "Saved." };
}

export async function addMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const parsed = addMemberSchema.safeParse({
    businessId: formData.get("businessId"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_member_by_email", {
    p_business: parsed.data.businessId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return { error: friendlyDbError(error, "Could not add that member.") };

  revalidatePath(`/b/${parsed.data.businessId}`, "layout");
  if (data === "invited") {
    return {
      ok: `Invite saved. Ask ${parsed.data.email} to create a Clarivance account with that email; they'll join automatically.`,
    };
  }
  return { ok: `Added ${parsed.data.email}.` };
}

export async function cancelInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const businessId = z.uuid().safeParse(formData.get("businessId"));
  const inviteId = z.uuid().safeParse(formData.get("inviteId"));
  if (!businessId.success || !inviteId.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_invite", { p_invite: inviteId.data });
  if (error) return { error: friendlyDbError(error, "Could not cancel that invite.") };

  revalidatePath(`/b/${businessId.data}`, "layout");
  return { ok: "Invite cancelled." };
}

export async function changeRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const parsed = memberChangeSchema.safeParse({
    businessId: formData.get("businessId"),
    userId: formData.get("userId"),
  });
  const role = formData.get("role");
  if (!parsed.success || !isRole(role)) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member_role", {
    p_business: parsed.data.businessId,
    p_user: parsed.data.userId,
    p_role: role,
  });
  if (error) return { error: friendlyDbError(error, "Could not change that role.") };

  revalidatePath(`/b/${parsed.data.businessId}`, "layout");
  return { ok: "Role updated." };
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const parsed = memberChangeSchema.safeParse({
    businessId: formData.get("businessId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", {
    p_business: parsed.data.businessId,
    p_user: parsed.data.userId,
  });
  if (error) return { error: friendlyDbError(error, "Could not remove that member.") };

  if (parsed.data.userId === user.id) redirect("/dashboard");
  revalidatePath(`/b/${parsed.data.businessId}`, "layout");
  return { ok: "Member removed." };
}
