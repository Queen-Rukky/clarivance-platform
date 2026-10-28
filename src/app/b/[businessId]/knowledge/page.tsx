import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { requireUser } from "@/lib/auth";
import { getBusiness, getKnowledgeBase, type Faq, type Service } from "@/lib/data";
import { formatPrice } from "@/lib/pricing";
import { canEditBusiness } from "@/lib/roles";
import {
  deleteFaq,
  deleteService,
  saveFaq,
  saveProfile,
  saveService,
  setFaqStatus,
  setServiceStatus,
} from "./actions";

export const metadata = { title: "Knowledge base · Clarivance" };

const PRICE_TYPE_LABELS = {
  fixed: "Fixed price",
  from: "Starting from",
  range: "Price range",
  ask_owner: "Ask the owner (agent never quotes a price)",
} as const;

function StatusPill({ status }: { status: "draft" | "approved" }) {
  return <span className="pill">{status === "approved" ? "Approved" : "Draft (agent can't use)"}</span>;
}

function ServiceFields({ service }: { service?: Service }) {
  return (
    <>
      <label className="field">
        <span>Service name</span>
        <input name="name" required minLength={2} maxLength={120} defaultValue={service?.name} />
      </label>
      <label className="field">
        <span>What it includes</span>
        <textarea name="description" rows={3} maxLength={2000} defaultValue={service?.description} />
      </label>
      <label className="field">
        <span>How is it priced?</span>
        <select name="price_type" className="select" defaultValue={service?.price_type ?? "ask_owner"}>
          {Object.entries(PRICE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="field">
          <span>Price, or starting price</span>
          <input name="price_min" inputMode="decimal" defaultValue={service?.price_min ?? ""} placeholder="e.g. 50000" />
        </label>
        <label className="field">
          <span>Top price (ranges only)</span>
          <input name="price_max" inputMode="decimal" defaultValue={service?.price_max ?? ""} />
        </label>
        <label className="field">
          <span>Currency</span>
          <input name="currency" maxLength={3} defaultValue={service?.currency ?? "NGN"} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="approved" defaultChecked={service?.status === "approved"} />
        Approved: the AI agent may share this service and price with customers
      </label>
    </>
  );
}

function FaqFields({ faq }: { faq?: Faq }) {
  return (
    <>
      <label className="field">
        <span>Question customers ask</span>
        <input name="question" required minLength={3} maxLength={300} defaultValue={faq?.question} />
      </label>
      <label className="field">
        <span>Approved answer</span>
        <textarea name="answer" rows={3} required maxLength={4000} defaultValue={faq?.answer} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="approved" defaultChecked={faq?.status === "approved"} />
        Approved: the AI agent may use this answer
      </label>
    </>
  );
}

function ItemControls({
  businessId,
  id,
  status,
  setStatus,
  remove,
}: {
  businessId: string;
  id: string;
  status: "draft" | "approved";
  setStatus: typeof setServiceStatus;
  remove: typeof deleteService;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <ActionForm
        action={setStatus}
        submitLabel={status === "approved" ? "Move to draft" : "Approve"}
        buttonClassName={status === "approved" ? "btn btn-ghost" : "btn btn-primary"}
        className="flex flex-col gap-2"
      >
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value={status === "approved" ? "draft" : "approved"} />
      </ActionForm>
      <ActionForm action={remove} submitLabel="Delete" pendingLabel="Deleting…" buttonClassName="btn btn-danger" className="flex flex-col gap-2">
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="id" value={id} />
      </ActionForm>
    </div>
  );
}

export default async function KnowledgePage({ params }: PageProps<"/b/[businessId]/knowledge">) {
  const { businessId } = await params;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) notFound();

  const business = await getBusiness(businessId, user.id);
  if (!business) notFound();

  const { profile, services, faqs } = await getKnowledgeBase(businessId);
  const edit = canEditBusiness(business.myRole);
  const approvedCount = services.filter((s) => s.status === "approved").length + faqs.filter((f) => f.status === "approved").length;

  return (
    <>
        <div className="flex flex-col gap-1">
          <h1 className="page-title">Knowledge base</h1>
          <p className="text-sm text-muted">
            Your AI agent will only use what you approve here. If a customer asks something that isn&apos;t covered, it will
            say it needs to check with you instead of guessing. {approvedCount} approved item{approvedCount === 1 ? "" : "s"} so far.
          </p>
          {!edit && <p className="notice notice-info">Only owners and admins can change the knowledge base.</p>}
        </div>

        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Business profile</h2>
          {edit ? (
            <ActionForm action={saveProfile} submitLabel="Save profile">
              <input type="hidden" name="businessId" value={business.id} />
              <label className="field">
                <span>About the business</span>
                <textarea name="about" rows={4} maxLength={4000} defaultValue={profile.about} placeholder="What you do, who you help, what makes you different." />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="field">
                  <span>Location</span>
                  <input name="location" maxLength={300} defaultValue={profile.location} />
                </label>
                <label className="field">
                  <span>Opening hours</span>
                  <input name="opening_hours" maxLength={500} defaultValue={profile.opening_hours} placeholder="Mon–Fri 9am–5pm" />
                </label>
                <label className="field">
                  <span>Contact email</span>
                  <input name="contact_email" type="email" maxLength={200} defaultValue={profile.contact_email} />
                </label>
                <label className="field">
                  <span>Contact phone</span>
                  <input name="contact_phone" type="tel" maxLength={50} defaultValue={profile.contact_phone} />
                </label>
              </div>
              <label className="field">
                <span>How should the agent sound?</span>
                <input name="tone" maxLength={500} defaultValue={profile.tone} placeholder="Warm and professional, short replies" />
              </label>
            </ActionForm>
          ) : (
            <dl className="grid gap-2 text-sm">
              {Object.entries(profile).map(([k, v]) => v && (
                <div key={k}><dt className="text-muted">{k.replace("_", " ")}</dt><dd className="whitespace-pre-wrap">{v}</dd></div>
              ))}
            </dl>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Services and prices</h2>
          {services.length === 0 && <p className="text-muted">No services yet.</p>}
          <ul className="flex flex-col gap-2">
            {services.map((s) => (
              <li key={s.id} className="card flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{s.name}</p>
                    <p className="text-sm text-muted">{formatPrice(s)}</p>
                  </div>
                  <StatusPill status={s.status} />
                </div>
                {s.description && <p className="text-sm whitespace-pre-wrap">{s.description}</p>}
                {edit && (
                  <>
                    <ItemControls businessId={business.id} id={s.id} status={s.status} setStatus={setServiceStatus} remove={deleteService} />
                    <details>
                      <summary className="cursor-pointer text-sm text-muted">Edit</summary>
                      <ActionForm action={saveService} submitLabel="Save service" className="mt-3 flex flex-col gap-3">
                        <input type="hidden" name="businessId" value={business.id} />
                        <input type="hidden" name="id" value={s.id} />
                        <ServiceFields service={s} />
                      </ActionForm>
                    </details>
                  </>
                )}
              </li>
            ))}
          </ul>
          {edit && (
            <div className="card flex flex-col gap-3">
              <h3 className="font-semibold">Add a service</h3>
              <ActionForm action={saveService} submitLabel="Add service" pendingLabel="Adding…">
                <input type="hidden" name="businessId" value={business.id} />
                <ServiceFields />
              </ActionForm>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Questions and answers</h2>
          {faqs.length === 0 && <p className="text-muted">No answers yet. Add the questions customers ask most.</p>}
          <ul className="flex flex-col gap-2">
            {faqs.map((f) => (
              <li key={f.id} className="card flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 font-medium break-words">{f.question}</p>
                  <StatusPill status={f.status} />
                </div>
                <p className="text-sm whitespace-pre-wrap">{f.answer}</p>
                {edit && (
                  <>
                    <ItemControls businessId={business.id} id={f.id} status={f.status} setStatus={setFaqStatus} remove={deleteFaq} />
                    <details>
                      <summary className="cursor-pointer text-sm text-muted">Edit</summary>
                      <ActionForm action={saveFaq} submitLabel="Save answer" className="mt-3 flex flex-col gap-3">
                        <input type="hidden" name="businessId" value={business.id} />
                        <input type="hidden" name="id" value={f.id} />
                        <FaqFields faq={f} />
                      </ActionForm>
                    </details>
                  </>
                )}
              </li>
            ))}
          </ul>
          {edit && (
            <div className="card flex flex-col gap-3">
              <h3 className="font-semibold">Add a question and answer</h3>
              <ActionForm action={saveFaq} submitLabel="Add answer" pendingLabel="Adding…">
                <input type="hidden" name="businessId" value={business.id} />
                <FaqFields />
              </ActionForm>
            </div>
          )}
        </section>
    </>
  );
}
