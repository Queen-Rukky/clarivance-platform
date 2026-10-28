import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { requireUser } from "@/lib/auth";
import { getBusiness, getProfile } from "@/lib/data";
import { CHANNEL_OPTIONS, COMPANY_SIZES, LEAD_SOURCE_OPTIONS, parseStep, SETUP_STEPS } from "@/lib/onboarding";
import { canEditBusiness } from "@/lib/roles";
import { finishSetup, saveSetupStep } from "./actions";

export const metadata = { title: "Setup · Clarivance" };

export default async function SetupPage({ params, searchParams }: PageProps<"/b/[businessId]/setup">) {
  const { businessId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const [business, profile] = await Promise.all([getBusiness(businessId, user.id), getProfile(businessId)]);
  const base = `/b/${businessId}`;
  const step = parseStep(sp.step);
  const edit = canEditBusiness(business!.myRole);

  if (sp.done === "1") {
    return (
      <div className="card flex flex-col items-start gap-3">
        <p className="eyebrow">Setup complete</p>
        <h1 className="page-title">You&apos;re ready</h1>
        <p className="text-muted">
          Your answers are saved. You can change them any time from Setup. Next, add the services and answers your AI agent
          may use, or start adding leads.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/leads/new`} className="btn btn-primary">Add your first lead</Link>
          <Link href={`${base}/knowledge`} className="btn btn-ghost">Fill in the knowledge base</Link>
        </div>
      </div>
    );
  }

  const info = SETUP_STEPS[step - 1];
  return (
    <>
      <div className="flex flex-col gap-1">
        <p className="eyebrow">Step {step} of 6</p>
        <h1 className="page-title">{info.title}</h1>
        <p className="text-muted">{info.help}</p>
      </div>

      <ol className="grid grid-cols-6 gap-1" aria-label="Setup progress">
        {SETUP_STEPS.map((s, i) => (
          <li key={s.title}>
            <Link
              href={`${base}/setup?step=${i + 1}`}
              aria-label={`Step ${i + 1}: ${s.title}${i + 1 === step ? " (current)" : ""}`}
              aria-current={i + 1 === step ? "step" : undefined}
              className="block h-2 rounded-full"
              style={{ background: i + 1 <= Math.max(step, profile.onboarding_step) ? "var(--accent)" : "var(--line)" }}
            />
          </li>
        ))}
      </ol>

      {!edit && <p className="notice notice-info">Only owners and admins can change setup. You can look through the answers.</p>}

      <section className="card">
        <ActionForm
          key={step}
          action={saveSetupStep}
          submitLabel={step === 6 ? "Finish setup" : "Save and continue"}
          footer={
            <>
              {step > 1 && <Link href={`${base}/setup?step=${step - 1}`} className="btn btn-ghost">Back</Link>}
              {step < 6 && <Link href={`${base}/setup?step=${step + 1}`} className="btn btn-ghost">Skip for now</Link>}
            </>
          }
        >
          <input type="hidden" name="businessId" value={businessId} />
          <input type="hidden" name="step" value={step} />
          <fieldset disabled={!edit} className="flex flex-col gap-3">
            <legend className="sr-only">{info.title}</legend>
            {step === 1 && (
              <>
                <label className="field"><span>Business name</span><input name="name" required minLength={2} maxLength={120} defaultValue={business!.name} /></label>
                <label className="field"><span>Website <em className="font-normal text-muted">(optional)</em></span><input name="website" type="url" inputMode="url" placeholder="https://" maxLength={300} defaultValue={profile.website} /></label>
              </>
            )}
            {step === 2 && (
              <label className="field">
                <span>What do you sell, and what result does it give customers?</span>
                <textarea name="offer" rows={4} maxLength={2000} defaultValue={profile.offer} placeholder="e.g. we set up an AI assistant that answers every WhatsApp enquiry in under a minute, so clinics stop losing patients to slow replies." />
              </label>
            )}
            {step === 3 && (
              <>
                <label className="field"><span>Industries</span><input name="ideal_industries" maxLength={500} defaultValue={profile.ideal_industries} placeholder="e.g. private clinics, real estate, schools" /></label>
                <label className="field"><span>Locations</span><input name="ideal_locations" maxLength={500} defaultValue={profile.ideal_locations} placeholder="e.g. Lagos, Abuja, UK" /></label>
              </>
            )}
            {step === 4 && (
              <>
                <label className="field">
                  <span>Typical company size</span>
                  <select name="company_size" className="select" defaultValue={profile.company_size}>
                    {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s || "Not sure yet"}</option>)}
                  </select>
                </label>
                <label className="field"><span>Who makes the buying decision?</span><input name="decision_maker" maxLength={200} defaultValue={profile.decision_maker} placeholder="e.g. clinic owner, practice manager" /></label>
              </>
            )}
            {step === 5 && (
              <>
                <CheckGroup name="lead_sources" legend="Where do enquiries come from?" options={LEAD_SOURCE_OPTIONS} selected={profile.lead_sources} />
                <CheckGroup name="contact_channels" legend="How do you prefer to contact leads?" options={CHANNEL_OPTIONS} selected={profile.contact_channels} />
              </>
            )}
            {step === 6 && (
              <>
                <label className="field"><span>Who should be ignored? <em className="font-normal text-muted">(optional)</em></span><textarea name="exclusions" rows={3} maxLength={1000} defaultValue={profile.exclusions} placeholder="e.g. students, job seekers, competitors" /></label>
                <label className="field"><span>What makes a lead qualified? <em className="font-normal text-muted">(optional)</em></span><textarea name="qualification_rules" rows={3} maxLength={1000} defaultValue={profile.qualification_rules} placeholder="e.g. has a budget over ₦200,000 and wants to start within 3 months" /></label>
              </>
            )}
          </fieldset>
        </ActionForm>
      </section>

      {edit && !profile.onboarding_completed_at && step < 6 && (
        <ActionForm action={finishSetup} submitLabel="Skip the rest and go to the dashboard" buttonClassName="text-sm text-muted underline underline-offset-4" className="flex flex-col items-start gap-2">
          <input type="hidden" name="businessId" value={businessId} />
        </ActionForm>
      )}
    </>
  );
}

function CheckGroup({ name, legend, options, selected }: { name: string; legend: string; options: string[]; selected: string[] }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-soft)]">
            <input type="checkbox" name={name} value={o} defaultChecked={selected.includes(o)} />
            {o}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
