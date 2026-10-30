// Writing rules for outreach drafts and a plain check against them. The rules
// are adapted from Harvey (github.com/ethanplusai/harvey, MIT licence, see
// THIRD_PARTY_NOTICES.md). The check is deterministic: no AI, no network.

// Phrases that make a message read like a template or a marketer.
export const CLICHE_PHRASES = [
  "picture this", "here's what i keep seeing", "imagine if", "what if i told you", "in today's fast-paced world",
  "game-changer", "game changer", "unlock", "supercharge", "elevate", "seamless", "leverage", "delve",
  "navigate the landscape", "worth a quick look", "worth a quick chat", "worth a quick call", "i'd love to",
  "just wanted to", "reaching out because", "just following up", "just checking in", "hope this finds you well",
  "hope you're doing well", "i know you're busy", "no pressure", "no obligation", "quick question",
  "transform your business", "a whole new level", "great question",
] as const;

// Words and phrases that push email into spam folders.
export const SPAM_PHRASES = [
  "free", "guarantee", "guaranteed", "risk-free", "no risk", "no cost", "act now", "limited time", "limited offer",
  "exclusive deal", "special offer", "discount", "% off", "save big", "winner", "congratulations", "urgent",
  "don't miss", "last chance", "buy now", "click here", "click below", "sign up now", "make money",
  "increase sales", "double your", "100%", "$$$",
] as const;

export type Channel = "email" | "social" | "whatsapp";

// Word limits for the message body, signature included. A first email reads
// best under about 75 words; the extra room covers the greeting and sign-off.
export const WORD_LIMITS: Record<Channel, number> = { email: 90, social: 60, whatsapp: 60 };

export type DraftIssue = { rule: string; message: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalise = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'");

function findPhrases(text: string, phrases: readonly string[]): string[] {
  const t = normalise(text);
  return phrases.filter((p) => {
    const edge = (c: string) => (/\w/.test(c) ? "\\b" : "");
    return new RegExp(`${edge(p[0])}${escape(p)}${edge(p[p.length - 1])}`).test(t);
  });
}

const quoteList = (items: string[]) => items.map((i) => `"${i}"`).join(", ");

// The first sentence after an optional "Hi Ada," greeting line.
function opening(body: string): string {
  const lines = body.trim().split(/\n+/);
  const rest = /^(hi|hello|hey|dear)\b[^\n]{0,60},$/i.test(lines[0]?.trim() ?? "") ? lines.slice(1) : lines;
  return rest.join(" ").trim();
}

export function checkDraft(draft: { subject: string; body: string }, channel: Channel): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const add = (rule: string, message: string) => issues.push({ rule, message });
  const subject = channel === "email" ? draft.subject.trim() : "";
  const body = draft.body.trim();
  const all = `${subject}\n${body}`;

  if (/[—–]/.test(all)) add("dash", "Swap the long dash for a full stop or comma. It's a common sign of AI writing.");
  if (/!/.test(all)) add("exclamation", "Drop the exclamation mark. Calm reads as confident.");
  if ((body.match(/\?/g) ?? []).length > 1) add("one_question", "Ask one question only, so it's easy to reply.");

  const cliches = findPhrases(all, CLICHE_PHRASES);
  if (cliches.length) add("cliche", `Reword ${quoteList(cliches)}. It sounds like a template.`);
  const spam = findPhrases(all, SPAM_PHRASES);
  if (spam.length && channel === "email") add("spam_words", `Avoid ${quoteList(spam)}. Spam filters watch for it.`);

  const shouty = all.match(/\b[A-Z]{5,}\b/g);
  if (shouty) add("caps", `Write ${quoteList([...new Set(shouty)])} in normal case. Capitals read as shouting.`);

  if (/^(i|we)\b/i.test(opening(body))) add("starts_with_me", "Open with them, not \"I\" or \"We\".");

  const words = body.split(/\s+/).filter(Boolean).length;
  if (words > WORD_LIMITS[channel]) add("length", `Cut it to under ${WORD_LIMITS[channel]} words (now ${words}). Short messages get replies.`);

  if (channel === "email") {
    if (/https?:\/\/|www\./i.test(body)) add("link", "Leave links out of a first email. They often send it to spam.");
    if (/^(re|fwd?):/i.test(subject)) add("fake_reply", "Don't start the subject with \"Re:\" or \"Fwd:\" when there was no earlier email.");
    if (subject && subject.split(/\s+/).length > 6) add("subject_length", "Keep the subject to a few words.");
  }
  return issues;
}

// The rules written out for an AI writer, so it is held to the same standard
// the check above applies afterwards.
export const WRITING_RULES = `Rules for every message:
1. Never use long dashes. Use full stops or commas.
2. Never use these phrases: ${CLICHE_PHRASES.map((p) => `"${p}"`).join(", ")}.
3. Make one point per message. No lists of features, no before-and-after comparisons.
4. Plain text only. No bullet points, bold, italics or emoji.
5. Do not start the message (after the greeting) with "I" or "We". Start with them.
6. No exclamation marks. No words in capitals.
7. Exactly one question or call to action. Not two, not zero.
8. Email body under 75 words before the sign-off. Social and WhatsApp messages under 50 words.
9. Email subjects: lowercase, 2 to 5 words, no person's name, never "quick question", never a fake "Re:" or "Fwd:".
10. Write like a busy person typing, not a marketer. Mix short and longer sentences. Straight quotes only.
11. Cut "not X, but Y" contrasts, dramatic one-line closers, staged run-ups like "Here's the thing", forced groups of three, and "-ing" riders such as ", helping you grow".
12. Avoid spam-filter words in emails: ${SPAM_PHRASES.map((p) => `"${p}"`).join(", ")}.
13. No links in a first email.`;
