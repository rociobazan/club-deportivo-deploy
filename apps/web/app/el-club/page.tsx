import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Icono } from "@/components/ui/iconos";
import {
  CONTENEDOR,
  KICKER,
  PILDORA,
  TILE_ICONO,
  TILE_ICONO_GRANDE,
  TITULO_PORTADA,
  TITULO_SECCION,
} from "@/components/ui/secciones";
import { DISCIPLINAS, EL_CLUB, SERVICIOS } from "@/lib/contenido-institucional";

import { RevealAlScroll } from "../reveal-al-scroll";

export const metadata: Metadata = {
  title: "El club — Deploy",
  description: EL_CLUB.historia,
};

/**
 * Todo el contenido es estático (RF-09): la página tiene que verse completa con
 * la API caída. Las canchas se listan con su superficie, que no cambia; los
 * precios viven en la base y se ven en Canchas y precios, para no hardcodear
 * acá un dato que se desincroniza en cuanto alguien lo edita en el panel.
 *
 * Comparte el lenguaje visual de Inicio (`components/ui/secciones.ts`): mismo
 * ancho, misma escala de títulos y el mismo reveal al scroll.
 */
export default function PaginaElClub() {
  const canchas = DISCIPLINAS.reduce((total, d) => total + d.canchas.length, 0);

  const numeros = [
    { valor: String(canchas), etiqueta: "canchas" },
    { valor: String(DISCIPLINAS.length), etiqueta: "disciplinas" },
    { valor: EL_CLUB.desde, etiqueta: "desde" },
    { valor: EL_CLUB.socios, etiqueta: "socios" },
  ];

  return (
    <main className="flex-1 [overflow-x:clip]">
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: "[data-reveal]{opacity:1!important;transform:none!important}",
          }}
        />
      </noscript>
      <RevealAlScroll />

      {/*
        La foto va contenida a la derecha y no de fondo a sangre: es un plano
        ancho y claro, y detrás del texto competía con él. Encuadrada funciona,
        igual que en las secciones de disciplina de más abajo.
      */}
      <section aria-labelledby="portada" className="fondo-mezcla border-b border-border-subtle">
        <div className={`${CONTENEDOR} py-[clamp(40px,6vw,80px)]`}>
          <div className="grid items-center gap-[clamp(28px,4vw,64px)] lg:grid-cols-2">
            <div>
              <p className={KICKER}>{EL_CLUB.eyebrow}</p>
              <h1 id="portada" className={`mt-4 max-w-[14ch] ${TITULO_PORTADA}`}>
                {EL_CLUB.titulo}
              </h1>
              <p className="mt-6 max-w-[520px] text-[17px] leading-[1.55] text-text-muted text-pretty">
                {EL_CLUB.historia}
              </p>

              {/*
                `flex-col-reverse` deja el número arriba sin repetir la etiqueta:
                el término va una sola vez y un lector de pantalla lee "canchas, 6".
              */}
              <dl className="mt-9 flex flex-wrap gap-x-12 gap-y-6 border-t border-border pt-7">
                {numeros.map((numero) => (
                  <div key={numero.etiqueta} className="flex flex-col-reverse">
                    <dt className="text-sm text-text-muted">{numero.etiqueta}</dt>
                    <dd className="font-display text-[clamp(28px,3.4vw,40px)] font-semibold leading-none text-accent">
                      {numero.valor}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Sin `alt`: el `h1` ya dice de qué es la página, la foto es ambiente. */}
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] border border-border-subtle bg-surface">
              <Image
                src="/fotos/entrada-club.webp"
                alt=""
                fill
                loading="eager"
                fetchPriority="high"
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/*
        Las disciplinas alternan el lado de la foto. El `lg:order-2` va solo
        desde `lg`: apilado, la foto tiene que ir siempre primero, que es como
        se lee la sección en celular.
      */}
      {DISCIPLINAS.map((disciplina, indice) => (
        <section
          key={disciplina.nombre}
          aria-labelledby={`disciplina-${indice}`}
          className={`${CONTENEDOR} pt-[clamp(56px,8vw,104px)]`}
        >
          <div className="grid items-center gap-[clamp(28px,4vw,64px)] lg:grid-cols-2">
            {disciplina.foto ? (
              <div
                data-reveal=""
                className={`relative aspect-[4/3] overflow-hidden rounded-[28px] border border-border-subtle bg-surface ${
                  indice % 2 === 1 ? "lg:order-2" : ""
                }`}
              >
                <Image
                  src={disciplina.foto.src}
                  alt={disciplina.foto.alt}
                  fill
                  // La candidata a LCP es la foto de la portada, no esta: todas
                  // las de disciplina quedan abajo del pliegue.
                  loading="lazy"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
            ) : null}

            <div data-reveal="" style={{ transitionDelay: ".1s" }}>
              <div className="flex items-center gap-4">
                <span className={TILE_ICONO}>
                  <Icono nombre={disciplina.icono} size={24} />
                </span>
                <span className="inline-flex h-[30px] items-center whitespace-nowrap rounded-full border border-border bg-surface-input px-3 text-[13px] font-semibold">
                  Turnos de {disciplina.duracionTurnoMin} min
                </span>
              </div>

              <h2 id={`disciplina-${indice}`} className={`mt-5 ${TITULO_SECCION}`}>
                {disciplina.nombre}
              </h2>

              <p className="mt-4 max-w-[480px] text-[17px] leading-[1.55] text-text-muted text-pretty">
                {disciplina.descripcion}
              </p>

              <ul className="mt-7 list-none border-t border-border p-0">
                {disciplina.canchas.map((cancha) => (
                  <li
                    key={cancha.nombre}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border py-3.5"
                  >
                    <span className="font-display text-lg font-semibold">
                      {cancha.nombre}
                    </span>
                    <span className="text-sm text-text-muted">{cancha.detalle}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link href="/disponibilidad" className={PILDORA.media}>
                  Ver horarios libres <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/canchas"
                  className="text-[15px] font-medium text-text-muted transition-colors hover:text-text"
                >
                  Precios por turno
                </Link>
              </div>
            </div>
          </div>
        </section>
      ))}

      <section
        aria-labelledby="servicios"
        className="mt-[clamp(72px,9vw,128px)] border-y border-border-subtle bg-surface"
      >
        <div className={`${CONTENEDOR} py-[clamp(56px,7vw,104px)]`}>
          <div data-reveal="" className="max-w-[560px]">
            <p className={KICKER}>Lo que hay adentro</p>
            <h2 id="servicios" className={`mt-4 ${TITULO_SECCION}`}>
              Servicios
            </h2>
          </div>

          <ul className="mt-10 grid list-none gap-px border border-border bg-border p-0 sm:grid-cols-2">
            {SERVICIOS.map((servicio, indice) => (
              <li
                key={servicio.titulo}
                data-reveal=""
                style={{ transitionDelay: `${indice * 0.08}s` }}
                className="flex items-start gap-4 bg-surface p-[clamp(20px,3vw,28px)]"
              >
                <span className={TILE_ICONO_GRANDE}>
                  <Icono nombre={servicio.icono} />
                </span>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-[-0.01em]">
                    {servicio.titulo}
                  </h3>
                  <p className="mt-1 text-[15px] leading-[1.5] text-text-muted">
                    {servicio.descripcion}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="cierre-club"
        className={`${CONTENEDOR} pb-[clamp(48px,6vw,80px)] pt-[clamp(72px,9vw,128px)] text-center`}
      >
        <h2
          id="cierre-club"
          data-reveal=""
          className="mx-auto max-w-[14ch] font-display text-[clamp(36px,6vw,80px)] font-bold leading-[0.98] tracking-[-0.04em] text-balance"
        >
          Vení a conocerlo.
        </h2>

        <div
          data-reveal=""
          className="mt-7 flex flex-wrap items-center justify-center gap-3"
          style={{ transitionDelay: ".15s" }}
        >
          <Link href="/disponibilidad" className={PILDORA.primaria}>
            Ver horarios libres <span aria-hidden="true">→</span>
          </Link>
          <Link href="/contacto" className={PILDORA.secundaria}>
            Escribile al club
          </Link>
        </div>
      </section>
    </main>
  );
}
