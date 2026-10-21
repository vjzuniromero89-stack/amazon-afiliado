"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-page">
      <h1>No pudimos cargar el espacio</h1>
      <p>Comprueba la conexión y que la migración de Supabase esté aplicada.</p>
      <button onClick={reset}>Reintentar</button>
    </main>
  );
}
