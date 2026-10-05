import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";

import { AvisoSoloAdmin } from "@/components/admin/aviso-solo-admin";
import { EncabezadoAdmin, MAIN_ADMIN } from "@/components/admin/encabezado-admin";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { iniciales } from "@/components/layout/navegacion";
import { badgeDe } from "@/app/mis-reservas/badge-de-reserva";
import { pantallaDeErrorAdmin, sesionDeOtroRol } from "@/lib/admin";
import { apiFetch } from "@/lib/api/client";
import type { Reserva } from "@/lib/api/types";
import { esFechaValida, fechaLegible, precioLegible } from "@/lib/club";
import { leerToken } from "@/lib/sesion";

export const metadata: Metadata = { title: "Reservas de socios — Deploy" };

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const soloTexto = (valor: string | string[] | undefined) =>
  typeof valor === "string" ? valor.trim() : "";

/** Los filtros del prototipo. "Activas" es `CONFIRMADA`: la API ya excluye las que terminaron. */
const FILTROS = [
  { valor: "", etiqueta: "Todas" },
  { valor: "activas", etiqueta: "Activas", estado: "CONFIRMADA" },
  { valor: "canceladas", etiqueta: "Canceladas", estado: "CANCELADA" },
] as const;

/** Sin mayúsculas ni acentos: "jose" encuentra a "José". */
const normalizar = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * `/admin/reservas`: las reservas de todos los socios. `estado` y `fecha` van a
 * `GET /reservas`; la búsqueda `q` se aplica acá sobre la respuesta, porque el
 * contrato no tiene búsqueda de texto (design.md, decisión 8). Los tres viven
 * en la dirección, así el listado filtrado se puede recargar o compartir.
 */
export default async function PaginaReservasAdmin({ searchParams }: Props) {
  if (await sesionDeOtroRol()) {
    return (
      <main className={MAIN_ADMIN}>
        <AvisoSoloAdmin />
      </main>
    );
  }

  const params = await searchParams;
  const filtro = FILTROS.find((f) => f.valor === soloTexto(params.estado)) ?? FILTROS[0];
  const fechaPedida = soloTexto(params.fecha);
  const fecha = esFechaValida(fechaPedida) ? fechaPedida : "";
  const q = soloTexto(params.q);

  // La misma consulta arma la llamada, los links de los filtros y "Reintentar".
  const consulta = (cambios: Record<string, string> = {}) => {
    const valores = { estado: filtro.valor, fecha, q, ...cambios };
    const query = new URLSearchParams(Object.entries(valores).filter(([, v]) => v !== ""));
    return query.size > 0 ? `/admin/reservas?${query}` : "/admin/reservas";
  };

  const aLaApi = new URLSearchParams();
  if ("estado" in filtro) aLaApi.set("estado", filtro.estado);
  if (fecha) aLaApi.set("fecha", fecha);

  let reservas: Reserva[];
  try {
    reservas = await apiFetch<Reserva[]>(`/reservas${aLaApi.size > 0 ? `?${aLaApi}` : ""}`, {
      token: await leerToken(),
      timeoutMs: 2000,
    });
  } catch (error) {
    return (
      <main className={MAIN_ADMIN}>
        {pantallaDeErrorAdmin(error, {
          ruta: consulta(),
          mensaje: "No pudimos cargar las reservas. Probá de nuevo en unos segundos.",
        })}
      </main>
    );
  }

  const buscado = normalizar(q);
  const visibles = buscado
    ? reservas.filter(
        (r) => normalizar(r.cliente ?? "").includes(buscado) || normalizar(r.codigo).includes(buscado),
      )
    : reservas;

  return (
    <main className={MAIN_ADMIN}>
      <EncabezadoAdmin
        titulo="Reservas de socios"
        bajada="Podés cancelar cualquier turno que todavía no terminó, sin el límite de anticipación de los socios."
      />

      <nav aria-label="Filtrar por estado" className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const activo = f.valor === filtro.valor;
          return (
            <Link
              key={f.etiqueta}
              href={consulta({ estado: f.valor })}
              aria-current={activo ? "page" : undefined}
              className={buttonClasses(activo ? "primary" : "secondary", "min-h-9 px-4")}
            >
              {f.etiqueta}
            </Link>
          );
        })}
      </nav>

      <Form
        action="/admin/reservas"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-[20px] border border-border bg-surface-raised p-4"
      >
        {filtro.valor ? <input type="hidden" name="estado" value={filtro.valor} /> : null}
        <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm font-semibold">
          Buscar
          <Input type="search" name="q" defaultValue={q} placeholder="Socio o código" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Fecha
          <Input type="date" name="fecha" defaultValue={fecha} className="sm:w-48" />
        </label>
        <Button type="submit">Buscar</Button>
        {q || fecha ? (
          <Link href={consulta({ q: "", fecha: "" })} className={buttonClasses("ghost")}>
            Limpiar
          </Link>
        ) : null}
      </Form>

      {visibles.length === 0 ? (
        <Card className="text-center">
          <p className="text-text-muted">No hay reservas que coincidan con la búsqueda.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Reservas">
          {visibles.map((reserva) => {
            const badge = badgeDe(reserva.estado);
            return (
              <li key={reserva.id}>
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border-strong text-sm font-semibold text-accent"
                    >
                      {iniciales(reserva.cliente ?? "")}
                    </span>
                    <div>
                      <p className="font-semibold text-text">{reserva.cliente}</p>
                      <p className="text-sm text-text-muted">
                        {reserva.codigo} · {reserva.cancha}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-text">
                    {fechaLegible(reserva.fecha)} · {reserva.horaInicio}
                  </p>
                  <div className="flex items-center gap-3">
                    <Badge tone={badge.tone}>{badge.texto}</Badge>
                    <span className="font-semibold text-text">{precioLegible(reserva.montoTotal)}</span>
                    <Link
                      href={`/admin/reservas/${reserva.id}`}
                      className={buttonClasses("secondary", "min-h-9 px-4")}
                      aria-label={`Ver detalle de ${reserva.codigo}`}
                    >
                      Ver detalle
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
