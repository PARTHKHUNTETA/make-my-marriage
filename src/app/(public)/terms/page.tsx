import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — Make My Marriage",
  description: "The rules for using Make My Marriage.",
};

// Plain-language terms for a free planning tool. It should be read by a lawyer before launch.
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These are the rules for using Make My Marriage. By creating an account, or by using a link someone has shared with you, you agree to them."
    >
      <section>
        <h2>The service</h2>
        <p>
          Make My Marriage is a planning tool: guest lists, invitations and replies, budgets,
          vendors, a wedding website and photo sharing. We work to keep it available and correct,
          but we cannot promise it will never be interrupted or contain mistakes. Please keep your
          own copy of anything you cannot afford to lose; you can export your guest list, expenses
          and vendors at any time.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Give accurate details and keep your password to yourself.</li>
          <li>
            You are responsible for what happens under your account, including what the people you
            invite to your wedding team do.
          </li>
          <li>Admins decide who is on the team and can delete the wedding.</li>
        </ul>
      </section>

      <section>
        <h2>What you put in</h2>
        <ul>
          <li>
            It stays yours. You allow us to store and show it only as needed to run the service.
          </li>
          <li>
            Only add information about guests that you are entitled to share, and only email people
            who would reasonably expect to hear from you about the wedding.
          </li>
          <li>
            You are responsible for the photos and words you and your guests add. Guest photos wait
            for your approval before anyone else sees them.
          </li>
        </ul>
      </section>

      <section>
        <h2>Please do not</h2>
        <ul>
          <li>
            Break the law, or upload anything illegal, abusive or that belongs to someone else.
          </li>
          <li>
            Use the service to send spam or to contact people who have not agreed to hear from you.
          </li>
          <li>
            Try to get into another wedding&rsquo;s information, or to disrupt or overload the
            service.
          </li>
          <li>Pretend to be someone else, including on a marketplace listing or review.</li>
        </ul>
        <p>
          We may remove content or suspend an account that breaks these rules, and will usually tell
          you why.
        </p>
      </section>

      <section>
        <h2>The marketplace</h2>
        <p>
          Vendors on the marketplace are independent businesses, not part of Make My Marriage. We
          review listings before they appear, but we do not guarantee any vendor&rsquo;s work,
          prices or availability, and we do not take or handle payments between you and a vendor.
          Any agreement is between you and the vendor. Reviews should be honest and about your own
          experience.
        </p>
      </section>

      <section>
        <h2>Ending things</h2>
        <p>
          You can stop at any time. An admin can delete the wedding from Settings, after which its
          information is permanently erased within 30 days, as the Privacy Policy explains. We may
          end the service or your access, and will give notice where we reasonably can.
        </p>
      </section>

      <section>
        <h2>Limits</h2>
        <p>
          The service is provided as it is. To the extent the law allows, we are not liable for
          losses that come from using it, such as a missed reply, a late email, or a vendor who lets
          you down, and our total responsibility to you is limited to what you paid us, which for a
          free account is nothing. Nothing here limits rights the law says cannot be limited.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms; if the change matters we will say so in the app, and continuing
          to use the service means you accept it. These terms are governed by the laws of India.
          Questions can go to <ContactLine />.
        </p>
      </section>
    </LegalPage>
  );
}
