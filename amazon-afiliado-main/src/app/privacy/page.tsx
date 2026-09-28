import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Ivethskin",
  description: "Privacy policy for the Ivethskin Pinterest publishing tool.",
};

const CONTACT_EMAIL = "vjzuniromero@hotmail.com";
const UPDATED = "September 28, 2026";

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 20px 80px",
        lineHeight: 1.65,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: "#1f2a24",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 4 }}>Privacy Policy</h1>
      <p style={{ color: "#6b7a70", marginTop: 0 }}>Last updated: {UPDATED}</p>

      <p>
        Ivethskin (&quot;we&quot;, &quot;us&quot;) operates a private web tool
        that helps the account owner create, review, schedule and publish Pins
        with Amazon affiliate links to the owner&apos;s own Pinterest account.
        This policy explains what information the tool handles and how it is
        protected.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information:</strong> the email address used to sign
          in to the tool.
        </li>
        <li>
          <strong>Pinterest data:</strong> when you connect Pinterest, we
          receive an access token and refresh token, your board names and IDs,
          the Pins created through the tool, and aggregate Pin analytics
          (impressions, saves and outbound clicks).
        </li>
        <li>
          <strong>Content you enter:</strong> product links or ASINs, product
          names, notes, Pin titles, descriptions, keywords and settings such as
          your Amazon Associates tracking ID.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To publish Pins you have reviewed and approved to your boards.</li>
        <li>To list and create boards on your Pinterest account.</li>
        <li>To show you performance metrics for Pins published by the tool.</li>
      </ul>
      <p>
        We do not sell, rent or share your information with third parties for
        advertising. We do not access data from other Pinterest users.
      </p>

      <h2>Storage and security</h2>
      <p>
        Data is stored in a Supabase (PostgreSQL) database with row-level
        security, and the application is hosted on Vercel. Pinterest tokens are
        encrypted with AES-256-GCM, are only used on the server, and are never
        exposed to the browser.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Data is kept while your account is active. You can disconnect Pinterest
        at any time from your Pinterest settings (Security &gt; Apps), and you
        can request deletion of all your data by emailing us. We will delete it
        within 30 days.
      </p>

      <h2>Third-party services</h2>
      <p>
        The tool uses the Pinterest API, Supabase and Vercel. Links point to
        Amazon, whose own privacy policy applies when you visit it. As an Amazon
        Associate, we earn from qualifying purchases.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or deletion requests:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </main>
  );
}
