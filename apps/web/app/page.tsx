import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Cancha } from "@/lib/api/types";
import { precioLegible } from "@/lib/club";
import {
  CIERRE,
  COMO_RESERVAR,
  DISCIPLINAS,
  HERO,
  INSTALACIONES,
  SERVICIOS,
} from "@/lib/contenido-institucional";

export const metadata: Metadata = {
  title: "Deploy Club — Tenis, pádel y fútbol 5 en Córdoba",
  description: HERO.bajada,
};

/** Lo que la API aporta a esta página, y nada más. */
type DatosDeDisciplina = { disciplinaId: number; desde: number };

/**
 * El único dato de la API en las tres páginas del sitio: el precio desde el que
 * se reserva cada disciplina, más su id para el enlace filtrado. Si no llega en
 * 2 segundos, devuelve un mapa vacío y las tarjetas se muestran sin precio, sin
 * ningún mensaje de error (requisito "El sitio institucional no depende de la
 * API", escenario "Precios sin respuesta de la API").
 */
async function datosPorDisciplina(): Promise<Map<string, DatosDeDisciplina>> {
  const porNombre = new Map<string, DatosDeDisciplina>();

  let canchas: Cancha[];
  try {
    canchas = await apiFetch<Cancha[]>("/canchas", { timeoutMs: 2000 });
  } catch (error) {
    // Un error que no vino de la API es un bug y tiene que verse.
    if (!(error instanceof ApiHttpError)) throw error;
    return porNombre;
  }

  for (const cancha of canchas) {
    // El contrato declara `disciplina` opcional: sin el nombre no hay con qué
    // cruzar el precio, así que esa cancha no aporta precio en lugar de
    // aportarlo a la disciplina equivocada.
    if (!cancha.disciplina) continue;

    const anterior = porNombre.get(cancha.disciplina);
    if (!anterior || cancha.precioPorTurno < anterior.desde) {
      porNombre.set(cancha.disciplina, {
        disciplinaId: cancha.disciplinaId,
        desde: cancha.precioPorTurno,
      });
    }
  }
  return porNombre;
}

export default async function Inicio() {
  const datos = await datosPorDisciplina();

  return (
    <main className="flex-1">
      <section className="mx-auto w-full max-w-5xl px-6 pb-16 pt-14 sm:pt-20">
        <Badge tone="accent">{HERO.eyebrow}</Badge>

        <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.1] sm:text-6xl">
          {HERO.titulo[0]}
          <br />
          <span className="text-text-muted">{HERO.titulo[1]}</span>
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-text-muted">{HERO.bajada}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/disponibilidad" className={buttonClasses("primary")}>
            Ver horarios libres
          </Link>
          <Link href="/canchas" className={buttonClasses("secondary")}>
            Canchas y precios
          </Link>
        </div>

        <dl className="mt-12 flex flex-wrap gap-x-12 gap-y-6 border-t border-border-subtle pt-8">
          {/*
            `flex-col-reverse` deja el número arriba sin repetir la etiqueta: el
            término va una sola vez y un lector de pantalla lee "canchas, 6".
          */}
          {HERO.numeros.map((numero) => (
            <div key={numero.etiqueta} className="flex flex-col-reverse">
              <dt className="text-sm text-text-muted">{numero.etiqueta}</dt>
              <dd className="font-display text-3xl font-semibold text-accent">
                {numero.valor}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="disciplinas"
        className="mx-auto w-full max-w-5xl px-6 py-14"
      >
        <h2 id="disciplinas" className="font-display text-2xl font-semibold sm:text-3xl">
          Tres deportes, un solo turno por reservar
        </h2>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DISCIPLINAS.map((disciplina) => {
            const deLaApi = datos.get(disciplina.nombre);
            const href = deLaApi
              ? `/disponibilidad?disciplinaId=${deLaApi.disciplinaId}`
              : "/disponibilidad";

            return (
              <li key={disciplina.nombre}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{disciplina.nombre}</CardTitle>
                    <Badge>{disciplina.duracionTurnoMin} min</Badge>
                  </div>
                  <p className="text-sm text-text-muted">{disciplina.descripcion}</p>
                  <p className="mt-auto pt-2">
                    <Link href={href} className="text-sm font-semibold text-accent hover:underline">
                      {deLaApi
                        ? `Desde ${precioLegible(deLaApi.desde)} el turno →`
                        : "Ver horarios libres →"}
                    </Link>
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="instalaciones"
        className="border-y border-border-subtle bg-surface"
      >
        <div className="mx-auto w-full max-w-5xl px-6 py-14">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            {INSTALACIONES.eyebrow}
          </p>
          <h2
            id="instalaciones"
            className="mt-2 font-display text-2xl font-semibold sm:text-3xl"
          >
            {INSTALACIONES.titulo}
          </h2>
          <p className="mt-3 max-w-2xl text-text-muted">{INSTALACIONES.bajada}</p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {SERVICIOS.map((servicio) => (
              <li key={servicio.titulo} className="border-l-2 border-accent/40 pl-4">
                <h3 className="font-semibold text-text">{servicio.titulo}</h3>
                <p className="text-sm text-text-muted">{servicio.descripcion}</p>
              </li>
            ))}
          </ul>

          <Link href="/el-club" className={buttonClasses("secondary", "mt-8")}>
            Conocer el club
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="como-reservar"
        className="mx-auto w-full max-w-5xl px-6 py-14"
      >
        <h2 id="como-reservar" className="font-display text-2xl font-semibold sm:text-3xl">
          Cómo reservar
        </h2>

        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {COMO_RESERVAR.map((paso, indice) => (
            <li key={paso.titulo}>
              <Card className="flex h-full flex-col gap-2">
                <span
                  aria-hidden="true"
                  className="font-display text-3xl font-semibold text-accent"
                >
                  {indice + 1}
                </span>
                <CardTitle>{paso.titulo}</CardTitle>
                <p className="text-sm text-text-muted">{paso.descripcion}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="cierre"
        className="border-t border-border-subtle bg-surface"
      >
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 id="cierre" className="font-display text-2xl font-semibold sm:text-3xl">
            {CIERRE.titulo}
          </h2>
          <p className="mt-3 max-w-2xl text-text-muted">{CIERRE.bajada}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/registro" className={buttonClasses("primary")}>
              Crear cuenta de socio
            </Link>
            <Link href="/contacto" className={buttonClasses("secondary")}>
              Escribirnos
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
