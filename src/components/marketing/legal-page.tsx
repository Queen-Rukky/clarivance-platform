import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-12">
      <Link href="/" className="eyebrow">Clarivance</Link>
      <h1 className="page-title">{title}</h1>
      <p className="text-sm text-muted">Last updated {updated}. Pilot version.</p>
      <div className="flex flex-col gap-4 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted [&_li]:text-muted">{children}</div>
    </main>
  );
}
