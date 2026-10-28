"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { friendlyDbError, type ActionState } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { faqSchema, firstIssue, profileSchema, serviceSchema } from "@/lib/validation";

// Writes go through the signed-in user's client: RLS only lets owners and
// admins change the knowledge base, and triggers log every change.

const NO_PERMISSION = "You don't have permission to do that.";

function field(formData: FormData, name: string) {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

const idsSchema = z.object({ businessId: z.uuid(), id: z.uuid() });

function done(businessId: string, ok: string): ActionState {
  revalidatePath(`/b/${businessId}`, "layout");
  return { ok };
}

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const parsed = profileSchema.safeParse({
    businessId: field(formData, "businessId"),
    about: field(formData, "about"),
    location: field(formData, "location"),
    contact_email: field(formData, "contact_email"),
    contact_phone: field(formData, "contact_phone"),
    opening_hours: field(formData, "opening_hours"),
    tone: field(formData, "tone"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { businessId, ...profile } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .upsert({ business_id: businessId, ...profile })
    .select("business_id");
  if (error) return { error: error.code === "42501" ? NO_PERMISSION : friendlyDbError(error) };
  if (!data?.length) return { error: NO_PERMISSION };
  return done(businessId, "Profile saved.");
}

export async function saveService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const id = field(formData, "id");
  if (id && !z.uuid().safeParse(id).success) return { error: "Invalid request." };
  const parsed = serviceSchema.safeParse({
    businessId: field(formData, "businessId"),
    name: field(formData, "name"),
    description: field(formData, "description"),
    price_type: field(formData, "price_type"),
    price_min: field(formData, "price_min"),
    price_max: field(formData, "price_max"),
    currency: field(formData, "currency") || "NGN",
    approved: formData.get("approved") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { businessId, approved, ...service } = parsed.data;
  const row = { ...service, status: approved ? "approved" : "draft" };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("services").update(row).eq("id", id).eq("business_id", businessId).select("id")
    : await supabase.from("services").insert({ business_id: businessId, ...row }).select("id");
  if (error) return { error: error.code === "42501" ? NO_PERMISSION : friendlyDbError(error, "Could not save that service.") };
  if (!data?.length) return { error: NO_PERMISSION };
  return done(businessId, id ? "Service saved." : "Service added.");
}

export async function saveFaq(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const id = field(formData, "id");
  if (id && !z.uuid().safeParse(id).success) return { error: "Invalid request." };
  const parsed = faqSchema.safeParse({
    businessId: field(formData, "businessId"),
    question: field(formData, "question"),
    answer: field(formData, "answer"),
    approved: formData.get("approved") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { businessId, approved, ...faq } = parsed.data;
  const row = { ...faq, status: approved ? "approved" : "draft" };
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase.from("knowledge_items").update(row).eq("id", id).eq("business_id", businessId).select("id")
    : await supabase.from("knowledge_items").insert({ business_id: businessId, ...row }).select("id");
  if (error) return { error: error.code === "42501" ? NO_PERMISSION : friendlyDbError(error, "Could not save that answer.") };
  if (!data?.length) return { error: NO_PERMISSION };
  return done(businessId, id ? "Answer saved." : "Answer added.");
}

async function setStatus(table: "services" | "knowledge_items", formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const parsed = idsSchema.safeParse({ businessId: field(formData, "businessId"), id: field(formData, "id") });
  const status = field(formData, "status");
  if (!parsed.success || (status !== "approved" && status !== "draft")) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .update({ status })
    .eq("id", parsed.data.id)
    .eq("business_id", parsed.data.businessId)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: NO_PERMISSION };
  return done(parsed.data.businessId, status === "approved" ? "Approved. The agent can use this now." : "Moved back to draft.");
}

async function remove(table: "services" | "knowledge_items", formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const parsed = idsSchema.safeParse({ businessId: field(formData, "businessId"), id: field(formData, "id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", parsed.data.id)
    .eq("business_id", parsed.data.businessId)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: NO_PERMISSION };
  return done(parsed.data.businessId, "Deleted.");
}

export async function setServiceStatus(prev: ActionState, formData: FormData) {
  return setStatus("services", formData);
}
export async function setFaqStatus(prev: ActionState, formData: FormData) {
  return setStatus("knowledge_items", formData);
}
export async function deleteService(prev: ActionState, formData: FormData) {
  return remove("services", formData);
}
export async function deleteFaq(prev: ActionState, formData: FormData) {
  return remove("knowledge_items", formData);
}
