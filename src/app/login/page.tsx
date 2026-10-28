import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · Clarivance" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next);
  if (await getCurrentUser()) redirect(next);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div>
        <Link href="/" className="eyebrow">Clarivance</Link>
        <h1 className="text-2xl font-semibold">{params.mode === "signup" ? "Start your free trial" : "Sign in to your workspace"}</h1>
      </div>
      {params.error === "confirm" && (
        <p role="alert" className="notice notice-error">That confirmation link is invalid or has expired.</p>
      )}
      <LoginForm next={next} initialMode={params.mode === "signup" ? "signup" : "signin"} />
    </main>
  );
}
