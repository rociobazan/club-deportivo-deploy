import type { Metadata } from "next";
import Link from "next/link";

import { Icono, type NombreDeIcono } from "@/components/ui/iconos";
import {
  CONTENEDOR,
  KICKER,
  PILDORA,
  TILE_ICONO,
  TITULO_PORTADA,
} from "@/components/ui/secciones";
import { CLUB, HORARIO } from "@/lib/club-datos";
import { CONTACTO } from "@/lib/contenido-institucional";

import { RevealAlScroll } from "../reveal-al-scroll";
import { FormularioContacto } from "./formulario-contacto";

export const metadata: Metadata = {
  title: "Contacto — Deploy",
  description: `Escribinos, llamanos al ${CLUB.telefono} o pasá por ${CLUB.direccion}, ${CLUB.barrio}.`,
};

/**
 * El mapa se embebe con la URL pública de Google Maps, que acepta la dirección
 * como consulta y **no necesita clave de API**: el proyecto no tiene ninguna y
 * no valía la pena sumarla por un iframe. La dirección se arma con `CLUB` en
 * lugar de escribirla acá, así sigue al dato si el club se muda.
 */
const MAPA = `https://maps.google.com/maps?q=${encodeURIComponent(
  `${CLUB.direccion}, ${CLUB.barrio}, Argentina`,
)}&z=16&output=embed`;

type DatoDeContacto = {
  icono: NombreDeIcono;
  etiqueta: string;
  valor: string;
  nota: string;
  href?: string;
};

/**
 * El formulario es lo único que habla con la API. Los datos del club son
 * estáticos y quedan a la vista siempre, también cuando el envío falla: es lo
 * que pide el requisito del formulario, para que la persona igual pueda
 * escribir o llamar.
 */
export default function PaginaContacto() {
  const datos: DatoDeContacto[] = [
    {
      icono: "pin",
      etiqueta: "Dirección",
      valor: CLUB.direccion,
      nota: CLUB.barrio,
    },
    {
      icono: "telefono",
      etiqueta: "Teléfono",
      valor: CLUB.telefono,
      nota: CONTACTO.notas.telefono,
      href: CLUB.telefonoLink,
    },
    {
      icono: "mail",
      etiqueta: "Mail",
      valor: CLUB.email,
      nota: CONTACTO.notas.email,
      href: `mailto:${CLUB.email}`,
    },
    {
      icono: "reloj",
      etiqueta: "Horarios",
      valor: HORARIO,
      nota: CLUB.buffet,
    },
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

      <section aria-labelledby="portada" className="fondo-mezcla border-b border-border-subtle">
        <div className={`${CONTENEDOR} pb-[clamp(40px,6vw,72px)] pt-[clamp(40px,6vw,80px)]`}>
          <p className={KICKER}>{CONTACTO.eyebrow}</p>
          <h1 id="portada" className={`mt-4 max-w-[18ch] ${TITULO_PORTADA}`}>
            {CONTACTO.titulo}
          </h1>
          <p className="mt-6 max-w-[520px] text-[17px] leading-[1.55] text-text-muted text-pretty">
            Te respondemos el mismo día. Si preferís, llamá o pasá por el club:
            los horarios están acá abajo.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="formulario"
        className={`${CONTENEDOR} pt-[clamp(40px,6vw,72px)]`}
      >
        <div className="grid gap-[clamp(28px,4vw,56px)] lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div
            data-reveal=""
            className="rounded-[28px] border border-border bg-surface p-[clamp(20px,3vw,32px)] shadow-[0_30px_80px_rgb(0_0_0/0.35)]"
          >
            <h2 id="formulario" className="font-display text-[22px] font-semibold tracking-[-0.02em]">
              Escribinos
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Contanos qué necesitás y te contestamos por mail.
            </p>

            <div className="mt-6">
              <FormularioContacto />
            </div>
          </div>

          <div data-reveal="" style={{ transitionDelay: ".1s" }}>
            <h2 className="font-display text-[22px] font-semibold tracking-[-0.02em]">
              Dónde encontrarnos
            </h2>

            <dl className="mt-5 list-none border-t border-border p-0">
              {datos.map((dato) => (
                <div
                  key={dato.etiqueta}
                  className="flex items-start gap-4 border-b border-border py-4"
                >
                  <span className={TILE_ICONO}>
                    <Icono nombre={dato.icono} size={20} />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[13px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
                      {dato.etiqueta}
                    </dt>
                    <dd className="mt-0.5 [overflow-wrap:anywhere]">
                      {dato.href ? (
                        <a
                          href={dato.href}
                          className="font-display text-lg font-semibold transition-colors hover:text-accent"
                        >
                          {dato.valor}
                        </a>
                      ) : (
                        <span className="font-display text-lg font-semibold">
                          {dato.valor}
                        </span>
                      )}
                      <span className="block text-sm text-text-muted">{dato.nota}</span>
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="mapa"
        className={`${CONTENEDOR} pt-[clamp(40px,6vw,72px)]`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="mapa" className="font-display text-[22px] font-semibold tracking-[-0.02em]">
            Cómo llegar
          </h2>
          <p className="text-[13px] text-text-subtle">
            {CLUB.direccion} · {CLUB.barrio}
          </p>
        </div>

        {/*
          El iframe es de Google Maps y carga en diferido: es lo más pesado de la
          página y está abajo de todo. `border-0` porque el iframe trae borde
          propio y acá el borde lo pone el contenedor redondeado.
        */}
        <div
          data-reveal=""
          className="mt-5 overflow-hidden rounded-[28px] border border-border bg-surface"
        >
          <iframe
            title={`Mapa de ${CLUB.nombre} en ${CLUB.direccion}`}
            src={MAPA}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="block h-[clamp(280px,42vw,460px)] w-full border-0"
          />
        </div>
      </section>

      <section
        className={`${CONTENEDOR} pb-[clamp(48px,6vw,80px)] pt-[clamp(56px,7vw,96px)] text-center`}
      >
        <p data-reveal="" className="text-[17px] text-text-muted">
          ¿Preferís ver los horarios antes de escribir?
        </p>
        <div data-reveal="" className="mt-5" style={{ transitionDelay: ".1s" }}>
          <Link href="/disponibilidad" className={PILDORA.primaria}>
            Ver horarios libres <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
