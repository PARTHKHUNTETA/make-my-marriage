import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Support — Make My Marriage",
  description: "Answers to common questions, and how to reach us.",
};

export default function SupportPage() {
  return (
    <LegalPage
      title="Support"
      intro="Most questions have a quick answer below. If yours does not, write to us and we will help."
      updated={false}
    >
      <section>
        <h2>Write to us</h2>
        <p>
          Email <ContactLine />. Tell us the email address on your account and what you were trying
          to do; a screenshot helps. Please never send us your password.
        </p>
      </section>

      <section>
        <h2>Common questions</h2>
        <ul>
          <li>
            <strong>I forgot my password.</strong> Choose &ldquo;Forgot password?&rdquo; on the
            sign-in page. We send a link to your email address; it works once and expires.
          </li>
          <li>
            <strong>The confirmation email has not arrived.</strong> Check your spam folder, then
            use &ldquo;Resend email&rdquo; on the banner at the top of the app.
          </li>
          <li>
            <strong>My guests did not get their invitation.</strong> Check that the guest has an
            email address and has not unsubscribed. You can also copy their personal link and share
            it on WhatsApp: Guests, then Copy link.
          </li>
          <li>
            <strong>A guest cannot open their link.</strong> Links stop working if the wedding is
            deleted. Otherwise, copy the link again from the guest&rsquo;s page.
          </li>
          <li>
            <strong>Guests cannot upload photos.</strong> Open Photos, then Share and QR, and make
            sure guest uploads are switched on. If you replaced the link, reprint the QR code.
          </li>
          <li>
            <strong>I want to add someone to the team.</strong> An admin can invite them from
            Settings, then Members.
          </li>
          <li>
            <strong>I want to delete everything.</strong> An admin can delete the wedding from
            Settings. Everything is hidden at once and permanently erased within 30 days.
          </li>
          <li>
            <strong>I am a vendor and my listing is not showing.</strong> New and edited listings
            wait for our review. The Listing page shows its status and any note from our team.
          </li>
        </ul>
      </section>

      <section>
        <h2>Your information</h2>
        <p>
          To see, correct or erase what we hold about you, or to complain, use the address above.
          More detail is in the Privacy Policy.
        </p>
      </section>
    </LegalPage>
  );
}
