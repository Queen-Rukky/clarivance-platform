"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { credentialsSchema, firstIssue } from "@/lib/validation";
import type { ActionState } from "@/lib/errors";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Please confirm your email first. Check your inbox." };
    return { error: "Email or password is incorrect." };
  }
  redirect(safeRedirectPath(formData.get("next")));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const origin = process.env.APP_URL ?? (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=/dashboard` },
  });
  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Too many sign-up emails right now. Please try again in an hour." };
    }
    if (error.code === "weak_password") return { error: "Please choose a stronger password." };
    return { error: "Could not create the account. Please try again." };
  }
  if (data.session) redirect("/dashboard");
  return { ok: "Check your email for a confirmation link, then sign in." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
