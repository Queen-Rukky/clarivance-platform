import { LEAD_STATUSES, MANUAL_SOURCES, SOURCE_LABELS, STATUS_LABELS, type Lead } from "@/lib/leads";

// The lead form, shared by "Add lead" and the lead profile.
export function LeadFields({ lead, withSource = false }: { lead?: Lead; withSource?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Who</legend>
        <label className="field"><span>Contact name</span><input name="contact_name" maxLength={200} defaultValue={lead?.contact_name} autoComplete="off" /></label>
        <label className="field"><span>Their role</span><input name="contact_role" maxLength={200} defaultValue={lead?.contact_role} placeholder="e.g. Practice manager" /></label>
        <label className="field"><span>Company</span><input name="company" maxLength={200} defaultValue={lead?.company} /></label>
        <label className="field"><span>Website</span><input name="website" maxLength={300} inputMode="url" defaultValue={lead?.website} placeholder="https://" /></label>
        <label className="field"><span>Email</span><input name="email" type="email" maxLength={200} inputMode="email" defaultValue={lead?.email} autoComplete="off" /></label>
        <label className="field"><span>Phone</span><input name="phone" type="tel" maxLength={50} defaultValue={lead?.phone} autoComplete="off" /></label>
        <label className="field"><span>Industry</span><input name="industry" maxLength={120} defaultValue={lead?.industry} /></label>
        <label className="field"><span>Location</span><input name="location" maxLength={200} defaultValue={lead?.location} /></label>
        <p className="text-xs text-muted sm:col-span-2">Add at least a name, company, email or phone number. Only record contact details the person gave you or published for business use.</p>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Where they came from</legend>
        {withSource && (
          <label className="field">
            <span>Source</span>
            <select name="source" className="select" defaultValue="manual">
              {MANUAL_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
            </select>
          </label>
        )}
        <label className={`field ${withSource ? "" : "sm:col-span-2"}`}><span>Source details or link to evidence</span><input name="source_detail" maxLength={500} defaultValue={lead?.source_detail} placeholder="e.g. referred by Ada, or a link to their enquiry" /></label>
        <label className="field sm:col-span-2"><span>What they asked for</span><textarea name="enquiry" rows={3} maxLength={4000} defaultValue={lead?.enquiry} /></label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold">Pipeline</legend>
        <label className="field">
          <span>Stage</span>
          <select name="status" className="select" defaultValue={lead?.status ?? "new"}>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="field"><span>Score (0–100)</span><input name="score" type="number" min={0} max={100} step={1} inputMode="numeric" defaultValue={lead?.score ?? ""} placeholder="Leave blank if unsure" /></label>
        <label className="field sm:col-span-2"><span>Why this score?</span><textarea name="score_reason" rows={2} maxLength={2000} defaultValue={lead?.score_reason} placeholder="e.g. owner asked for a quote and wants to start this month" /></label>
        <label className="field"><span>Next action</span><input name="next_action" maxLength={500} defaultValue={lead?.next_action} placeholder="e.g. Send proposal" /></label>
        <label className="field"><span>Follow-up date</span><input name="follow_up_on" type="date" defaultValue={lead?.follow_up_on ?? ""} /></label>
        <label className="field sm:col-span-2"><span>Notes</span><textarea name="notes" rows={4} maxLength={8000} defaultValue={lead?.notes} /></label>
      </fieldset>
    </div>
  );
}
