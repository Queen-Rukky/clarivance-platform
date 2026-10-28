import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { createLead } from "../actions";
import { LeadFields } from "../lead-fields";

export const metadata = { title: "Add a lead · Clarivance" };

export default async function NewLeadPage({ params }: PageProps<"/b/[businessId]/leads/new">) {
  const { businessId } = await params;
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/b/${businessId}/leads`} className="text-sm text-muted">← Leads</Link>
        <h1 className="page-title">Add a lead</h1>
      </div>
      <section className="card">
        <ActionForm action={createLead} submitLabel="Save lead" pendingLabel="Saving…">
          <input type="hidden" name="businessId" value={businessId} />
          <LeadFields withSource />
        </ActionForm>
      </section>
    </>
  );
}
