import { LegalPage } from "@/components/marketing/legal-page";

export const metadata = { title: "Privacy · Clarivance" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="29 October 2026">
      <p>This page explains, in plain words, what Clarivance stores and why.</p>
      <h2>What we store</h2>
      <ul>
        <li>Your account: email address and a securely hashed password, handled by our authentication provider (Supabase).</li>
        <li>Your business workspace: business details, setup answers, knowledge base, team members and their roles.</li>
        <li>Leads you add: the contact and enquiry details you enter, notes, stages and follow-ups.</li>
        <li>An activity log of important actions, kept so you can see who changed what.</li>
      </ul>
      <h2>Who can see it</h2>
      <p>Only members of your business. Database rules keep each business&apos;s data separate. Clarivance staff access data only to provide support you ask for or to keep the service secure.</p>
      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your data or your leads&apos; data.</li>
        <li>We don&apos;t contact your leads. Messages are drafted for you to send yourself.</li>
        <li>We don&apos;t buy or scrape contact lists.</li>
      </ul>
      <h2>Your leads&apos; data</h2>
      <p>You are responsible for having a lawful reason to store your leads&apos; details, for example because they contacted you. Store only what you need.</p>
      <h2>Keeping and deleting data</h2>
      <p>Data is kept while your workspace exists. You can delete any lead at any time, download your leads as CSV, and an owner can permanently delete the whole business from Settings.</p>
      <h2>Service providers</h2>
      <p>Supabase (database and sign-in) and Netlify (website hosting). When the AI agent launches, the messages it handles will be processed by our AI provider; this page will be updated before that happens.</p>
    </LegalPage>
  );
}
