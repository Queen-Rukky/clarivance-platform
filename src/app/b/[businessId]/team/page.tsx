import { ActionForm } from "@/components/action-form";
import { requireUser } from "@/lib/auth";
import { getBusiness, listInvites, listMembers } from "@/lib/data";
import { assignableRoles, canManageMembers } from "@/lib/roles";
import { addMember, cancelInvite, changeRole, removeMember } from "../actions";

export const metadata = { title: "Team · Clarivance" };

const ROLE_HELP = {
  owner: "Everything, including billing and deleting the business",
  admin: "Manage the team, knowledge base and settings",
  staff: "Work leads and read everything",
} as const;

export default async function TeamPage({ params }: PageProps<"/b/[businessId]/team">) {
  const { businessId } = await params;
  const user = await requireUser();
  const business = (await getBusiness(businessId, user.id))!;
  const manage = canManageMembers(business.myRole);
  const roles = assignableRoles(business.myRole);
  const [members, invites] = await Promise.all([listMembers(businessId), manage ? listInvites(businessId) : Promise.resolve([])]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="page-title">Team</h1>
        <p className="text-muted">Your role: {business.myRole}. {business.myRole && ROLE_HELP[business.myRole]}.</p>
      </div>

      <section className="card flex flex-col gap-1 p-0">
        <h2 className="px-4 pt-4 font-semibold">Members ({members.length})</h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.user_id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.email}{m.user_id === user.id ? " (you)" : ""}</p>
                <p className="text-sm text-muted capitalize">{m.role}</p>
              </div>
              {manage && roles.length > 0 && (m.role !== "owner" || business.myRole === "owner") && (
                <div className="flex flex-wrap items-start gap-2">
                  <ActionForm action={changeRole} submitLabel="Change role" buttonClassName="btn btn-ghost" className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="businessId" value={business.id} />
                    <input type="hidden" name="userId" value={m.user_id} />
                    <select name="role" defaultValue={m.role} aria-label={`Role for ${m.email}`} className="select w-auto">
                      {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </ActionForm>
                  <ActionForm
                    action={removeMember}
                    submitLabel={m.user_id === user.id ? "Leave" : "Remove"}
                    pendingLabel="Removing…"
                    buttonClassName="btn btn-danger"
                    className="flex items-center gap-2"
                    confirmMessage={m.user_id === user.id ? `Leave ${business.name}? You'll lose access.` : `Remove ${m.email} from ${business.name}?`}
                  >
                    <input type="hidden" name="businessId" value={business.id} />
                    <input type="hidden" name="userId" value={m.user_id} />
                  </ActionForm>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {manage && invites.length > 0 && (
        <section className="card flex flex-col gap-1 p-0">
          <h2 className="px-4 pt-4 font-semibold">Waiting to join ({invites.length})</h2>
          <ul className="divide-y divide-line">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.email}</p>
                  <p className="text-sm text-muted">Invited as {i.role}. They join when they sign up with this email.</p>
                </div>
                <ActionForm action={cancelInvite} submitLabel="Cancel invite" pendingLabel="Cancelling…" buttonClassName="btn btn-ghost" className="flex items-center gap-2" confirmMessage={`Cancel the invite for ${i.email}?`}>
                  <input type="hidden" name="businessId" value={business.id} />
                  <input type="hidden" name="inviteId" value={i.id} />
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      {manage && (
        <section className="card flex flex-col gap-3">
          <h2 className="font-semibold">Add a team member</h2>
          <p className="text-sm text-muted">
            If they don&apos;t have an account yet, we save an invite and they join as soon as they sign up with that email.
            Clarivance doesn&apos;t email them, so let them know.
          </p>
          <ActionForm action={addMember} submitLabel="Add member" pendingLabel="Adding…">
            <input type="hidden" name="businessId" value={business.id} />
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" required inputMode="email" autoComplete="off" />
              </label>
              <label className="field">
                <span>Role</span>
                <select name="role" defaultValue="staff" className="select">
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
            </div>
          </ActionForm>
        </section>
      )}
    </>
  );
}
