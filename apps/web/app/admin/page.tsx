import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";

import { AvisoSoloAdmin } from "@/components/admin/aviso-solo-admin";
import { EncabezadoAdmin, MAIN_ADMIN } from "@/components/admin/encabezado-admin";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { pantallaDeErrorAdmin, sesionDeOtroRol } from "@/lib/admin";
import { apiFetch } from "@/lib/api/client";
import type { PanelAdmin } from "@/lib/api/types";
import { ahoraEnElClub, esFechaValida, fechaLegible, precioLegible } from "@/lib/club";
import { leerToken } from "@/lib/sesion";

export const metadata: Metadata = { title: "Panel del club — Deploy" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * `/admin` (RF-11). La fecha va en la dirección y se cambia con un `<Form>`
 * GET, como la disponibilidad: sin estado en el cliente. Una fecha inválida no
 * se manda a la API; se muestra hoy con un aviso.
 */
export default async function PaginaPanel({ searchParams }: Props) {
  if (await sesionDeOtroRol()) {
    return (
      <main className={MAIN_ADMIN}>
        <AvisoSoloAdmin />
      </main>
    );
  }

  const { fecha: pedida } = await searchParams;
  const fechaValida = typeof pedida === "string" && esFechaValida(pedida);
  const ruta = fechaValida ? `/admin?fecha=${pedida}` : "/admin";

  let panel: PanelAdmin;
  try {
    // Sin una fecha pedida no se manda ninguna: "hoy" lo decide la API con su
    // reloj, que es el mismo que filtra los turnos que ya empezaron. Con el
    // reloj del sitio, cerca de la medianoche podían no coincidir.
    panel = await apiFetch<PanelAdmin>(fechaValida ? `/admin/panel?fecha=${pedida}` : "/admin/panel", {
      token: await leerToken(),
      timeoutMs: 2000,
    });
  } catch (error) {
    return (
      <main className={MAIN_ADMIN}>
        {pantallaDeErrorAdmin(error, {
          ruta,
          mensaje: "No pudimos cargar el panel. Probá de nuevo en unos segundos.",
        })}
      </main>
    );
  }

  const fecha = panel.fecha;
  const esHoy = !fechaValida || fecha === ahoraEnElClub().fecha;
  const metricas = [
    {
      titulo: "Reservas del día",
      valor: String(panel.reservasDelDia),
      detalle: `${panel.reservasDiaAnterior} el día anterior`,
    },
    {
      titulo: "Facturación prevista",
      valor: precioLegible(panel.facturacionPrevista),
      detalle: "a cobrar en el club",
    },
    {
      titulo: "Ocupación del día",
      valor: `${panel.ocupacionDelDia}%`,
      detalle: `${panel.ocupacionPromedioSemanal}% promedio de 7 días`,
    },
    {
      titulo: "Cancelaciones",
      valor: String(panel.cancelacionesDelDia),
      detalle: `${panel.cancelacionesDentroDelPlazo} dentro del plazo`,
    },
  ];

  return (
    <main className={MAIN_ADMIN}>
      <EncabezadoAdmin
        titulo="Panel del club"
        bajada={`${fechaLegible(fecha)}${esHoy ? " · datos del día en curso" : ""}`}
      />

      <Form
        action="/admin"
        className="mb-8 flex flex-wrap items-end gap-3 rounded-[20px] border border-border bg-surface-raised p-4"
      >
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Fecha
          <Input type="date" name="fecha" defaultValue={fecha} required className="sm:w-48" />
        </label>
        <Button type="submit">Ver panel</Button>
        {!esHoy ? (
          <Link href="/admin" className={buttonClasses("ghost")}>
            Volver a hoy
          </Link>
        ) : null}
      </Form>

      {pedida !== undefined && !fechaValida ? (
        <p role="status" className="mb-6 rounded-xl border border-gold/40 px-4 py-3 text-sm text-gold">
          Esa fecha no es válida: te mostramos el panel de hoy.
        </p>
      ) : null}

      <section aria-label="Métricas del día" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricas.map((m) => (
          <Card key={m.titulo} className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-text-subtle">{m.titulo}</span>
            <span className="font-display text-3xl font-semibold text-text">{m.valor}</span>
            <span className="text-sm text-text-muted">{m.detalle}</span>
          </Card>
        ))}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <CardTitle>Ocupación por cancha</CardTitle>
            <span className="text-xs text-text-subtle">canchas activas · últimos 7 días</span>
          </div>
          <ul className="mt-5 flex flex-col gap-4">
            {panel.ocupacionPorCancha.map((cancha) => (
              <li key={cancha.canchaId}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-text">
                    {cancha.nombre} <span className="text-text-subtle">· {cancha.disciplina}</span>
                  </span>
                  <span className="font-semibold text-text">{cancha.porcentaje}%</span>
                </div>
                {/* Decorativa: el porcentaje ya está escrito al lado. */}
                <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-surface-input">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${cancha.porcentaje}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col">
          <CardTitle>{esHoy ? "Próximos turnos de hoy" : "Turnos del día"}</CardTitle>
          {panel.proximosTurnos.length === 0 ? (
            <p className="mt-4 text-sm text-text-muted">
              {esHoy
                ? "No quedan turnos por delante hoy."
                : "No hay turnos reservados ese día."}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-border-subtle">
              {panel.proximosTurnos.map((turno) => (
                <li key={turno.reservaId}>
                  <Link
                    href={`/admin/reservas/${turno.reservaId}`}
                    className="flex items-center gap-4 py-3 hover:text-accent"
                  >
                    <span className="font-display text-lg font-semibold text-accent">
                      {turno.horaInicio}
                    </span>
                    <span className="flex flex-col text-sm">
                      <span className="text-text">
                        {turno.cancha} · {turno.disciplina}
                      </span>
                      <span className="text-text-muted">
                        {turno.cliente}
                        {turno.cantidadJugadores ? ` · ${turno.cantidadJugadores} jugadores` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto pt-5">
            <Link href={`/admin/reservas?fecha=${fecha}`} className={buttonClasses("secondary")}>
              Ver todas las reservas
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
