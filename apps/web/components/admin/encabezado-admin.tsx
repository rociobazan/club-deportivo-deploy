import type { ReactNode } from "react";

/** El contenedor de todas las pantallas de `/admin`. */
export const MAIN_ADMIN = "mx-auto w-full max-w-5xl flex-1 px-6 py-12";

/** Encabezado común de `/admin`, con el "Administración" del prototipo arriba del título. */
export function EncabezadoAdmin({
  titulo,
  bajada,
  acciones,
}: {
  titulo: string;
  bajada?: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent">
          Administración
        </span>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{titulo}</h1>
        {bajada ? <p className="mt-2 max-w-2xl text-text-muted">{bajada}</p> : null}
      </div>
      {acciones}
    </header>
  );
}
