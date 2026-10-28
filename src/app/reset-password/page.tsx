import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { getCurrentUser } from "@/lib/auth";
import { updatePassword } from "../login/actions";

export const metadata = { title: "Choose a new password · Clarivance" };

// Reached from the password reset email, which signs the user in first.
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="eyebrow">Clarivance</p>
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
      </div>
      {user ? (
        <ActionForm action={updatePassword} submitLabel="Save new password" className="flex flex-col gap-4">
          <p className="text-sm text-muted">For {user.email}</p>
          <label className="field">
            <span>New password</span>
            <input name="password" type="password" minLength={8} required autoComplete="new-password" />
          </label>
          <label className="field">
            <span>Type it again</span>
            <input name="confirm" type="password" minLength={8} required autoComplete="new-password" />
          </label>
        </ActionForm>
      ) : (
        <>
          <p role="alert" className="notice notice-error">This reset link is invalid or has expired.</p>
          <Link href="/login" className="btn btn-primary text-center">Request a new link</Link>
        </>
      )}
    </main>
  );
}
