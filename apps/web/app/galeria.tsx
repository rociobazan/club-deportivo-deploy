"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import type { FotoDeGaleria } from "@/lib/contenido-institucional";

/** El `gap` de la pista, en px. Entra en la cuenta del paso de scroll. */
const SEPARACION = 12;

/**
 * Carrusel de fotos del club. El desplazamiento es el scroll nativo con
 * `scroll-snap`, no un `transform` calculado a mano: así se arrastra con el dedo
 * en celular, funciona con la rueda y sigue andando si el JS falla, en cuyo caso
 * solo se pierden los puntos y las flechas.
 */
export function Galeria({ fotos }: { fotos: readonly FotoDeGaleria[] }) {
  const pista = useRef<HTMLDivElement>(null);
  const [activa, setActiva] = useState(0);

  /**
   * Cuánto scroll hay de una foto a la siguiente. Se mide en vez de calcularse:
   * el ancho del slide es un `calc()` que depende del viewport.
   */
  function paso(): number {
    const primera = pista.current?.firstElementChild;
    return primera ? primera.getBoundingClientRect().width + SEPARACION : 300;
  }

  function irA(indice: number) {
    const destino = Math.min(Math.max(indice, 0), fotos.length - 1);
    // El suavizado se decide acá, y no con `scroll-behavior` en el contenedor,
    // para poder apagarlo con `prefers-reduced-motion`: la spec pide que no
    // quede ningún movimiento cuando esa preferencia está puesta.
    const quietito = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pista.current?.scrollTo({
      left: destino * paso(),
      behavior: quietito ? "auto" : "smooth",
    });
  }

  return (
    <div>
      <div
        ref={pista}
        onScroll={(evento) => {
          const indice = Math.round(evento.currentTarget.scrollLeft / paso());
          // Acotado: el rebote del scroll puede dar un índice fuera de la lista.
          setActiva(Math.min(Math.max(indice, 0), fotos.length - 1));
        }}
        className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {fotos.map((foto) => (
          <figure
            key={foto.src}
            className="relative m-0 aspect-[4/3] overflow-hidden rounded-3xl border border-border-subtle bg-surface transition-transform duration-300 hover:scale-[1.015]"
            style={{
              // Tres visibles en escritorio contando los dos gaps; una sola en
              // celular, donde el `min()` gana.
              flex: "0 0 calc((100% - 24px) / 3)",
              minWidth: "min(100%, 260px)",
              scrollSnapAlign: "start",
            }}
          >
            <Image
              src={foto.src}
              alt={foto.alt}
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover"
            />
            <figcaption
              className="pointer-events-none absolute bottom-2.5 left-2.5 truncate rounded-full border border-border-strong px-[11px] py-1.5 text-[13px] font-medium text-text backdrop-blur-md"
              style={{ maxWidth: "calc(100% - 20px)", background: "rgb(6 8 7 / 0.72)" }}
            >
              {foto.etiqueta}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex gap-1.5">
          {fotos.map((foto, indice) => (
            <button
              key={foto.src}
              type="button"
              aria-label={`Ver ${foto.etiqueta}`}
              aria-current={indice === activa ? "true" : undefined}
              onClick={() => irA(indice)}
              className={`h-1.5 cursor-pointer rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
                indice === activa ? "w-[22px] bg-accent" : "w-1.5 bg-white/[0.18]"
              }`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {[
            { etiqueta: "Foto anterior", flecha: "←", destino: activa - 1 },
            { etiqueta: "Foto siguiente", flecha: "→", destino: activa + 1 },
          ].map((control) => (
            <button
              key={control.etiqueta}
              type="button"
              aria-label={control.etiqueta}
              onClick={() => irA(control.destino)}
              className="grid size-11 cursor-pointer place-items-center rounded-full border border-border-strong bg-surface text-lg text-text transition-colors hover:border-accent/50 hover:bg-surface-input focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span aria-hidden="true">{control.flecha}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
