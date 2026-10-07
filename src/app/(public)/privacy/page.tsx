import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Make My Marriage",
  description: "What Make My Marriage collects, why, who handles it, and how to have it erased.",
};

// Written from what the app actually does (see the data design and system design documents), so
// it must change whenever that does. It should be read by a lawyer before launch.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="Make My Marriage helps families plan a wedding. This page explains, in plain words, what information the service holds, why, who helps us look after it, and what you can do about it."
    >
      <section>
        <h2>Whose information this is</h2>
        <p>
          The couple and their family decide what goes into their wedding: the guest list, the
          events, the budget, the photos. We keep and process that information for them, only to run
          the service they asked for. We do not sell it, we do not use it for advertising, and we do
          not use guest contact details for anything except that wedding&rsquo;s invitations and
          reminders.
        </p>
      </section>

      <section>
        <h2>What we hold</h2>
        <ul>
          <li>
            <strong>Your account:</strong> your name, your email address, and your password stored
            only as a one-way scrambled value, never as the password itself.
          </li>
          <li>
            <strong>The wedding:</strong> names, date, city and venue; events; tasks; the budget and
            expenses; vendors and their payment schedules; seating and check-in records.
          </li>
          <li>
            <strong>Guests:</strong> the name, phone number, email address and any note the family
            adds, and each guest&rsquo;s replies. We do not ask for identity documents or travel
            details.
          </li>
          <li>
            <strong>Photos:</strong> pictures that team members or guests upload, and the optional
            name a guest types when uploading.
          </li>
          <li>
            <strong>Vendors who list on the marketplace:</strong> business name, contact details,
            description, photos, and reviews they receive.
          </li>
          <li>
            <strong>Technical records:</strong> to stop abuse we keep short-lived counters tied to a
            scrambled form of your network address. We do not build a profile of you from them.
          </li>
        </ul>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>
          We use one cookie to keep you signed in (two, if you are also a marketplace vendor). It is
          needed for the service to work. We do not use advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>Who helps us run the service</h2>
        <p>These companies handle data on our behalf, only to provide the service:</p>
        <ul>
          <li>Vercel, which runs the website.</li>
          <li>MongoDB Atlas, which stores the information, in a data centre in India (Mumbai).</li>
          <li>Cloudflare R2, which stores photos.</li>
          <li>Resend, which delivers the emails we send for you.</li>
          <li>
            Google, when you use Discover vendors: we send only the words you search for (for
            example &ldquo;photographer in Pune&rdquo;), never any personal information.
          </li>
        </ul>
      </section>

      <section>
        <h2>How long we keep things</h2>
        <ul>
          <li>Wedding information stays until the wedding is deleted.</li>
          <li>
            When an admin deletes a wedding it disappears at once, and everything in it, photos
            included, is permanently erased within 30 days.
          </li>
          <li>Guest photos nobody has reviewed after 60 days are deleted.</li>
          <li>In-app notifications are deleted after 90 days.</li>
          <li>Sent-email records are removed after 30 days.</li>
        </ul>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>See and take your information:</strong> team members can export the guest list,
            expenses and vendors as spreadsheets.
          </li>
          <li>
            <strong>Correct it:</strong> everything can be edited in the app.
          </li>
          <li>
            <strong>Have it erased:</strong> an admin can delete the wedding from Settings.
          </li>
          <li>
            <strong>Stop emails:</strong> every reminder email has a one-click unsubscribe link.
          </li>
          <li>
            <strong>Ask us:</strong> write to <ContactLine /> about anything here, including a
            complaint. If you are a guest, the couple whose wedding it is can also help.
          </li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Connections are encrypted, passwords are scrambled with a modern method, guest and gallery
          links are long random codes, and every wedding&rsquo;s information is kept apart from
          every other&rsquo;s. No system is perfectly safe; if something affecting you goes wrong we
          will tell you.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          The service is for adults planning a wedding. Photos and names of children may appear
          because a family adds them; the family is responsible for that, and an admin can delete
          any photo.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          If we change this page in a way that matters, we will say so in the app. The date above
          shows when it last changed.
        </p>
      </section>
    </LegalPage>
  );
}
