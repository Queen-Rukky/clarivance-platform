import { LegalPage } from "@/components/marketing/legal-page";

export const metadata = { title: "Terms · Clarivance" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="29 October 2026">
      <p>Clarivance is in a pilot. By using it you agree to these short terms.</p>
      <h2>The service</h2>
      <ul>
        <li>Features described as &quot;coming next&quot; are not yet available and may change.</li>
        <li>We work to keep the service running and your data safe, but during the pilot we can&apos;t promise uninterrupted availability. Export anything important regularly.</li>
      </ul>
      <h2>Your responsibilities</h2>
      <ul>
        <li>Keep your password private and tell us about any unauthorised access.</li>
        <li>Only add people&apos;s details where you have a lawful reason, and follow the rules on marketing messages where you operate.</li>
        <li>Review and approve any message before you send it. You are responsible for what you send.</li>
      </ul>
      <h2>Trials, plans and cancelling</h2>
      <ul>
        <li>The free trial lasts 14 days and needs no card.</li>
        <li>Online payment isn&apos;t live yet. Paid pilot plans are invoiced directly, and you can cancel by telling us before the next billing date.</li>
        <li>You can delete your business and its data at any time from Settings.</li>
      </ul>
    </LegalPage>
  );
}
