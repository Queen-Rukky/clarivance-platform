import Link from "next/link";
import { MissedRevenueCalculator } from "@/components/marketing/missed-revenue-calculator";
import { PLANS } from "@/lib/plans";

export const metadata = {
  title: "Clarivance · Every enquiry answered, every lead followed up",
  description:
    "Clarivance helps small businesses capture every enquiry, keep a clear lead pipeline and follow up on time, with an AI agent that answers only from facts you approve.",
};

const AVAILABLE = [
  ["Lead pipeline", "Seven clear stages from New to Won, with scores, notes, next actions and follow-up dates."],
  ["Search, filters and CSV export", "Find any lead by name, stage, source, score, industry or place, and export what you need."],
  ["Duplicate warnings", "Spot the same person or company entered twice, by email, phone, website or name."],
  ["Outreach drafts with approval", "Draft emails and messages from the facts on the record. Nothing is sent without you."],
  ["Knowledge base", "Your services, prices and answers, each approved by you before the AI may use it."],
  ["Team roles and activity log", "Owners, admins and staff, with a permanent record of who changed what."],
] as const;

const COMING = [
  ["AI chat on your website", "Answers enquiries in seconds from your approved knowledge base, and hands anything else to you."],
  ["WhatsApp", "The same agent on your business number, after Meta verifies your business."],
  ["Daily summary", "A short morning email with new leads and follow-ups due."],
] as const;

const FAQ = [
  ["Does the AI make up prices or promises?", "No. It may only use services, prices and answers you have marked as approved. If something isn't covered, it says it will check with you. Services set to \"ask the owner\" have no price stored, so there is nothing for it to quote."],
  ["Is the AI chat live today?", "Not yet. The pipeline, knowledge base, team, drafts and export work today. The website chat is the next feature being built, and we'll tell trial users when it's ready."],
  ["Does Clarivance send messages for me?", "No. It drafts messages for you to edit and approve. You send them from your own email or WhatsApp. We never contact your leads."],
  ["Where do leads come from?", "From you (added by hand or from your enquiries) and, once the chat is live, from your website and WhatsApp. Clarivance doesn't buy or scrape contact lists."],
  ["Who can see my data?", "Only people you add to your business. Each business's data is kept separate by rules in the database itself, and we don't sell data."],
  ["How do I pay?", "Online payment isn't switched on yet. During the pilot, founding customers are invoiced directly. Your free trial needs no card."],
  ["Can I leave and take my data?", "Yes. Download your leads as CSV at any time, and an owner can permanently delete the business and everything in it from Settings."],
] as const;

