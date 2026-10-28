// Plain-English lines for the activity log.
type Entry = {
  action: string;
  actor_user_id: string | null;
  actor_agent: string | null;
  details: Record<string, unknown> | null;
};

export function formatActivity(entry: Entry, emailById: Map<string, string>): string {
  const actor = entry.actor_agent
    ? `AI agent (${entry.actor_agent})`
    : (entry.actor_user_id && emailById.get(entry.actor_user_id)) || "A former member";
  const d = entry.details ?? {};
  const str = (key: string) => (typeof d[key] === "string" ? (d[key] as string) : "");

  switch (entry.action) {
    case "business.created":
      return `${actor} created the business${str("name") ? ` “${str("name")}”` : ""}`;
    case "business.renamed":
      return `${actor} renamed the business to “${str("name")}”`;
    case "member.added":
      return `${actor} added a ${str("role") || "new"} member`;
    case "member.role_changed":
      return `${actor} changed a member's role from ${str("from")} to ${str("to")}`;
    case "member.removed":
      return `${actor} removed a ${str("role") || ""} member`.replace("  ", " ");
    case "member.invited":
      return `${actor} invited someone to join as ${str("role") || "a member"}`;
    case "member.invite_cancelled":
      return `${actor} cancelled an invite`;
    case "member.joined":
      return `${actor} joined from an invite as ${str("role") || "a member"}`;
    case "profile.created":
    case "profile.updated":
      return `${actor} updated the business profile`;
    default: {
      const kb = /^(service|knowledge)\.(created|updated|deleted|approved|unapproved)$/.exec(entry.action);
      if (kb) {
        const what = kb[1] === "service" ? "service" : "FAQ";
        const verb = { created: "added", updated: "edited", deleted: "deleted", approved: "approved", unapproved: "unapproved" }[kb[2]];
        return `${actor} ${verb} the ${what}${str("label") ? ` “${str("label")}”` : ""}`;
      }
      return `${actor}: ${entry.action}`;
    }
      return `${actor}: ${entry.action}`;
  }
}
