"use client";

import { useActionState, useState } from "react";
import { requestPasswordReset, signIn, signUp } from "./actions";
import type { ActionState } from "@/lib/errors";

type Mode = "signin" | "signup" | "reset";

const SUBMIT_LABEL: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create account",
  reset: "Send reset link",
};

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signInAction, signingIn] = useActionState<ActionState, FormData>(signIn, {});
  const [signUpState, signUpAction, signingUp] = useActionState<ActionState, FormData>(signUp, {});
  const [resetState, resetAction, resetting] = useActionState<ActionState, FormData>(requestPasswordReset, {});
  const state = { signin: signInState, signup: signUpState, reset: resetState }[mode];
  const action = { signin: signInAction, signup: signUpAction, reset: resetAction }[mode];
  const pending = signingIn || signingUp || resetting;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required inputMode="email" />
      </label>
      {mode !== "reset" && (
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
      )}
      {state.error && <p role="alert" className="notice notice-error">{state.error}</p>}
      {state.ok && <p role="status" className="notice notice-ok">{state.ok}</p>}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Please wait…" : SUBMIT_LABEL[mode]}
      </button>
      <div className="flex flex-col items-center gap-2 text-sm text-muted">
        {mode === "signin" && (
          <button type="button" className="underline underline-offset-4" onClick={() => setMode("reset")}>
            Forgot password?
          </button>
        )}
        <button
          type="button"
          className="underline underline-offset-4"
          onClick={() => setMode(mode === "signup" ? "signin" : mode === "reset" ? "signin" : "signup")}
        >
          {mode === "signin" ? "New here? Create an account" : "Back to sign in"}
        </button>
      </div>
    </form>
  );
}
