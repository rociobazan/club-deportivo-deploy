import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { DISCIPLINAS, EL_CLUB, SERVICIOS } from "@/lib/contenido-institucional";

export const metadata: Metadata = {
  title: "El club — Deploy",
  description: EL_CLUB.historia,
};

/**
 * Todo el contenido es estático (RF-09): la página tiene que verse completa con
 * la API caída. Las canchas se listan con su superficie, que no cambia; los
 * precios viven en la base y se ven en Canchas y precios, para no hardcodear
 * acá un dato que se desincroniza en cuanto alguien lo edita en el panel.
 */
export default function PaginaElClub() {
  /*
   * La primera foto de la página queda arriba del pliegue y es el elemento LCP,
   * así que no puede cargar en `lazy`; Next avisa por consola cuando pasa. Se
   * busca cuál es en lugar de asumir que la trae la primera disciplina, porque
   * la foto es opcional y el orden puede cambiar.
   */
  const primeraConFoto = DISCIPLINAS.findIndex((disciplina) => disciplina.foto);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          {EL_CLUB.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
          {EL_CLUB.titulo}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-text-muted">{EL_CLUB.historia}</p>
      </header>

      <div className="flex flex-col gap-12">
        {DISCIPLINAS.map((disciplina, indice) => (
          <section
            key={disciplina.nombre}
            aria-labelledby={`disciplina-${disciplina.nombre}`}
          >
            {/* La foto es opcional: sin ella la sección arranca por el título. */}
            {disciplina.foto ? (
              <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-[20px] border border-border">
                <Image
                  src={disciplina.foto.src}
                  alt={disciplina.foto.alt}
                  fill
                  loading={indice === primeraConFoto ? "eager" : "lazy"}
                  fetchPriority={indice === primeraConFoto ? "high" : "auto"}
                  sizes="(min-width: 1024px) 1024px, 100vw"
                  className="object-cover"
                />
              </div>
            ) : null}

            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id={`disciplina-${disciplina.nombre}`}
                  className="font-display text-2xl font-semibold"
                >
                  {disciplina.nombre}
                </h2>
                <p className="text-sm text-text-muted">
                  Turnos de {disciplina.duracionTurnoMin} min
                </p>
              </div>
              <Link href="/canchas" className={buttonClasses("secondary")}>
                Ver precios
              </Link>
            </div>

            <p className="mb-4 max-w-2xl text-text-muted">{disciplina.descripcion}</p>

            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {disciplina.canchas.map((cancha) => (
                <li key={cancha.nombre}>
                  <Card className="flex h-full items-start justify-between gap-2">
                    <CardTitle>{cancha.nombre}</CardTitle>
                    <Badge>{cancha.detalle}</Badge>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section aria-labelledby="servicios" className="mt-14 border-t border-border pt-10">
        <h2 id="servicios" className="font-display text-2xl font-semibold">
          Servicios
        </h2>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {SERVICIOS.map((servicio) => (
            <li key={servicio.titulo} className="border-l-2 border-accent/40 pl-4">
              <h3 className="font-semibold text-text">{servicio.titulo}</h3>
              <p className="text-sm text-text-muted">{servicio.descripcion}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/disponibilidad" className={buttonClasses("primary")}>
          Ver horarios libres
        </Link>
        <Link href="/contacto" className={buttonClasses("secondary")}>
          Escribirnos
        </Link>
      </div>
    </main>
  );
}
