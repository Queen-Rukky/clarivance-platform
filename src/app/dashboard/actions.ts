"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { friendlyDbError, type ActionState } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { businessNameSchema, firstIssue } from "@/lib/validation";

export async function createBusiness(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await getCurrentUser())) return { error: "Please sign in again." };

  const parsed = businessNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_business", { p_name: parsed.data });
  if (error || !data) return { error: friendlyDbError(error, "Could not create the business.") };

  redirect(`/b/${data}/setup?step=1`);
}