export default function Home() {
  const contact = process.env.CONTACT_EMAIL;
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold"><span aria-hidden className="logo-mark">C</span>Clarivance</Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
            <a href="#how" className="hidden px-2 text-sm text-muted hover:text-foreground sm:inline">How it works</a>
            <a href="#pricing" className="hidden px-2 text-sm text-muted hover:text-foreground sm:inline">Pricing</a>
            <a href="#faq" className="hidden px-2 text-sm text-muted hover:text-foreground md:inline">FAQ</a>
            <Link href="/login" className="btn btn-ghost">Sign in</Link>
            <Link href="/login?mode=signup" className="btn btn-primary hidden sm:inline-flex">Start free trial</Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1.1fr_1fr] md:py-20">
          <div className="flex flex-col gap-5">
            <p className="eyebrow">For clinics, estate agents, schools and service businesses</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Every enquiry answered. Every lead followed up.</h1>
            <p className="text-lg text-muted">
              Clarivance keeps every enquiry in one clear pipeline, reminds your team who to follow up today, and drafts the
              message for you to approve. Its AI agent, coming next, answers customers only from facts you&apos;ve approved.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/login?mode=signup" className="btn btn-primary">Start your 14-day free trial</Link>
              <a href="#calculator" className="btn btn-ghost">Work out what slow replies cost you</a>
            </div>
            <p className="text-sm text-muted">No card needed. Try it with sample data in one click.</p>
          </div>
          <ProductPreview />
        </section>

        <section id="calculator" className="border-y border-line bg-surface/50 scroll-mt-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14">
            <div className="flex max-w-2xl flex-col gap-2">
              <p className="eyebrow">Try it</p>
              <h2 className="text-3xl font-semibold tracking-tight">What are slow replies costing you?</h2>
              <p className="text-muted">Put in your own numbers. Nothing is saved or sent anywhere.</p>
            </div>
            <MissedRevenueCalculator />
          </div>
        </section>

        <section id="how" className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14 scroll-mt-16">
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="eyebrow">How it works</p>
            <h2 className="text-3xl font-semibold tracking-tight">Set up in an afternoon, then never lose track of a lead</h2>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              ["Tell Clarivance about your business", "A six-question setup, then add your services, prices and common answers. You approve each one."],
              ["Capture every enquiry", "Add leads as they arrive. Soon, your website chat and WhatsApp will add them for you."],
              ["Follow up on time", "Each lead has a stage, a score with a reason, a next action and a date. The overview shows what's due."],
            ].map(([t, d], i) => (
              <li key={t} className="card flex flex-col gap-2">
                <span className="logo-mark" aria-hidden>{i + 1}</span>
                <h3 className="font-semibold">{t}</h3>
                <p className="text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-14">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">Available today</h2>
              <ul className="flex flex-col gap-3">
                {AVAILABLE.map(([t, d]) => (
                  <li key={t} className="flex gap-3"><span aria-hidden className="mt-1 text-[var(--ok)]">✓</span><span><strong className="font-semibold">{t}.</strong> <span className="text-muted">{d}</span></span></li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold tracking-tight">Coming next</h2>
              <ul className="flex flex-col gap-3">
                {COMING.map(([t, d]) => (
                  <li key={t} className="flex gap-3"><span aria-hidden className="mt-1 text-muted">○</span><span><strong className="font-semibold">{t}.</strong> <span className="text-muted">{d}</span></span></li>
                ))}
              </ul>
              <p className="text-sm text-muted">We list a feature as available only once it works end to end.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-line bg-surface/50 scroll-mt-16">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-14">
            <div className="flex max-w-2xl flex-col gap-2">
              <p className="eyebrow">Pricing</p>
              <h2 className="text-3xl font-semibold tracking-tight">Simple monthly plans</h2>
              <p className="text-muted">Start with a free 14-day trial. Online payment is not live yet; founding customers are invoiced directly.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(["trial", "starter", "growth"] as const).map((p) => (
                <div key={p} className={`card flex flex-col gap-3 ${p === "growth" ? "border-[var(--accent)]" : ""}`}>
                  {p === "growth" && <span className="tag self-start">Most businesses</span>}
                  <h3 className="font-semibold">{PLANS[p].name}</h3>
                  <p className="text-2xl font-semibold">{PLANS[p].price}</p>
                  <p className="text-sm text-muted">{PLANS[p].summary}</p>
                  <p className="text-sm">Up to {PLANS[p].leads.toLocaleString()} leads</p>
                  <Link href="/login?mode=signup" className={`btn mt-auto ${p === "growth" ? "btn-primary" : "btn-ghost"}`}>Start free trial</Link>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted">Done-for-you setup: $300 one-off. We write your knowledge base, set up your pipeline and train your team. Prices in USD; local-currency invoices on request.</p>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
          <div className="flex flex-col gap-2 md:col-span-1">
            <p className="eyebrow">Trust</p>
            <h2 className="text-3xl font-semibold tracking-tight">Built to be careful with your customers</h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 md:col-span-2">
            {[
              ["Approved facts only", "The AI can only use services, prices and answers you approve. Drafts stay drafts until you say otherwise."],
              ["You stay in control", "Nothing is sent to a customer without your approval, and every action is logged."],
              ["Your data is separate", "Database rules stop one business from ever seeing another's data. Team roles limit who can change what."],
              ["No invented data", "We don't scrape or buy contact lists, invent leads or fake verification. Sample records are always labelled."],
            ].map(([t, d]) => (
              <li key={t} className="card flex flex-col gap-1"><h3 className="font-semibold">{t}</h3><p className="text-sm text-muted">{d}</p></li>
            ))}
          </ul>
        </section>

        <section id="faq" className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-16 scroll-mt-16">
          <h2 className="text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                  {q}<span aria-hidden className="text-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="pt-2 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto mb-16 flex max-w-6xl flex-col items-start gap-4 rounded-2xl px-6 py-10 md:items-center md:text-center" style={{ background: "var(--accent-soft)" }}>
          <h2 className="text-3xl font-semibold tracking-tight">Stop losing customers to slow replies</h2>
          <p className="max-w-xl text-muted">Set up your pipeline today and be first in line for the AI chat.</p>
          <Link href="/login?mode=signup" className="btn btn-primary">Start your free trial</Link>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Clarivance</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            {contact && <a href={`mailto:${contact}`} className="hover:text-foreground">Contact</a>}
            <Link href="/login" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

// A static picture of the pipeline using fictional names, labelled as such.
function ProductPreview() {
  const rows = [
    ["Sample Dental Clinic", "Qualified", 78, "Send proposal"],
    ["Sample Realty", "Contacted", 64, "Follow up on price"],
    ["Sample Tutorial Centre", "Meeting booked", 85, "Prepare demo"],
    ["Sample Events Co", "New", null, "Qualify enquiry"],
  ] as const;
  return (
    <figure className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm font-semibold">Leads</span>
          <span className="tag tag-sample">Sample data</span>
        </div>
        <div className="grid grid-cols-3 gap-2 border-b border-line p-4">
          {[["Leads", "6"], ["Meetings", "1"], ["Due today", "1"]].map(([l, v]) => (
            <div key={l} className="rounded-lg border border-line p-2"><p className="text-lg font-semibold">{v}</p><p className="text-xs text-muted">{l}</p></div>
          ))}
        </div>
        <ul className="divide-y divide-line">
          {rows.map(([n, s, sc, a]) => (
            <li key={n} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0"><span className="block truncate font-medium">{n}</span><span className="block truncate text-xs text-muted">{a}</span></span>
              <span className="flex shrink-0 items-center gap-2"><span className="tag">{s}</span><span className="w-6 text-right tabular-nums text-muted">{sc ?? "–"}</span></span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-xs text-muted">Product preview with fictional sample records.</figcaption>
    </figure>
  );
}
