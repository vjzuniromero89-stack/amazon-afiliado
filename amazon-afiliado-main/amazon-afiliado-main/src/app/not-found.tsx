import Link from "next/link";
export default function NotFound() {
  return (
    <main className="loading-page">
      <h1>Esta página no existe</h1>
      <Link href="/">Volver al Dashboard</Link>
    </main>
  );
}
