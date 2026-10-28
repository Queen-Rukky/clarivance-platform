import { listActivity, listMembers } from "@/lib/data";
import { formatActivity } from "@/lib/activity";

export const metadata = { title: "Activity · Clarivance" };

export default async function ActivityPage({ params }: PageProps<"/b/[businessId]/activity">) {
  const { businessId } = await params;
  const [members, activity] = await Promise.all([listMembers(businessId), listActivity(businessId, 100)]);
  const emailById = new Map(members.map((m) => [m.user_id, m.email]));

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="page-title">Activity</h1>
        <p className="text-muted">A permanent record of important actions by your team and, later, by the AI agent. It can&apos;t be edited.</p>
      </div>
      {activity.length === 0 ? (
        <p className="card text-muted">No activity yet.</p>
      ) : (
        <ol className="card flex flex-col divide-y divide-line p-0">
          {activity.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <span className="min-w-0 break-words">{formatActivity(a, emailById)}</span>
              <time className="shrink-0 text-xs text-muted" dateTime={a.created_at}>
                {new Date(a.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}
              </time>
            </li>
          ))}
        </ol>
      )}
      {activity.length === 100 && <p className="text-sm text-muted">Showing the latest 100 entries.</p>}
    </>
  );
}
