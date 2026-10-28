"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { credentialsSchema, emailSchema, firstIssue, newPasswordSchema } from "@/lib/validation";
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

  const origin = await appOrigin();
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

async function appOrigin() {
  return process.env.APP_URL ?? (await headers()).get("origin") ?? "";
}

// Always answers the same way, so the form can't be used to find out who has an account.
export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: firstIssue(email.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await appOrigin()}/auth/confirm?next=/reset-password`,
  });
  if (error?.code === "over_email_send_rate_limit") {
    return { error: "Too many emails right now. Please try again in an hour." };
  }
  if (error) console.error("resetPasswordForEmail failed", error);
  return { ok: "If that email has an account, a reset link is on its way. Check your inbox and spam folder." };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link has expired. Please request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "Choose a password you haven't used here before." };
    if (error.code === "weak_password") return { error: "Please choose a stronger password." };
    return { error: "Could not change your password. Please try again." };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
