"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getBusiness, getLead, getProfile } from "@/lib/data";
import { friendlyDbError, type ActionState } from "@/lib/errors";
import { LEAD_STATUSES, leadSchema, newLeadSchema, templateDraft } from "@/lib/leads";
import { checkDraft } from "@/lib/outreach-rules";
import { createClient } from "@/lib/supabase/server";
import { firstIssue } from "@/lib/validation";

// The signed-in user's client does every write, so RLS decides who may do what.

const LEAD_FIELDS = [
  "contact_name", "contact_role", "company", "website", "email", "phone", "industry", "location",
  "source_detail", "enquiry", "status", "score", "score_reason", "notes", "next_action", "follow_up_on",
] as const;

function readLead(formData: FormData) {
  return Object.fromEntries(LEAD_FIELDS.map((k) => [k, formData.get(k)?.toString() ?? ""]));
}

function leadError(error: { code?: string; message?: string }, fallback: string): string {
  if (error.message === "lead limit reached for your plan") {
    return "You've reached your plan's lead limit. Upgrade in Settings, or delete leads you no longer need.";
  }
  if (error.code === "42501") return "You don't have permission to do that.";
  return friendlyDbError(error, fallback);
}

const ids = z.object({ businessId: z.uuid(), leadId: z.uuid() });

export async function createLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const businessId = z.uuid().safeParse(formData.get("businessId"));
  if (!businessId.success) return { error: "Unknown business." };
  const parsed = newLeadSchema.safeParse({ ...readLead(formData), source: formData.get("source") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({ business_id: businessId.data, ...parsed.data })
    .select("id")
    .single();
  if (error) return { error: leadError(error, "Could not save this lead.") };

  revalidatePath(`/b/${businessId.data}`, "layout");
  redirect(`/b/${businessId.data}/leads/${data.id}?created=1`);
}

export async function updateLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const p = ids.safeParse({ businessId: formData.get("businessId"), leadId: formData.get("leadId") });
  if (!p.success) return { error: "Invalid request." };
  const parsed = leadSchema.safeParse(readLead(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update(parsed.data)
    .eq("id", p.data.leadId)
    .eq("business_id", p.data.businessId)
    .select("id");
  if (error) return { error: leadError(error, "Could not save changes.") };
  if (!data?.length) return { error: "You don't have permission to do that." };

  revalidatePath(`/b/${p.data.businessId}`, "layout");
  return { ok: "Saved." };
}

// Quick stage change from the lead list or profile.
export async function setLeadStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const p = ids.safeParse({ businessId: formData.get("businessId"), leadId: formData.get("leadId") });
  const status = z.enum(LEAD_STATUSES).safeParse(formData.get("status"));
  if (!p.success || !status.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ status: status.data })
    .eq("id", p.data.leadId)
    .eq("business_id", p.data.businessId)
    .select("id");
  if (error) return { error: leadError(error, "Could not change the stage.") };
  if (!data?.length) return { error: "You don't have permission to do that." };
  revalidatePath(`/b/${p.data.businessId}`, "layout");
  return { ok: "Stage updated." };
}

export async function deleteLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const p = ids.safeParse({ businessId: formData.get("businessId"), leadId: formData.get("leadId") });
  if (!p.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .delete()
    .eq("id", p.data.leadId)
    .eq("business_id", p.data.businessId)
    .select("id");
  if (error) return { error: leadError(error, "Could not delete this lead.") };
  if (!data?.length) return { error: "Only owners and admins can delete leads." };

  revalidatePath(`/b/${p.data.businessId}`, "layout");
  redirect(`/b/${p.data.businessId}/leads?deleted=1`);
}

// ---------------------------------------------------------------------------
// Outreach drafts. Clarivance never sends them; the user copies and sends.
// ---------------------------------------------------------------------------

const CHANNELS = ["email", "social", "whatsapp"] as const;

export async function generateDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const p = ids.safeParse({ businessId: formData.get("businessId"), leadId: formData.get("leadId") });
  const channel = z.enum(CHANNELS).safeParse(formData.get("channel"));
  if (!p.success || !channel.success) return { error: "Invalid request." };

  const [business, profile, lead] = await Promise.all([
    getBusiness(p.data.businessId, user.id),
    getProfile(p.data.businessId),
    getLead(p.data.businessId, p.data.leadId),
  ]);
  if (!business || !lead) return { error: "Lead not found." };

  const draft = templateDraft(
    { businessName: business.name, offer: profile.offer, lead, senderName: "" },
    channel.data,
  );
  const supabase = await createClient();
  const { error } = await supabase.from("outreach_drafts").insert({
    business_id: p.data.businessId,
    lead_id: p.data.leadId,
    channel: channel.data,
    subject: draft.subject,
    body: draft.body,
    generated_by: "template",
  });
  if (error) return { error: friendlyDbError(error, "Could not create a draft.") };

  revalidatePath(`/b/${p.data.businessId}/leads/${p.data.leadId}`);
  return draft.gaps.length
    ? { ok: `Draft created. Fill in the [bracketed] parts: ${draft.gaps.join(", ")}.` }
    : { ok: "Draft created. Read it, edit it, then approve it before you send it yourself." };
}

const draftIds = z.object({ businessId: z.uuid(), leadId: z.uuid(), draftId: z.uuid() });

export async function saveDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const p = draftIds.safeParse({
    businessId: formData.get("businessId"),
    leadId: formData.get("leadId"),
    draftId: formData.get("draftId"),
  });
  const channel = z.enum(CHANNELS).safeParse(formData.get("channel"));
  const fields = z
    .object({
      subject: z.string().trim().max(200, "Subject is too long."),
      body: z.string().trim().min(1, "The message is empty.").max(5000, "The message is too long."),
      approve: z.boolean(),
    })
    .safeParse({ subject: formData.get("subject") ?? "", body: formData.get("body") ?? "", approve: formData.get("intent") === "approve" });
  if (!p.success || !channel.success) return { error: "Invalid request." };
  if (!fields.success) return { error: firstIssue(fields.error) };
  if (fields.data.approve && /\[[^\]]+\]/.test(fields.data.body)) {
    return { error: "Fill in or remove the [bracketed] parts before approving." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outreach_drafts")
    .update({
      subject: fields.data.subject,
      body: fields.data.body,
      status: fields.data.approve ? "approved" : "draft",
    })
    .eq("id", p.data.draftId)
    .eq("business_id", p.data.businessId)
    .select("id");
  if (error) return { error: friendlyDbError(error, "Could not save the draft.") };
  if (!data?.length) return { error: "You don't have permission to do that." };

  revalidatePath(`/b/${p.data.businessId}/leads/${p.data.leadId}`);
  const issues = checkDraft(fields.data, channel.data).length;
  const note = issues ? ` The writing check has ${issues} suggestion${issues > 1 ? "s" : ""} below.` : "";
  return {
    ok: fields.data.approve ? `Approved. Copy it and send it from your own email or app.${note}` : `Draft saved.${note}`,
  };
}

export async function deleteDraft(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const p = draftIds.safeParse({
    businessId: formData.get("businessId"),
    leadId: formData.get("leadId"),
    draftId: formData.get("draftId"),
  });
  if (!p.success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.from("outreach_drafts").delete().eq("id", p.data.draftId).eq("business_id", p.data.businessId);
  if (error) return { error: friendlyDbError(error, "Could not delete the draft.") };
  revalidatePath(`/b/${p.data.businessId}/leads/${p.data.leadId}`);
  return { ok: "Draft deleted." };
}
