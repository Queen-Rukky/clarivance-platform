"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/errors";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// A form wired to a server action that shows its error or success message.
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  className = "flex flex-col gap-3",
  buttonClassName = "btn btn-primary",
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <button type="submit" className={buttonClassName} disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
      {state.error && <p role="alert" className="notice notice-error">{state.error}</p>}
      {state.ok && <p role="status" className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
