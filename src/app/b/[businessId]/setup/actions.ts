"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { friendlyDbError, type ActionState } from "@/lib/errors";
import { parseStep, readStep } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { firstIssue } from "@/lib/validation";

export async function saveSetupStep(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const businessId = z.uuid().safeParse(formData.get("businessId"));
  if (!businessId.success) return { error: "Unknown business." };
  const step = parseStep(formData.get("step")?.toString());
  const parsed = readStep(step, formData);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("business_profiles")
    .select("onboarding_step, onboarding_completed_at")
    .eq("business_id", businessId.data)
    .maybeSingle();

  const { name, ...answers } = parsed.data as Record<string, unknown>;
  if (step === 1 && typeof name === "string") {
    const { data, error } = await supabase.from("businesses").update({ name }).eq("id", businessId.data).select("id");
    if (error) return { error: friendlyDbError(error) };
    if (!data?.length) return { error: "Only owners and admins can change setup." };
  }

  const finished = step === 6;
  const { data, error } = await supabase
    .from("business_profiles")
    .upsert({
      business_id: businessId.data,
      ...answers,
      onboarding_step: Math.max(current?.onboarding_step ?? 0, step),
      ...(finished && !current?.onboarding_completed_at ? { onboarding_completed_at: new Date().toISOString() } : {}),
    })
    .select("business_id");
  if (error) {
    return { error: error.code === "42501" ? "Only owners and admins can change setup." : friendlyDbError(error) };
  }
  if (!data?.length) return { error: "Only owners and admins can change setup." };

  revalidatePath(`/b/${businessId.data}`, "layout");
  redirect(finished ? `/b/${businessId.data}/setup?done=1` : `/b/${businessId.data}/setup?step=${step + 1}`);
}

export async function finishSetup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };
  const businessId = z.uuid().safeParse(formData.get("businessId"));
  if (!businessId.success) return { error: "Unknown business." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_profiles")
    .upsert({ business_id: businessId.data, onboarding_completed_at: new Date().toISOString() })
    .select("business_id");
  if (error || !data?.length) return { error: "Only owners and admins can change setup." };
  revalidatePath(`/b/${businessId.data}`, "layout");
  redirect(`/b/${businessId.data}`);
}
