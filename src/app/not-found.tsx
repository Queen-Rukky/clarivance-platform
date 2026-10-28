import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-3 px-4 py-10">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted">It doesn&apos;t exist, or you don&apos;t have access to it.</p>
      <Link href="/dashboard" className="btn btn-primary">Go to your dashboard</Link>
    </main>
  );
}
