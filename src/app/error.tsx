"use client";

import Link from "next/link";

// Shown when a page fails to load. Server error details stay in the logs;
// the digest lets us match this screen to a log entry.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-4 py-10">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted">This page couldn&apos;t load. Please try again in a moment.</p>
      {error.digest && <p className="text-xs text-muted">Reference: {error.digest}</p>}
      <div className="flex gap-3">
        <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
        <Link href="/" className="btn btn-ghost">Home</Link>
      </div>
    </main>
  );
}
