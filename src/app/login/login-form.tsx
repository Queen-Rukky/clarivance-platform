"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";
import type { ActionState } from "@/lib/errors";

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signingIn] = useActionState<ActionState, FormData>(signIn, {});
  const [signUpState, signUpAction, signingUp] = useActionState<ActionState, FormData>(signUp, {});
  const state = mode === "signin" ? signInState : signUpState;
  const pending = signingIn || signingUp;

  return (
    <form action={mode === "signin" ? signInAction : signUpAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required inputMode="email" />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />
      </label>
      {state.error && <p role="alert" className="notice notice-error">{state.error}</p>}
      {state.ok && <p role="status" className="notice notice-ok">{state.ok}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
      <button
        type="button"
        className="text-sm text-muted underline underline-offset-4"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
      >
        {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
