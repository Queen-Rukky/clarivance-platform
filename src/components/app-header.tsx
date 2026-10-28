import Link from "next/link";
import { signOut } from "@/app/login/actions";

export function AppHeader({ email }: { email: string | null }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/dashboard" className="font-semibold">Clarivance</Link>
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden truncate text-sm text-muted sm:inline">{email}</span>
          <form action={signOut}>
            <button type="submit" className="btn btn-ghost">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
