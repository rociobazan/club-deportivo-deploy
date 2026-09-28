/**
 * El lenguaje visual del sitio institucional, en un solo lugar: Inicio, El club
 * y Contacto comparten ancho, aire lateral, escala de títulos y píldoras. Si
 * cada página se lo escribe aparte, se separan en el primer retoque.
 *
 * Son cadenas de clases y no componentes a propósito: lo que se repite es el
 * estilo, no la estructura, y cada página arma su propio marcado.
 */

/** Ancho máximo y aire lateral de todas las secciones. */
export const CONTENEDOR = "mx-auto w-full max-w-[1280px] px-[clamp(16px,4vw,40px)]";

/** El renglón verde en versales que abre cada sección. */
export const KICKER =
  "text-[13px] font-semibold uppercase tracking-[0.12em] text-accent-hover";

/** Título de sección. Para el de portada de una página va `TITULO_PORTADA`. */
export const TITULO_SECCION =
  "font-display text-[clamp(34px,4.4vw,58px)] font-semibold leading-[1.02] tracking-[-0.03em] text-balance";

/** Un escalón más grande, para el `h1` de El club y Contacto. */
export const TITULO_PORTADA =
  "font-display text-[clamp(40px,6vw,76px)] font-semibold leading-[1.02] tracking-[-0.03em] text-balance";

/**
 * Las píldoras grandes del sitio institucional. `buttonClasses` define la escala
 * de 44 px que usan los formularios y el panel; acá hace falta la de 56.
 */
export const PILDORA = {
  primaria:
    "inline-flex h-14 items-center gap-2.5 rounded-full bg-accent px-7 font-display text-[17px] font-semibold text-text-on-accent transition-all hover:-translate-y-px hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  secundaria:
    "inline-flex h-14 items-center rounded-full border border-border-strong px-6 font-display text-[17px] font-semibold text-text transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  media:
    "inline-flex h-[52px] items-center gap-2.5 rounded-full bg-accent px-6 font-display text-base font-semibold text-text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
};

/** El cuadrado con el icono verde, en su tamaño chico y en el grande. */
export const TILE_ICONO =
  "grid size-11 shrink-0 place-items-center rounded-[14px] bg-accent/[0.12] text-accent";

export const TILE_ICONO_GRANDE =
  "grid size-12 shrink-0 place-items-center rounded-2xl border border-border bg-surface-raised text-accent";

/** Dos columnas que se apilan solas cuando no entran 340 px de cada lado. */
export const DOS_COLUMNAS = {
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
};

/** El aire vertical entre secciones grandes. */
export const SEPARACION_SECCION = "pt-[clamp(72px,9vw,128px)]";
