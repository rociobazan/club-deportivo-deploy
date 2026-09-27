/**
 * Las capas decorativas del hero de Inicio, sin foto: orbes difusos que derivan,
 * un haz que cruza y el degradé que cierra contra el fondo de la página.
 *
 * Está aparte de `page.tsx` porque es puro adorno: nada de acá se lee ni se
 * toca, y mezclado con el contenido tapaba la estructura de la pantalla.
 *
 * Los `rgb()` literales son `--accent` y `--accent-hover` con alfa: un gradiente
 * no puede tomar la variable y cambiarle la opacidad sin color-mix, que no vale
 * el riesgo para un adorno.
 */

/** Los orbes se mueven con `transform` para que la animación corra en la GPU. */
const ORBES = [
  {
    clave: "a",
    animacion: "dpy-orbe-a 22s ease-in-out infinite",
    estilo: {
      width: "60vw",
      height: "60vw",
      maxWidth: 820,
      maxHeight: 820,
      right: "-12%",
      top: "-22%",
      background:
        "radial-gradient(circle, rgb(0 229 143 / 0.3), rgb(0 229 143 / 0.06) 55%, transparent 72%)",
    },
  },
  {
    clave: "b",
    animacion: "dpy-orbe-b 28s ease-in-out infinite",
    estilo: {
      width: "48vw",
      height: "48vw",
      maxWidth: 640,
      maxHeight: 640,
      left: "-14%",
      bottom: "-10%",
      background:
        "radial-gradient(circle, rgb(123 255 203 / 0.16), rgb(0 229 143 / 0.04) 55%, transparent 72%)",
    },
  },
  {
    clave: "c",
    animacion: "dpy-orbe-c 34s ease-in-out infinite",
    estilo: {
      width: "34vw",
      height: "34vw",
      maxWidth: 460,
      maxHeight: 460,
      left: "38%",
      top: "18%",
      background: "radial-gradient(circle, rgb(255 255 255 / 0.05), transparent 70%)",
    },
  },
] as const;

export function FondoHero() {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-bg" />

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {ORBES.map((orbe) => (
          <div
            key={orbe.clave}
            className="absolute rounded-full blur-[60px] will-change-transform"
            style={{ ...orbe.estilo, animation: orbe.animacion }}
          />
        ))}

        <div
          className="absolute left-0 top-[-20%] h-[140%] w-[18%] will-change-transform"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgb(0 229 143 / 0.07), transparent)",
            animation: "dpy-haz 18s linear infinite",
            animationDelay: "3s",
          }}
        />
      </div>

      {/* Cierra contra `--bg` para que el panel de disciplinas pise sin costura. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgb(6 8 7 / 0.2) 0%, transparent 40%, rgb(6 8 7 / 0.7) 78%, var(--bg) 100%)",
        }}
      />
    </>
  );
}
