import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { CLUB, HORARIO } from "@/lib/club-datos";
import { CONTACTO } from "@/lib/contenido-institucional";
import { FormularioContacto } from "./formulario-contacto";

export const metadata: Metadata = {
  title: "Contacto — Deploy",
  description: `Escribinos, llamanos al ${CLUB.telefono} o pasá por ${CLUB.direccion}, ${CLUB.barrio}.`,
};

/**
 * El formulario es lo único que habla con la API. Los datos del club son
 * estáticos y quedan a la vista siempre, también cuando el envío falla: es lo
 * que pide el requisito del formulario, para que la persona igual pueda
 * escribir o llamar.
 */
export default function PaginaContacto() {
  const datos = [
    { etiqueta: "Dirección", valor: CLUB.direccion, nota: CLUB.barrio },
    {
      etiqueta: "Teléfono",
      valor: CLUB.telefono,
      nota: CONTACTO.notas.telefono,
      href: CLUB.telefonoLink,
    },
    {
      etiqueta: "Mail",
      valor: CLUB.email,
      nota: CONTACTO.notas.email,
      href: `mailto:${CLUB.email}`,
    },
    { etiqueta: "Horarios", valor: HORARIO, nota: CLUB.buffet },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          {CONTACTO.eyebrow}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
          {CONTACTO.titulo}
        </h1>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="formulario">
          <h2 id="formulario" className="sr-only">
            Formulario de contacto
          </h2>
          <FormularioContacto />
        </section>

        <section aria-labelledby="datos">
          <h2 id="datos" className="mb-4 font-display text-lg font-semibold">
            Dónde encontrarnos
          </h2>
          <Card>
            <dl className="flex flex-col gap-5">
              {datos.map((dato) => (
                <div key={dato.etiqueta}>
                  <dt className="text-sm font-semibold text-text-muted">
                    {dato.etiqueta}
                  </dt>
                  <dd className="mt-0.5">
                    {dato.href ? (
                      <a href={dato.href} className="text-text hover:text-accent">
                        {dato.valor}
                      </a>
                    ) : (
                      <span className="text-text">{dato.valor}</span>
                    )}
                    <span className="block text-sm text-text-subtle">{dato.nota}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      </div>
    </main>
  );
}
