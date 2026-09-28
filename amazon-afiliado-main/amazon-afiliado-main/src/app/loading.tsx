export default function Loading() {
  return (
    <main className="loading-page" aria-live="polite">
      <div className="brand-mark">
        a<span>↗</span>
      </div>
      <p>Cargando tu espacio de trabajo…</p>
      <div className="skeleton" />
    </main>
  );
}
