import { Logo } from "@/components/layout/logo";
import { CLUB, HORARIO_LINEAS } from "@/lib/club-datos";

const columnas = [
  {
    titulo: "Horarios",
    lineas: [...HORARIO_LINEAS, CLUB.buffet],
  },
  {
    titulo: "Dónde estamos",
    lineas: [CLUB.direccion, CLUB.barrio],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-black px-5 pb-8 pt-10">
      <div className="mx-auto grid w-full max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-sm text-text-muted">{CLUB.descripcion}</p>
        </div>

        {columnas.map((columna) => (
          <div key={columna.titulo} className="flex flex-col gap-2">
            <h2 className="font-display text-sm font-semibold">
              {columna.titulo}
            </h2>
            {columna.lineas.map((linea) => (
              <p key={linea} className="text-sm text-text-muted">
                {linea}
              </p>
            ))}
          </div>
        ))}

        <div className="flex flex-col gap-2">
          <h2 className="font-display text-sm font-semibold">Contacto</h2>
          <a
            href={CLUB.telefonoLink}
            className="text-sm text-text-muted hover:text-accent"
          >
            {CLUB.telefono}
          </a>
          <a
            href={`mailto:${CLUB.email}`}
            className="text-sm text-text-muted hover:text-accent"
          >
            {CLUB.email}
          </a>
        </div>
      </div>
    </footer>
  );
}
