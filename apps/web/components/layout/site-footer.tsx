import { Logo } from "@/components/layout/logo";

const columnas = [
  {
    titulo: "Horarios",
    lineas: ["Todos los días de 8 a 23", "Buffet hasta el último turno"],
  },
  {
    titulo: "Dónde estamos",
    lineas: ["Rivadeo 1480", "Barrio General Paz, Córdoba"],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-black px-5 pb-8 pt-10">
      <div className="mx-auto grid w-full max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-sm text-text-muted">
            Club deportivo de barrio. Tenis, pádel y fútbol 5 en General Paz,
            Córdoba.
          </p>
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
            href="tel:+543514827719"
            className="text-sm text-text-muted hover:text-accent"
          >
            351 482 7719
          </a>
          <a
            href="mailto:hola@clubdeploy.com.ar"
            className="text-sm text-text-muted hover:text-accent"
          >
            hola@clubdeploy.com.ar
          </a>
        </div>
      </div>
    </footer>
  );
}
