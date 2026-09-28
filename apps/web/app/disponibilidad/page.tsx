import type { Metadata } from "next";
import Form from "next/form";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EstadoError } from "@/components/ui/estado-error";
import { Input } from "@/components/ui/input";
import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Cancha, Disciplina, DisponibilidadResponse } from "@/lib/api/types";
import { ahoraEnElClub, esFechaValida, fechaLegible } from "@/lib/club";
import { aMinutos } from "@/lib/grilla";
import { obtenerUsuario } from "@/lib/sesion";
import { AvisoSocio } from "./aviso-socio";
import { GrillaCancha } from "./grilla-cancha";

export const metadata: Metadata = { title: "Disponibilidad — Deploy" };

// Tipo explícito: `PageProps<"/disponibilidad">` recién existe después del primer build.
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const soloTexto = (valor: string | string[] | undefined) =>
  typeof valor === "string" ? valor : undefined;

/**
 * Qué fecha consultar y qué avisar. Una fecha pasada o inválida en la URL no
 * se manda a la API: se muestra hoy con un aviso (spec: "Fecha anterior a hoy").
 */
function resolverFecha(pedida: string | undefined, hoy: string) {
  if (pedida === undefined) return { fecha: hoy, aviso: null };
  if (!esFechaValida(pedida)) {
    return { fecha: hoy, aviso: "Esa fecha no es válida: te mostramos la disponibilidad de hoy." };
  }
  if (pedida < hoy) {
    return { fecha: hoy, aviso: "Esa fecha ya pasó: te mostramos la disponibilidad de hoy." };
  }
  return { fecha: pedida, aviso: null };
}

export default async function PaginaDisponibilidad({ searchParams }: Props) {
  const params = await searchParams;
  const ahora = ahoraEnElClub();
  const { fecha, aviso } = resolverFecha(soloTexto(params.fecha), ahora.fecha);

  const disciplinaIdPedida = Number(soloTexto(params.disciplinaId));
  const disciplinaId =
    Number.isInteger(disciplinaIdPedida) && disciplinaIdPedida > 0 ? disciplinaIdPedida : undefined;

  // Una sola query: la usan la llamada a la API, "Reintentar" y el `volver` del aviso.
  const consulta = new URLSearchParams({ fecha });
  if (disciplinaId) consulta.set("disciplinaId", String(disciplinaId));
  const consultaActual = `/disponibilidad?${consulta}`;

  let disciplinas: Disciplina[];
  let canchas: Cancha[];
  let disponibilidad: DisponibilidadResponse;
  let usuarioConSesion: boolean;
  try {
    const [listaDisciplinas, listaCanchas, respuesta, usuario] = await Promise.all([
      apiFetch<Disciplina[]>("/disciplinas", { timeoutMs: 2000 }),
      // Para saber la disciplina (por id) de cada cancha: la respuesta de
      // disponibilidad solo trae el nombre.
      apiFetch<Cancha[]>("/canchas", { timeoutMs: 2000 }),
      apiFetch<DisponibilidadResponse>(consultaActual, { timeoutMs: 2000 }),
      obtenerUsuario(),
    ]);
    disciplinas = listaDisciplinas;
    canchas = listaCanchas;
    disponibilidad = respuesta;
    usuarioConSesion = usuario !== null;
  } catch (error) {
    if (!(error instanceof ApiHttpError)) throw error;
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <EstadoError
          titulo="No pudimos consultar la disponibilidad"
          mensaje="La API no respondió a tiempo. Probá de nuevo en unos segundos."
          reintentarHref={consultaActual}
        />
      </main>
    );
  }

  // La grilla se dibuja con la duración del turno de la disciplina de cada cancha,
  // resuelta por id. Si algo no matchea, la duración sale del primer turno libre,
  // que la API calculó con la misma grilla; nunca se asume un valor.
  const duracionPorDisciplina = new Map(disciplinas.map((d) => [d.id, d.duracionTurnoMin]));
  const disciplinaPorCancha = new Map(canchas.map((c) => [c.id, c.disciplinaId]));
  const duracionDe = (cancha: DisponibilidadResponse["canchas"][number]): number | undefined => {
    const porId = duracionPorDisciplina.get(disciplinaPorCancha.get(cancha.canchaId) ?? -1);
    if (porId) return porId;
    const primero = cancha.slots[0];
    return primero ? aMinutos(primero.horaFin) - aMinutos(primero.horaInicio) : undefined;
  };
  const esHoy = fecha === ahora.fecha;

  const grilla = disponibilidad.canchas.map((cancha) => {
    const duracionMin = duracionDe(cancha);
    return duracionMin ? (
      <GrillaCancha
        key={cancha.canchaId}
        cancha={cancha}
        duracionMin={duracionMin}
        fecha={fecha}
        esHoy={esHoy}
        horaAhora={ahora.hora}
        conSesion={usuarioConSesion}
      />
    ) : (
      <Card key={cancha.canchaId}>
        <CardTitle>{cancha.nombre}</CardTitle>
        <p className="mt-1 text-sm text-text-muted">Sin turnos libres para esta fecha.</p>
      </Card>
    );
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Disponibilidad</h1>
        <p className="mt-2 max-w-2xl text-text-muted">
          Elegís el día, tocás un horario libre y listo. Ver los horarios es abierto a todos;
          para reservar hace falta una cuenta de socio.
        </p>
      </header>

      {/* GET con navegación del lado del cliente y sin JavaScript propio. */}
      <Form
        action="/disponibilidad"
        className="mb-8 flex flex-wrap items-end gap-3 rounded-[20px] border border-border bg-surface-raised p-4"
      >
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Fecha
          <Input
            type="date"
            name="fecha"
            min={ahora.fecha}
            defaultValue={fecha}
            required
            className="sm:w-48"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Disciplina
          <select
            name="disciplinaId"
            defaultValue={disciplinaId ?? ""}
            className="min-h-12 rounded-xl border border-border-strong bg-surface-input px-3.5 text-[15px] text-text focus:border-accent focus:outline-none sm:w-48"
          >
            <option value="">Todas</option>
            {disciplinas.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Ver turnos</Button>
      </Form>

      {aviso ? (
        <p role="status" className="mb-6 rounded-xl border border-gold/40 px-4 py-3 text-sm text-gold">
          {aviso}
        </p>
      ) : null}

      <h2 className="mb-4 font-display text-xl font-semibold capitalize">{fechaLegible(fecha)}</h2>

      {disponibilidad.canchas.length === 0 ? (
        <p className="text-text-muted">No hay canchas activas para esa consulta.</p>
      ) : usuarioConSesion ? (
        <div className="flex flex-col gap-6">{grilla}</div>
      ) : (
        <AvisoSocio volver={consultaActual}>
          <div className="flex flex-col gap-6">{grilla}</div>
        </AvisoSocio>
      )}
    </main>
  );
}
