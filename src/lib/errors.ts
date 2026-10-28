// Turns database errors into messages that are safe to show. Messages raised
// on purpose by our SQL functions are shown as written; anything else becomes
// a generic message so internal details never reach the browser.
const KNOWN_MESSAGES = [
  "not authenticated",
  "not allowed",
  "invalid role",
  "only an owner can add another owner",
  "only an owner can change owner roles",
  "only an owner can remove an owner",
  "a business must keep at least one owner",
  "already a member",
  "not a member",
];

export type DbError = { message?: string; code?: string } | null | undefined;

export function friendlyDbError(error: DbError, fallback = "Something went wrong. Please try again."): string {
  const message = error?.message?.trim();
  if (!message) return fallback;
  if (KNOWN_MESSAGES.includes(message)) {
    if (message === "not allowed") return "You don't have permission to do that.";
    if (message === "not authenticated") return "Please sign in again.";
    return message.charAt(0).toUpperCase() + message.slice(1) + ".";
  }
  if (error?.code === "PGRST106" || /schema must be one of/i.test(message)) {
    return "The app's database schema isn't exposed yet. Add 'clarivance' under Supabase → Data API → Exposed schemas.";
  }
  return fallback;
}

export type ActionState = { error?: string; ok?: string };
