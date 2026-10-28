import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { requireUser } from "@/lib/auth";
import { getBusiness, getLead, listDrafts, listDuplicates, listLeadHistory, listMembers } from "@/lib/data";
import { leadTitle, SOURCE_LABELS, STATUS_LABELS } from "@/lib/leads";
import { canEditBusiness } from "@/lib/roles";
import { deleteDraft, deleteLead, generateDraft, saveDraft, updateLead } from "../actions";
import { LeadFields } from "../lead-fields";

export const metadata = { title: "Lead · Clarivance" };

const CHANNEL_LABELS = { email: "Email", social: "LinkedIn / social message", whatsapp: "WhatsApp message" } as const;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

export default async function LeadPage({ params, searchParams }: PageProps<"/b/[businessId]/leads/[leadId]">) {
  const { businessId, leadId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) notFound();
  const lead = await getLead(businessId, leadId);
  if (!lead) notFound();

  const [business, duplicates, history, drafts, members] = await Promise.all([
    getBusiness(businessId, user.id),
    listDuplicates(leadId),
    listLeadHistory(leadId),
    listDrafts(leadId),
    listMembers(businessId),
  ]);
  const emailById = new Map(members.map((m) => [m.user_id, m.email]));
  const base = `/b/${businessId}/leads`;
  const hidden = (
    <>
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="leadId" value={leadId} />
    </>
  );
  const websiteHref = lead.website ? (/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`) : null;
  const sourceIsLink = /^https?:\/\//i.test(lead.source_detail);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Link href={base} className="text-sm text-muted">← Leads</Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="page-title break-words">{leadTitle(lead)}</h1>
          <span className={`tag ${lead.status === "lost" ? "tag-muted" : ""}`}>{STATUS_LABELS[lead.status]}</span>
          {lead.is_sample && <span className="tag tag-sample">Sample record</span>}
        </div>
        <p className="text-sm text-muted">
          {SOURCE_LABELS[lead.source]} · added {fmt(lead.created_at)}
          {websiteHref && <> · <a href={websiteHref} target="_blank" rel="noopener noreferrer nofollow" className="underline">website</a></>}
          {sourceIsLink && <> · <a href={lead.source_detail} target="_blank" rel="noopener noreferrer nofollow" className="underline">source evidence</a></>}
        </p>
      </div>

      {sp.created === "1" && <p role="status" className="notice notice-ok">Lead saved.</p>}
      {lead.is_sample && <p className="notice notice-sample">This is a fictional sample record for trying out Clarivance. It is not a real business.</p>}

      {duplicates.length > 0 && (
        <section className="notice notice-sample flex flex-col gap-2" aria-label="Possible duplicates">
          <p className="font-semibold">Possible duplicate{duplicates.length > 1 ? "s" : ""}</p>
          <ul className="flex flex-col gap-1">
            {duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`${base}/${d.id}`} className="underline">{d.company || d.contact_name || d.email}</Link> · same {d.matched_on} · {STATUS_LABELS[d.status]}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <section className="card">
          <h2 className="sr-only">Details</h2>
          <ActionForm action={updateLead} submitLabel="Save changes">
            {hidden}
            <LeadFields lead={lead} />
          </ActionForm>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="card flex flex-col gap-2">
            <h2 className="font-semibold">Stage history</h2>
            <ol className="flex flex-col gap-2 text-sm">
              {history.map((h, i) => (
                <li key={i}>
                  <span className="font-medium">{STATUS_LABELS[h.status]}</span>
                  <span className="block text-xs text-muted">{fmt(h.changed_at)}{h.changed_by && emailById.get(h.changed_by) ? ` · ${emailById.get(h.changed_by)}` : ""}</span>
                </li>
              ))}
            </ol>
          </section>

          {canEditBusiness(business!.myRole) && (
            <section className="card flex flex-col gap-2">
              <h2 className="font-semibold">Delete lead</h2>
              <p className="text-sm text-muted">Removes the lead, its drafts and its history for good.</p>
              <ActionForm action={deleteLead} submitLabel="Delete lead" pendingLabel="Deleting…" buttonClassName="btn btn-danger" confirmMessage={`Delete ${leadTitle(lead)}? This can't be undone.`}>
                {hidden}
              </ActionForm>
            </section>
          )}
        </aside>
      </div>

      <section className="card flex flex-col gap-4" aria-labelledby="outreach">
        <div className="flex flex-col gap-1">
          <h2 id="outreach" className="font-semibold">Outreach drafts</h2>
          <p className="text-sm text-muted">
            Drafts are built only from what&apos;s on this record and your Setup answers; missing facts are left as [brackets] for
            you to fill. AI-written drafts switch on when the AI service is connected. Clarivance never sends messages: approve a
            draft, then copy it into your own email or app.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CHANNEL_LABELS) as (keyof typeof CHANNEL_LABELS)[]).map((c) => (
            <ActionForm key={c} action={generateDraft} submitLabel={`New ${CHANNEL_LABELS[c].toLowerCase()} draft`} pendingLabel="Drafting…" buttonClassName="btn btn-ghost" className="flex flex-col gap-2">
              {hidden}
              <input type="hidden" name="channel" value={c} />
            </ActionForm>
          ))}
        </div>

        {drafts.length === 0 ? (
          <p className="text-sm text-muted">No drafts yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {drafts.map((d) => (
              <li key={d.id} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{CHANNEL_LABELS[d.channel]}</span>
                  <span className={`tag ${d.status === "approved" ? "" : "tag-muted"}`}>{d.status === "approved" ? "Approved" : "Draft, not approved"}</span>
                  <span className="tag tag-muted">{d.generated_by === "template" ? "From template" : d.generated_by === "ai" ? "AI-written" : "Written by you"}</span>
                  <span className="text-xs text-muted">{fmt(d.created_at)}</span>
                </div>
                <ActionForm
                  action={saveDraft}
                  submitLabel="Save draft"
                  buttonClassName="btn btn-ghost"
                  footer={
                    <>
                      <button type="submit" name="intent" value="approve" className="btn btn-primary">Approve</button>
                      <CopyButton label="Copy saved version" text={d.channel === "email" && d.subject ? `Subject: ${d.subject}\n\n${d.body}` : d.body} />
                    </>
                  }
                >
                  {hidden}
                  <input type="hidden" name="draftId" value={d.id} />
                  {d.channel === "email" && <label className="field"><span>Subject</span><input name="subject" maxLength={200} defaultValue={d.subject} /></label>}
                  <label className="field"><span>Message</span><textarea name="body" rows={d.channel === "email" ? 10 : 5} maxLength={5000} defaultValue={d.body} /></label>
                </ActionForm>
                <ActionForm action={deleteDraft} submitLabel="Delete draft" pendingLabel="Deleting…" buttonClassName="mt-2 text-sm text-muted underline underline-offset-4" confirmMessage="Delete this draft?" className="flex flex-col gap-2">
                  {hidden}
                  <input type="hidden" name="draftId" value={d.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
