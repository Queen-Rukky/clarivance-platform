"use client";

import { useActionState, type FormEvent, type ReactNode } from "react";
import type { ActionState } from "@/lib/errors";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

// A form wired to a server action that shows its error or success message.
// Pass `confirmMessage` for anything destructive: the browser asks first.
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  className = "flex flex-col gap-3",
  buttonClassName = "btn btn-primary",
  confirmMessage,
  footer,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
  confirmMessage?: string;
  footer?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
  };
  return (
    <form action={formAction} onSubmit={onSubmit} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={buttonClassName} disabled={pending} aria-busy={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {footer}
      </div>
      {state.error && <p role="alert" className="notice notice-error">{state.error}</p>}
      {state.ok && <p role="status" className="notice notice-ok">{state.ok}</p>}
    </form>
  );
}
