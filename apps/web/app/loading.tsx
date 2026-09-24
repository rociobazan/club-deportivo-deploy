/**
 * Esqueleto mientras el segmento se transmite. `motion-reduce` apaga la
 * animación para quien pidió menos movimiento en su sistema.
 */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-16"
    >
      <span className="sr-only">Cargando…</span>
      <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-raised motion-reduce:animate-none" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-surface-raised motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-[20px] border border-border bg-surface-raised motion-reduce:animate-none"
          />
        ))}
      </div>
    </main>
  );
}
