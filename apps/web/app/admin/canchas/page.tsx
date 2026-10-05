import type { Metadata } from "next";

import { AvisoSoloAdmin } from "@/components/admin/aviso-solo-admin";
import { BotonDeBaja } from "@/components/admin/boton-de-baja";
import { EncabezadoAdmin, MAIN_ADMIN } from "@/components/admin/encabezado-admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { pantallaDeErrorAdmin, sesionDeOtroRol } from "@/lib/admin";
import { apiFetch } from "@/lib/api/client";
import type { Cancha, Disciplina } from "@/lib/api/types";
import { precioLegible } from "@/lib/club";
import { leerToken } from "@/lib/sesion";
import { cambiarEstadoCancha } from "./acciones";
import { FormularioCancha } from "./formulario-cancha";

export const metadata: Metadata = { title: "Canchas y precios — Deploy" };

const RUTA = "/admin/canchas";

/** `/admin/canchas` (RF-12): todas las canchas, también las dadas de baja, con alta, edición y baja. */
export default async function PaginaCanchasAdmin() {
  if (await sesionDeOtroRol()) {
    return (
      <main className={MAIN_ADMIN}>
        <AvisoSoloAdmin />
      </main>
    );
  }

  let canchas: Cancha[];
  let disciplinas: Disciplina[];
  try {
    const token = await leerToken();
    [canchas, disciplinas] = await Promise.all([
      apiFetch<Cancha[]>("/canchas?incluirInactivas=true", { token, timeoutMs: 2000 }),
      apiFetch<Disciplina[]>("/disciplinas", { timeoutMs: 2000 }),
    ]);
  } catch (error) {
    return (
      <main className={MAIN_ADMIN}>
        {pantallaDeErrorAdmin(error, {
          ruta: RUTA,
          mensaje: "No pudimos cargar las canchas. Probá de nuevo en unos segundos.",
        })}
      </main>
    );
  }

  const duracion = new Map(disciplinas.map((d) => [d.id, d.duracionTurnoMin]));
  // Activas primero; dentro de cada grupo, por disciplina y nombre.
  const ordenadas = [...canchas].sort(
    (a, b) =>
      Number(b.activa) - Number(a.activa) ||
      (a.disciplina ?? "").localeCompare(b.disciplina ?? "", "es") ||
      a.nombre.localeCompare(b.nombre, "es"),
  );

  return (
    <main className={MAIN_ADMIN}>
      <EncabezadoAdmin
        titulo="Canchas y precios"
        bajada="Cambiar un precio afecta solo a las reservas nuevas. Las ya confirmadas conservan el monto original."
      />

      <Card>
        <CardTitle>Nueva cancha</CardTitle>
        <div className="mt-4">
          <FormularioCancha disciplinas={disciplinas} />
        </div>
      </Card>

      <ul className="mt-6 flex flex-col gap-4" aria-label="Canchas">
        {ordenadas.map((cancha) => {
          const minutos = duracion.get(cancha.disciplinaId);
          const detalle = [
            cancha.disciplina,
            cancha.superficie,
            cancha.techada ? "techada" : "descubierta",
            minutos ? `turnos de ${minutos} min` : null,
          ].filter(Boolean);

          return (
            <li key={cancha.id}>
              <Card className={cancha.activa ? "" : "opacity-80"}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-display text-lg font-semibold">{cancha.nombre}</h2>
                      {cancha.activa ? (
                        <Badge tone="accent">Activa</Badge>
                      ) : (
                        <Badge tone="danger">Dada de baja</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-text-muted">{detalle.join(" · ")}</p>
                  </div>
                  <div className="flex items-start gap-4">
                    <span className="font-display text-xl font-semibold text-accent">
                      {precioLegible(cancha.precioPorTurno)}
                    </span>
                    <BotonDeBaja
                      id={cancha.id}
                      activo={cancha.activa ?? true}
                      campo="activa"
                      nombre={cancha.nombre}
                      accion={cambiarEstadoCancha}
                    />
                  </div>
                </div>

                <details className="mt-4 border-t border-border-subtle pt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-text-muted hover:text-accent">
                    Editar {cancha.nombre}
                  </summary>
                  <div className="mt-4">
                    <FormularioCancha disciplinas={disciplinas} cancha={cancha} />
                  </div>
                </details>
              </Card>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
