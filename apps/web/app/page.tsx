import type { Metadata } from "next";
import Link from "next/link";

import { Icono } from "@/components/ui/iconos";
import {
  CONTENEDOR,
  DOS_COLUMNAS,
  KICKER,
  PILDORA,
  TILE_ICONO,
  TILE_ICONO_GRANDE,
  TITULO_SECCION,
} from "@/components/ui/secciones";
import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Cancha } from "@/lib/api/types";
import { precioLegible } from "@/lib/club";
import { CLUB } from "@/lib/club-datos";
import {
  CIERRE,
  COMO_RESERVAR,
  DISCIPLINAS,
  GALERIA,
  HERO,
  INSTALACIONES,
} from "@/lib/contenido-institucional";

import { FondoHero } from "./fondo-hero";
import { Galeria } from "./galeria";
import { RevealAlScroll } from "./reveal-al-scroll";

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

  // El destino y el precio se resuelven una sola vez: la tarjeta del hero y el
  // panel de disciplinas muestran lo mismo con distinta forma.
  const disciplinas = DISCIPLINAS.map((disciplina) => {
    const deLaApi = datos.get(disciplina.nombre);
    return {
      ...disciplina,
      href: deLaApi
        ? `/disponibilidad?disciplinaId=${deLaApi.disciplinaId}`
        : "/disponibilidad",
      precio: deLaApi ? precioLegible(deLaApi.desde) : null,
    };
  });

  return (
    <main className="flex-1 [overflow-x:clip]">
      {/*
        Sin JS el observador nunca enciende los `[data-reveal]`, que arrancan en
        `opacity:0`. Esto los devuelve a la vista: preferimos perder la animación
        antes que la mitad de la página.
      */}
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: "[data-reveal]{opacity:1!important;transform:none!important}",
          }}
        />
      </noscript>
      <RevealAlScroll />

      <section className="relative flex min-h-[clamp(560px,76vh,780px)] items-end overflow-hidden">
        <FondoHero />

        <div
          className={`${CONTENEDOR} relative flex flex-wrap items-end justify-between gap-x-[clamp(32px,4vw,64px)] gap-y-10 pb-[clamp(96px,12vw,140px)] pt-[clamp(48px,7vw,96px)]`}
          style={{ animation: "dpy-entrada .7s ease both" }}
        >
          <div style={{ flex: "1 1 440px", minWidth: 0 }}>
            <h1 className="font-display text-[clamp(56px,9vw,120px)] font-bold leading-[0.95] tracking-[-0.035em] text-balance">
              {HERO.titulo}
            </h1>

            <p className="mt-6 max-w-[520px] text-[clamp(17px,1.6vw,20px)] leading-[1.5] text-pretty">
              {HERO.bajada}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-[18px]">
              <Link href="/disponibilidad" className={PILDORA.primaria}>
                Ver horarios libres <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="#reserva"
                className="text-[15px] font-medium text-text-muted transition-colors hover:text-text"
              >
                Cómo se reserva
              </Link>
            </div>
          </div>

          <aside
            aria-label={HERO.atajo.titulo}
            data-reveal=""
            className="w-full rounded-[28px] border border-border-strong p-[22px] shadow-[0_30px_80px_rgb(0_0_0/0.5)] backdrop-blur-[14px]"
            style={{
              transitionDelay: ".25s",
              flex: "0 1 400px",
              minWidth: "min(100%, 280px)",
              background: "rgb(11 15 14 / 0.82)",
            }}
          >
            <p className="font-display text-[22px] font-semibold tracking-[-0.02em]">
              {HERO.atajo.titulo}
            </p>
            <p className="mt-0.5 text-sm text-text-muted">{HERO.atajo.bajada}</p>

            <div className="mt-4 flex flex-col gap-2">
              {disciplinas.map((disciplina) => (
                <Link
                  key={disciplina.nombre}
                  href={disciplina.href}
                  className="flex items-center gap-3.5 rounded-[18px] border border-border-subtle bg-surface-input py-3 pl-3 pr-3.5 transition-all hover:translate-x-1 hover:border-accent/50 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span className={TILE_ICONO}>
                    <Icono nombre={disciplina.icono} size={24} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[17px] font-semibold leading-tight">
                      {disciplina.nombre}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-text-muted">
                      Turnos de {disciplina.duracionTurnoMin} min · {disciplina.resumen}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-lg text-accent">
                    →
                  </span>
                </Link>
              ))}
            </div>

            <Link
              href="/disponibilidad"
              className={`${PILDORA.media} mt-3.5 w-full justify-center px-0`}
            >
              {HERO.atajo.accion}
            </Link>

            <p className="mt-3 text-center text-[13px] text-text-subtle">
              {HERO.atajo.nota}
            </p>
          </aside>
        </div>
      </section>

      {/* El panel pisa el hero: de ahí el margen negativo y el z-index. */}
      <section
        aria-labelledby="disciplinas"
        className={`${CONTENEDOR} relative z-[2] mt-[clamp(-96px,-8vw,-72px)]`}
      >
        <div
          data-reveal=""
          className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_30px_80px_rgb(0_0_0/0.45)]"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-[clamp(20px,3vw,32px)] pb-2 pt-[clamp(20px,3vw,28px)]">
            <h2
              id="disciplinas"
              className="font-display text-[clamp(20px,2.2vw,26px)] font-semibold tracking-[-0.02em]"
            >
              Tres deportes, un solo turno por reservar
            </h2>
            <p className="text-[13px] text-text-subtle">
              Tocá una disciplina para ver sus horarios libres
            </p>
          </div>

          {/*
            Una columna o tres, nunca dos: con tres disciplinas, un `auto-fit`
            deja la tercera sola al lado de una celda vacía en los anchos
            intermedios. El `gap` de 1px sobre un fondo claro hace de separador.
          */}
          <div
            className="mt-3 grid gap-px border-t border-border-subtle lg:grid-cols-3"
            style={{ background: "rgb(255 255 255 / 0.06)" }}
          >
            {disciplinas.map((disciplina) => (
              <Link
                key={disciplina.nombre}
                href={disciplina.href}
                className="group flex min-h-[190px] flex-col justify-between gap-7 bg-surface px-[clamp(20px,3vw,32px)] py-[clamp(20px,3vw,28px)] transition-colors hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <span
                      className={`${TILE_ICONO} transition-all duration-300 group-hover:rotate-[-8deg] group-hover:scale-[1.08] group-hover:bg-accent/20`}
                    >
                      <Icono nombre={disciplina.icono} size={24} />
                    </span>
                    <div>
                      <p className="font-display text-[clamp(26px,2.6vw,32px)] font-semibold leading-[1.05] tracking-[-0.02em]">
                        {disciplina.nombre}
                      </p>
                      <p className="mt-1.5 text-sm text-text-muted">{disciplina.resumen}</p>
                    </div>
                  </div>
                  <span className="inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-surface-input px-3 text-[13px] font-semibold">
                    {disciplina.duracionTurnoMin} min
                  </span>
                </div>

                <div className="flex flex-wrap items-end justify-between gap-3">
                  {/*
                    Sin precio de la API la celda no cambia de alto: el "Ver
                    horarios" se queda a la derecha por el `ml-auto`.
                  */}
                  {disciplina.precio ? (
                    <span className="text-sm text-text-muted">
                      <span className="font-display text-lg font-semibold text-text">
                        {disciplina.precio}
                      </span>{" "}
                      por turno
                    </span>
                  ) : null}
                  <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                    Ver horarios <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="instalaciones"
        className={`${CONTENEDOR} pt-[clamp(72px,9vw,128px)]`}
      >
        <div className="grid items-start gap-[clamp(32px,5vw,80px)]" style={DOS_COLUMNAS}>
          <div data-reveal="">
            <p className={`mb-3.5 ${KICKER}`}>{INSTALACIONES.kicker}</p>
            <h2 id="instalaciones" className={TITULO_SECCION}>
              {INSTALACIONES.titulo}
            </h2>
            <p className="mt-[22px] max-w-[480px] text-[17px] leading-[1.55] text-text-muted text-pretty">
              {INSTALACIONES.bajada}
            </p>
          </div>

          <ul className="m-0 list-none border-t border-border p-0">
            {INSTALACIONES.items.map((item, indice) => (
              <li
                key={item.titulo}
                data-reveal=""
                className="grid items-start gap-[18px] border-b border-border py-[22px]"
                style={{
                  transitionDelay: `${indice * 0.1}s`,
                  gridTemplateColumns: "48px minmax(0, 1fr)",
                }}
              >
                <span className={TILE_ICONO_GRANDE}>
                  <Icono nombre={item.icono} />
                </span>
                <div>
                  <p className="font-display text-xl font-semibold tracking-[-0.01em]">
                    {item.titulo}
                  </p>
                  <p className="mt-1 text-[15px] leading-[1.5] text-text-muted">
                    {item.detalle}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-label="Fotos del club"
        className={`${CONTENEDOR} mt-[clamp(40px,5vw,64px)]`}
      >
        <div data-reveal="">
          <Galeria fotos={GALERIA} />
        </div>
      </section>

      <section
        id="reserva"
        aria-labelledby="reserva-titulo"
        className="mt-[clamp(72px,9vw,128px)] border-y border-border-subtle bg-surface"
      >
        <div
          className={`${CONTENEDOR} grid items-start gap-[clamp(32px,5vw,80px)] py-[clamp(56px,7vw,104px)]`}
          style={DOS_COLUMNAS}
        >
          <div data-reveal="">
            <p className={`mb-3.5 ${KICKER}`}>{COMO_RESERVAR.kicker}</p>
            <h2 id="reserva-titulo" className={TITULO_SECCION}>
              {COMO_RESERVAR.titulo}
            </h2>
            <p className="mt-[22px] max-w-[440px] text-[17px] leading-[1.55] text-text-muted text-pretty">
              {COMO_RESERVAR.bajada}
            </p>
            <Link href="/disponibilidad" className={`${PILDORA.media} mt-[30px]`}>
              Ver horarios libres <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div>
            <ol className="m-0 list-none p-0">
              {COMO_RESERVAR.pasos.map((paso, indice) => {
                const ultimo = indice === COMO_RESERVAR.pasos.length - 1;
                return (
                  <li
                    key={paso.titulo}
                    data-reveal=""
                    className="grid gap-[18px] pb-[30px]"
                    style={{
                      transitionDelay: `${indice * 0.15}s`,
                      gridTemplateColumns: "48px minmax(0, 1fr)",
                    }}
                  >
                    <div className="flex flex-col items-center gap-2.5">
                      <span className="grid size-12 shrink-0 place-items-center rounded-full border border-border-strong bg-surface-input text-accent">
                        <Icono nombre={paso.icono} />
                      </span>
                      {/* La línea une con el paso siguiente; en el último no va. */}
                      <span
                        className={`w-px flex-1 ${ultimo ? "bg-transparent" : "bg-border-strong"}`}
                      />
                    </div>
                    <div className="pt-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-accent-hover">
                        Paso {indice + 1}
                      </p>
                      <p className="mt-1 font-display text-[22px] font-semibold tracking-[-0.01em]">
                        {paso.titulo}
                      </p>
                      <p className="mt-1.5 max-w-[420px] text-[15px] leading-[1.5] text-text-muted">
                        {paso.detalle}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Alineado con la columna de texto: 48 del círculo + 18 del gap. */}
            <p
              data-reveal=""
              className="ml-[66px] inline-flex w-fit max-w-full items-center gap-2.5 rounded-2xl border border-border bg-surface-raised px-4 py-3 text-sm"
              style={{ transitionDelay: ".45s" }}
            >
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />
              {COMO_RESERVAR.nota}
            </p>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="cierre"
        className={`${CONTENEDOR} pb-[clamp(48px,6vw,80px)] pt-[clamp(72px,9vw,128px)] text-center`}
      >
        <h2
          id="cierre"
          data-reveal=""
          className="mx-auto font-display text-[clamp(40px,7vw,96px)] font-bold leading-[0.96] tracking-[-0.04em] text-balance"
          style={{ maxWidth: "12ch" }}
        >
          {CIERRE.titulo}
        </h2>

        <div
          data-reveal=""
          className="mt-7 flex flex-wrap items-center justify-center gap-3"
          style={{ transitionDelay: ".15s" }}
        >
          <Link href="/disponibilidad" className={PILDORA.primaria}>
            Ver horarios libres <span aria-hidden="true">→</span>
          </Link>
          <Link href="/registro" className={PILDORA.secundaria}>
            {CIERRE.socio}
          </Link>
        </div>

        <p className="mt-[22px] text-[15px] text-text-muted [overflow-wrap:anywhere]">
          {CIERRE.pregunta}{" "}
          <Link
            href="/contacto"
            className="font-semibold text-accent transition-colors hover:text-accent-hover"
          >
            {CIERRE.enlace}
          </Link>
          {" · "}
          <a href={`mailto:${CLUB.email}`} className="transition-colors hover:text-text">
            {CLUB.email}
          </a>
          {" · "}
          <a href={CLUB.telefonoLink} className="transition-colors hover:text-text">
            {CLUB.telefono}
          </a>
        </p>
      </section>
    </main>
  );
}
