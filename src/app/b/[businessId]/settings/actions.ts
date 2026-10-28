"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { friendlyDbError, type ActionState } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

const businessIdSchema = z.uuid();

export async function loadSampleLeads(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const businessId = businessIdSchema.safeParse(formData.get("businessId"));
  if (!businessId.success) return { error: "Unknown business." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("load_sample_leads", { p_business: businessId.data });
  if (error) {
    if (error.message === "sample leads are already loaded") return { error: "Sample leads are already loaded." };
    return { error: friendlyDbError(error, "Could not load sample leads.") };
  }
  revalidatePath(`/b/${businessId.data}`, "layout");
  return { ok: `Loaded ${data} fictional sample leads. They're marked "Sample" everywhere and don't count toward your plan.` };
}

export async function removeSampleLeads(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const businessId = businessIdSchema.safeParse(formData.get("businessId"));
  if (!businessId.success) return { error: "Unknown business." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_sample_leads", { p_business: businessId.data });
  if (error) return { error: friendlyDbError(error, "Could not remove sample leads.") };
  revalidatePath(`/b/${businessId.data}`, "layout");
  return { ok: `Removed ${data} sample leads.` };
}

export async function deleteBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const businessId = businessIdSchema.safeParse(formData.get("businessId"));
  if (!businessId.success) return { error: "Unknown business." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_business", {
    p_business: businessId.data,
    p_confirm_name: formData.get("confirmName")?.toString() ?? "",
  });
  if (error) {
    if (error.message === "the name you typed does not match") return { error: "The name you typed doesn't match exactly." };
    if (error.message === "not allowed") return { error: "Only an owner can delete the business." };
    return { error: friendlyDbError(error, "Could not delete the business.") };
  }
  revalidatePath("/dashboard");
  redirect("/dashboard?deleted=1");
}
