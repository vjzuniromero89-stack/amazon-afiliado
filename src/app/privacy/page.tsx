export const metadata = { title: "Privacy Policy · Ivethskin" };

export default function PrivacyPage() {
  const email = "vjzuniromero@hotmail.com";
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px", lineHeight: 1.6, fontFamily: "system-ui, sans-serif" }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: September 28, 2026</p>
      <p>Ivethskin operates a private web tool that helps the account owner create, schedule and publish Pins with Amazon affiliate links to the owner&apos;s own Pinterest account.</p>
      <h2>Information we collect</h2>
      <p>The sign-in email; Pinterest access and refresh tokens; board names and IDs; Pins created through the tool; and Pin analytics (impressions, saves, outbound clicks). Also the product links, names and Pin texts you enter.</p>
      <h2>How we use it</h2>
      <p>Only to publish Pins you approve, list and create your boards, and show your Pin performance. We do not sell or share your data, and we do not access other users&apos; data.</p>
      <h2>Storage and security</h2>
      <p>Data is stored in Supabase with row-level security and the app is hosted on Vercel. Pinterest tokens are encrypted (AES-256-GCM) and never sent to the browser.</p>
      <h2>Deletion</h2>
      <p>You can disconnect Pinterest anytime in your Pinterest settings (Security &gt; Apps) or email us to delete all your data within 30 days.</p>
      <h2>Contact</h2>
      <p>{email}</p>
    </main>
  );
}
