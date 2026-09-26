import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EstadoError } from "@/components/ui/estado-error";
import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Cancha, Disciplina, Equipamiento } from "@/lib/api/types";
import { precioLegible } from "@/lib/club";

export const metadata: Metadata = { title: "Canchas y precios — Deploy" };

/** Los tres listados en paralelo; la API tiene 2 segundos para responder. */
async function cargarCatalogo() {
  const [disciplinas, canchas, equipamiento] = await Promise.all([
    apiFetch<Disciplina[]>("/disciplinas", { timeoutMs: 2000 }),
    apiFetch<Cancha[]>("/canchas", { timeoutMs: 2000 }),
    apiFetch<Equipamiento[]>("/equipamiento", { timeoutMs: 2000 }),
  ]);
  return { disciplinas, canchas, equipamiento };
}

export default async function PaginaCanchas() {
  let catalogo: Awaited<ReturnType<typeof cargarCatalogo>>;
  try {
    catalogo = await cargarCatalogo();
  } catch (error) {
    if (!(error instanceof ApiHttpError)) throw error;
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <EstadoError
          mensaje="El catálogo no está disponible en este momento. Probá de nuevo en unos segundos."
          reintentarHref="/canchas"
        />
      </main>
    );
  }

  const { disciplinas, canchas, equipamiento } = catalogo;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-10">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Canchas y precios</h1>
        <p className="mt-2 max-w-2xl text-text-muted">
          Tres deportes, un solo turno por reservar. El precio es por turno, no por jugador: un
          single de tenis vale lo mismo que un dobles, y el monto queda fijo al momento de
          reservar.
        </p>
      </header>

      <div className="flex flex-col gap-12">
        {disciplinas.map((disciplina) => {
          const canchasDeLaDisciplina = canchas.filter((c) => c.disciplinaId === disciplina.id);
          const itemsDeLaDisciplina = equipamiento.filter((e) => e.disciplinaId === disciplina.id);

          return (
            <section key={disciplina.id} aria-labelledby={`disciplina-${disciplina.id}`}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id={`disciplina-${disciplina.id}`}
                    className="font-display text-2xl font-semibold"
                  >
                    {disciplina.nombre}
                  </h2>
                  <p className="text-sm text-text-muted">
                    Turnos de {disciplina.duracionTurnoMin} minutos
                  </p>
                </div>
                <Link
                  href={`/disponibilidad?disciplinaId=${disciplina.id}`}
                  className={buttonClasses("secondary")}
                >
                  Ver disponibilidad
                </Link>
              </div>

              {canchasDeLaDisciplina.length === 0 ? (
                <p className="text-sm text-text-subtle">Sin canchas activas por ahora.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {canchasDeLaDisciplina.map((cancha) => (
                    <li key={cancha.id}>
                      <Card className="flex h-full flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle>{cancha.nombre}</CardTitle>
                          <Badge tone={cancha.techada ? "accent" : "neutral"}>
                            {cancha.techada ? "Techada" : "Al aire libre"}
                          </Badge>
                        </div>
                        {cancha.superficie ? (
                          <p className="text-sm text-text-muted">
                            {cancha.disciplina} · {cancha.superficie}
                          </p>
                        ) : (
                          <p className="text-sm text-text-muted">{cancha.disciplina}</p>
                        )}
                        <p className="mt-auto">
                          <span className="font-display text-2xl font-semibold text-accent">
                            {precioLegible(cancha.precioPorTurno)}
                          </span>
                          <span className="text-sm text-text-subtle"> por turno</span>
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}

              {itemsDeLaDisciplina.length > 0 ? (
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-text-muted">Equipamiento para alquilar</h3>
                  <ul className="divide-y divide-border-subtle rounded-[20px] border border-border bg-surface-raised">
                    {itemsDeLaDisciplina.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                      >
                        <span>{item.nombre}</span>
                        <span className="text-text-muted">
                          {item.stockTotal} en total ·{" "}
                          <span className="text-text">{precioLegible(item.precioPorTurno)}</span> por
                          turno
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <footer className="mt-12 grid gap-4 text-sm text-text-muted sm:grid-cols-2">
        <p>
          El precio es por turno, no por jugador. Cambiar un precio afecta solo a las reservas
          futuras: las ya confirmadas conservan el monto original.
        </p>
        <p>
          El stock total es lo que tiene el club. La disponibilidad real se calcula por turno
          según lo que ya se alquiló.
        </p>
      </footer>
    </main>
  );
}
