import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/brand";

function Shell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link to="/login" className="text-sm font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-8 space-y-8 text-[14px] leading-relaxed text-foreground/85">
          {children}
        </div>
        <p className="mt-10 border-t pt-6 text-[12.5px] text-muted-foreground">
          Questions about this page? Contact{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-semibold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

export function Terms() {
  return (
    <Shell title="Terms of Service" updated="August 2026">
      <Section heading="1. Agreement">
        <p>
          These Terms of Service govern your use of {APP_NAME}. By creating an account or using
          the service, you agree to these terms. If you do not agree, do not use the service.
        </p>
      </Section>

      <Section heading="2. The service">
        <p>
          {APP_NAME} is a tool for resellers to track inventory, sales, and expenses, manage
          marketplace listings, and generate reports. It also offers a real eBay integration and an
          AI writing assistant. The service is provided by the app owner (contact details at the
          bottom of this page).
        </p>
      </Section>

      <Section heading="3. Accounts">
        <p>
          You must provide accurate information when creating an account and keep your credentials
          secure. You are responsible for all activity under your account.
        </p>
      </Section>

      <Section heading="4. Your content">
        <p>
          You own the data you enter — your inventory, sales, expenses, photos, and notes. You grant
          us a limited license to store and process it solely to provide the service to you. You can
          export your data at any time from Settings → Data &amp; export.
        </p>
      </Section>

      <Section heading="5. Marketplace integrations">
        <p>
          {APP_NAME} connects to eBay through eBay's official API. When you connect your eBay
          account, you authorize us to act on your behalf (for example, publishing and ending
          listings) using the permissions you approved during connection. You remain responsible for
          complying with eBay's own terms and policies, and for the accuracy of anything published
          through the service.
        </p>
        <p>
          Depop, Poshmark, Vinted, Mercari, and Facebook Marketplace do not offer third-party
          selling APIs, so those channels are tracked manually. No account is connected to them.
        </p>
      </Section>

      <Section heading="6. AI assistant">
        <p>
          The AI assistant ("Ask {APP_NAME}") drafts text and answers questions from your own data.
          Its output is a suggestion, not professional advice. Always review and verify AI-generated
          content before publishing it. The service is not a substitute for legal, tax, accounting,
          or financial advice.
        </p>
      </Section>

      <Section heading="7. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>use the service for anything unlawful or to list prohibited items;</li>
          <li>attempt to access another user's data or accounts;</li>
          <li>resell, rent, or redistribute the service or its source code; or</li>
          <li>interfere with the operation of the service.</li>
        </ul>
      </Section>

      <Section heading="8. Third-party services">
        <p>
          {APP_NAME} relies on third-party services including Supabase (database, authentication,
          and storage), OpenAI (AI), and eBay. These services are governed by their own terms and
          availability, and we are not responsible for outages or changes on their side.
        </p>
      </Section>

      <Section heading="9. Fees">
        <p>
          Access, hosting, and support fees (if any) are as separately agreed between you and the
          app owner. Third-party usage such as OpenAI may be billed separately per use.
        </p>
      </Section>

      <Section heading="10. Disclaimers">
        <p>
          The service is provided "as is" and "as available," without warranties of any kind,
          express or implied, including merchantability, fitness for a particular purpose, and
          non-infringement.
        </p>
      </Section>

      <Section heading="11. Limitation of liability">
        <p>
          To the maximum extent permitted by law, we will not be liable for any indirect,
          incidental, special, or consequential damages, or for lost profits or lost data, arising
          out of your use of the service.
        </p>
      </Section>

      <Section heading="12. Termination">
        <p>
          You may stop using the service at any time. We may suspend or terminate access for a
          breach of these terms or as otherwise agreed.
        </p>
      </Section>

      <Section heading="13. Changes">
        <p>
          We may update these terms from time to time. Material changes will be reflected in the
          "Last updated" date above, and continued use after a change constitutes acceptance.
        </p>
      </Section>
    </Shell>
  );
}

export function Privacy() {
  return (
    <Shell title="Privacy Policy" updated="August 2026">
      <Section heading="1. Overview">
        <p>
          This policy explains what data {APP_NAME} collects, how it is used, and your choices.
          {APP_NAME} is operated by the app owner (contact details at the bottom of this page).
        </p>
      </Section>

      <Section heading="2. Data we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Account data</strong> — your email address, display name, and optional profile photo.</li>
          <li><strong>Business data</strong> — inventory items, photos, sales, expenses, notes, tags, and settings you enter.</li>
          <li><strong>Marketplace data</strong> — when you connect eBay: your eBay username, listing status, and recent order summaries. eBay access tokens are stored server-side and never shown in the app.</li>
          <li><strong>AI interactions</strong> — questions you ask the assistant and the context used to answer them, when you use Ask {APP_NAME}.</li>
        </ul>
      </Section>

      <Section heading="3. How we use it">
        <p>
          We use your data to provide the service: to store and display your inventory, compute
          profits and reports, publish and sync eBay listings at your request, and answer your AI
          questions. We do not sell your data or use it to advertise to you.
        </p>
      </Section>

      <Section heading="4. Storage">
        <p>
          Data is stored in a Supabase database (Postgres) and photo storage, with access restricted
          by account-level security so that each user can only ever see their own data.
        </p>
      </Section>

      <Section heading="5. Sharing and processors">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Supabase</strong> hosts the database, authentication, and file storage.</li>
          <li><strong>OpenAI</strong> receives your question and relevant business context only when you use the AI assistant.</li>
          <li><strong>eBay</strong> receives item details and photos only when you publish a listing, and returns your listing and order data when you sync.</li>
        </ul>
        <p>We do not share your data with any other parties except as required by law.</p>
      </Section>

      <Section heading="6. Retention and deletion">
        <p>
          Your data is retained while your account is active. You can export your data from
          Settings → Data &amp; export, and request deletion by contacting the address below.
        </p>
      </Section>

      <Section heading="7. Your rights">
        <p>
          Depending on your location you may have rights to access, correct, export, or delete your
          data. To exercise them, contact the address below and we will respond within a reasonable
          time.
        </p>
      </Section>

      <Section heading="8. Security">
        <p>
          We use encrypted transport (HTTPS), per-account access controls, and least-privilege
          credentials. No method of transmission or storage is completely secure, and we cannot
          guarantee absolute security.
        </p>
      </Section>

      <Section heading="9. Children">
        <p>
          {APP_NAME} is intended for adults running a business. It is not directed to children under
          13, and we do not knowingly collect their data.
        </p>
      </Section>

      <Section heading="10. Changes">
        <p>
          We may update this policy from time to time; the "Last updated" date reflects the latest
          version.
        </p>
      </Section>
    </Shell>
  );
}
