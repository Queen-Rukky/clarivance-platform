import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { requireUser } from "@/lib/auth";
import { getBusiness, listActivity, listInvites, listMembers } from "@/lib/data";
import { formatActivity } from "@/lib/activity";
import { assignableRoles, canEditBusiness, canManageMembers } from "@/lib/roles";
import { addMember, cancelInvite, changeRole, removeMember, renameBusiness } from "./actions";

export default async function BusinessPage({ params }: PageProps<"/b/[businessId]">) {
  const { businessId } = await params;
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) notFound();

  const business = await getBusiness(businessId, user.id);
  if (!business) notFound();

  const manage = canManageMembers(business.myRole);
  const [members, activity, invites] = await Promise.all([
    listMembers(businessId),
    listActivity(businessId),
    manage ? listInvites(businessId) : Promise.resolve([]),
  ]);
  const emailById = new Map(members.map((m) => [m.user_id, m.email]));
  const roles = assignableRoles(business.myRole);

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6">
        <div className="flex flex-col gap-1">
          <Link href="/dashboard" className="text-sm text-muted">← All businesses</Link>
          <h1 className="text-xl font-semibold break-words">{business.name}</h1>
          <p className="text-sm text-muted">Your role: {business.myRole ?? "none"}</p>
        </div>

        <Link href={`/b/${business.id}/knowledge`} className="card flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">Knowledge base</span>
            <span className="block text-sm text-muted">The approved facts, services and prices your AI agent may use.</span>
          </span>
          <span aria-hidden>→</span>
        </Link>

        {canEditBusiness(business.myRole) && (
          <section className="card flex flex-col gap-3">
            <h2 className="font-semibold">Business name</h2>
            <ActionForm action={renameBusiness} submitLabel="Save name">
              <input type="hidden" name="businessId" value={business.id} />
              <label className="field">
                <span>Name</span>
                <input name="name" defaultValue={business.name} required minLength={2} maxLength={120} />
              </label>
            </ActionForm>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Team</h2>
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.user_id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.email}{m.user_id === user.id ? " (you)" : ""}</p>
                  <p className="text-sm text-muted">{m.role}</p>
                </div>
                {manage && roles.length > 0 && (m.role !== "owner" || business.myRole === "owner") && (
                  <div className="flex flex-wrap items-start gap-2">
                    <ActionForm action={changeRole} submitLabel="Change" buttonClassName="btn btn-ghost" className="flex items-center gap-2">
                      <input type="hidden" name="businessId" value={business.id} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <select name="role" defaultValue={m.role} aria-label={`Role for ${m.email}`} className="select">
                        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </ActionForm>
                    <ActionForm action={removeMember} submitLabel="Remove" pendingLabel="Removing…" buttonClassName="btn btn-danger" className="flex items-center gap-2">
                      <input type="hidden" name="businessId" value={business.id} />
                      <input type="hidden" name="userId" value={m.user_id} />
                    </ActionForm>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {manage && invites.length > 0 && (
            <ul className="flex flex-col gap-2">
              {invites.map((i) => (
                <li key={i.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.email}</p>
                    <p className="text-sm text-muted">Invited as {i.role} · waiting for them to sign up</p>
                  </div>
                  <ActionForm action={cancelInvite} submitLabel="Cancel invite" pendingLabel="Cancelling…" buttonClassName="btn btn-ghost" className="flex items-center gap-2">
                    <input type="hidden" name="businessId" value={business.id} />
                    <input type="hidden" name="inviteId" value={i.id} />
                  </ActionForm>
                </li>
              ))}
            </ul>
          )}

          {manage && (
            <div className="card flex flex-col gap-3">
              <h3 className="font-semibold">Add a team member</h3>
              <p className="text-sm text-muted">
                If they don&apos;t have an account yet, we&apos;ll save an invite. They join as soon as they sign up with that email.
              </p>
              <ActionForm action={addMember} submitLabel="Add member" pendingLabel="Adding…">
                <input type="hidden" name="businessId" value={business.id} />
                <label className="field">
                  <span>Email</span>
                  <input name="email" type="email" required inputMode="email" />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select name="role" defaultValue="staff" className="select">
                    {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
              </ActionForm>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Activity</h2>
          {activity.length === 0 ? (
            <p className="text-muted">No activity yet.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-line rounded-xl border border-line">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3">
                  <span>{formatActivity(a, emailById)}</span>
                  <time className="text-xs text-muted" dateTime={a.created_at}>
                    {new Date(a.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
