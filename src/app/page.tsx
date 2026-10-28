import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-12">
      <p className="eyebrow">Clarivance</p>
      <h1 className="text-3xl font-semibold leading-tight">Every enquiry answered, every lead followed up.</h1>
      <p className="text-muted">
        Clarivance agents answer customer enquiries from your approved business information, qualify leads and draft
        quotes for your approval.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="btn btn-primary">Sign in</Link>
        <Link href="/dashboard" className="btn btn-ghost">Dashboard</Link>
      </div>
    </main>
  );
}
