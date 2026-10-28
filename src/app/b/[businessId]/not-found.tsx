import Link from "next/link";

export default function WorkspaceNotFound() {
  return (
    <div className="card flex flex-col items-start gap-3">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-muted">That record doesn&apos;t exist, was deleted, or belongs to another business.</p>
      <Link href="/dashboard" className="btn btn-primary">Back to dashboard</Link>
    </div>
  );
}
