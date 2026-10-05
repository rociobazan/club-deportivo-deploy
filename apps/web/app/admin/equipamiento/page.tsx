import type { Metadata } from "next";

import { AvisoSoloAdmin } from "@/components/admin/aviso-solo-admin";
import { BotonDeBaja } from "@/components/admin/boton-de-baja";
import { EncabezadoAdmin, MAIN_ADMIN } from "@/components/admin/encabezado-admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { pantallaDeErrorAdmin, sesionDeOtroRol } from "@/lib/admin";
import { apiFetch } from "@/lib/api/client";
import type { Disciplina, Equipamiento } from "@/lib/api/types";
import { precioLegible } from "@/lib/club";
import { leerToken } from "@/lib/sesion";
import { cambiarEstadoEquipamiento } from "./acciones";
import { FormularioEquipamiento } from "./formulario-equipamiento";

export const metadata: Metadata = { title: "Equipamiento y stock — Deploy" };

const RUTA = "/admin/equipamiento";

/** `/admin/equipamiento` (RF-13): todo el equipamiento, también el dado de baja, con alta, edición y baja. */
export default async function PaginaEquipamientoAdmin() {
  if (await sesionDeOtroRol()) {
    return (
      <main className={MAIN_ADMIN}>
        <AvisoSoloAdmin />
      </main>
    );
  }

  let items: Equipamiento[];
  let disciplinas: Disciplina[];
  try {
    const token = await leerToken();
    [items, disciplinas] = await Promise.all([
      apiFetch<Equipamiento[]>("/equipamiento?incluirInactivos=true", { token, timeoutMs: 2000 }),
      apiFetch<Disciplina[]>("/disciplinas", { timeoutMs: 2000 }),
    ]);
  } catch (error) {
    return (
      <main className={MAIN_ADMIN}>
        {pantallaDeErrorAdmin(error, {
          ruta: RUTA,
          mensaje: "No pudimos cargar el equipamiento. Probá de nuevo en unos segundos.",
        })}
      </main>
    );
  }

  // `Equipamiento` no trae el nombre de la disciplina: sale del listado de disciplinas.
  const disciplinaDe = new Map(disciplinas.map((d) => [d.id, d.nombre]));
  const ordenados = [...items].sort(
    (a, b) =>
      Number(b.activo) - Number(a.activo) ||
      (disciplinaDe.get(a.disciplinaId) ?? "").localeCompare(disciplinaDe.get(b.disciplinaId) ?? "", "es") ||
      a.nombre.localeCompare(b.nombre, "es"),
  );

  return (
    <main className={MAIN_ADMIN}>
      <EncabezadoAdmin
        titulo="Equipamiento y stock"
        bajada="El stock total es lo que tiene el club. La disponibilidad real se calcula por turno, según lo que ya se alquiló. Cambiar un precio afecta solo a las reservas nuevas."
      />

      <Card>
        <CardTitle>Nuevo ítem</CardTitle>
        <div className="mt-4">
          <FormularioEquipamiento disciplinas={disciplinas} />
        </div>
      </Card>

      <ul className="mt-6 flex flex-col gap-4" aria-label="Equipamiento">
        {ordenados.map((item) => (
          <li key={item.id}>
            <Card className={item.activo ? "" : "opacity-80"}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-lg font-semibold">{item.nombre}</h2>
                    {item.activo ? (
                      <Badge tone="accent">Activo</Badge>
                    ) : (
                      <Badge tone="danger">Dado de baja</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-text-muted">
                    {disciplinaDe.get(item.disciplinaId) ?? "Disciplina inactiva"} · stock{" "}
                    {item.stockTotal}
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <span className="font-display text-xl font-semibold text-accent">
                    {precioLegible(item.precioPorTurno)}
                  </span>
                  <BotonDeBaja
                    id={item.id}
                    activo={item.activo ?? true}
                    campo="activo"
                    nombre={item.nombre}
                    accion={cambiarEstadoEquipamiento}
                  />
                </div>
              </div>

              <details className="mt-4 border-t border-border-subtle pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-text-muted hover:text-accent">
                  Editar {item.nombre}
                </summary>
                <div className="mt-4">
                  <FormularioEquipamiento disciplinas={disciplinas} item={item} />
                </div>
              </details>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
