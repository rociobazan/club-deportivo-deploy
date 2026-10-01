import type { Metadata } from "next";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EstadoError } from "@/components/ui/estado-error";
import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Cancha, Disciplina, Equipamiento } from "@/lib/api/types";
import { esFechaValida, fechaLegible, precioLegible, ventanaDelDia } from "@/lib/club";
import { generarGrilla } from "@/lib/grilla";
import { leerToken } from "@/lib/sesion";
import { FormularioReserva } from "./formulario-reserva";

export const metadata: Metadata = { title: "Reservar un turno — Deploy" };

// Tipo explícito: `PageProps<"/reservar">` recién existe después del primer build.
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const soloTexto = (valor: string | string[] | undefined) =>
  typeof valor === "string" ? valor : undefined;

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * El turno viene en la URL, puesto por la grilla de disponibilidad. Si falta
 * algo o está mal formado, la pantalla lo dice y manda a elegir de nuevo, sin
 * llamar a la API (spec: "Turno ausente o mal formado en la dirección").
 */
function turnoPedido(params: Record<string, string | string[] | undefined>) {
  const canchaId = Number(soloTexto(params.canchaId));
  const fecha = soloTexto(params.fecha);
  const horaInicio = soloTexto(params.horaInicio);

  if (!Number.isInteger(canchaId) || canchaId < 1) return null;
  if (!fecha || !esFechaValida(fecha)) return null;
  if (!horaInicio || !FORMATO_HORA.test(horaInicio)) return null;

  return { canchaId, fecha, horaInicio };
}

/** Marco común: la pantalla siempre renderiza dentro del header y el pie. */
function Marco({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">{children}</main>;
}

function ElegiUnTurno({ mensaje }: { mensaje: string }) {
  return (
    <Marco>
      <Card className="mx-auto max-w-md text-center">
        <CardTitle>Elegí un turno para reservar</CardTitle>
        <p className="mt-2 text-sm text-text-muted">{mensaje}</p>
        <Link href="/disponibilidad" className={buttonClasses("primary", "mt-5")}>
          Ver disponibilidad
        </Link>
      </Card>
    </Marco>
  );
}

export default async function PaginaReservar({ searchParams }: Props) {
  const params = await searchParams;
  const turno = turnoPedido(params);

  if (!turno) {
    return (
      <ElegiUnTurno mensaje="El enlace no trae una cancha, una fecha y un horario válidos. Elegí un turno libre en la grilla." />
    );
  }

  const consultaActual = `/reservar?canchaId=${turno.canchaId}&fecha=${turno.fecha}&horaInicio=${turno.horaInicio}`;

  // El proxy ya exigió sesión para esta ruta; el token es para llamar a la API.
  const token = await leerToken();

  let cancha: Cancha | undefined;
  let disciplina: Disciplina | undefined;
  let equipamiento: Equipamiento[];
  try {
    const [canchas, disciplinas] = await Promise.all([
      apiFetch<Cancha[]>("/canchas", { token, timeoutMs: 2000 }),
      apiFetch<Disciplina[]>("/disciplinas", { token, timeoutMs: 2000 }),
    ]);
    cancha = canchas.find((candidata) => candidata.id === turno.canchaId);
    disciplina = disciplinas.find((candidata) => candidata.id === cancha?.disciplinaId);

    // Con `fecha` y `horaInicio` cada ítem trae `stockDisponible` de ese turno,
    // que es el tope de cada selector. No se recalcula acá.
    equipamiento = cancha
      ? await apiFetch<Equipamiento[]>(
          `/equipamiento?disciplinaId=${cancha.disciplinaId}&fecha=${turno.fecha}&horaInicio=${turno.horaInicio}`,
          { token, timeoutMs: 2000 },
        )
      : [];
  } catch (error) {
    if (!(error instanceof ApiHttpError)) throw error;
    return (
      <Marco>
        <EstadoError
          titulo="No pudimos preparar tu reserva"
          mensaje="La API no respondió a tiempo. Probá de nuevo en unos segundos."
          reintentarHref={consultaActual}
        />
      </Marco>
    );
  }

  // Una cancha inactiva o inexistente no llega en el listado: se trata como un
  // enlace viejo, no como un error.
  if (!cancha || !disciplina) {
    return (
      <ElegiUnTurno mensaje="Esa cancha ya no está disponible. Elegí otro turno en la grilla." />
    );
  }

  // La hora de fin sale de la misma grilla que dibuja la disponibilidad.
  const ventana = ventanaDelDia(turno.fecha);
  const bloque = ventana
    ? generarGrilla(ventana.apertura, ventana.cierre, disciplina.duracionTurnoMin).find(
        (candidato) => candidato.horaInicio === turno.horaInicio,
      )
    : undefined;

  if (!bloque) {
    return (
      <ElegiUnTurno mensaje={`El club no tiene un turno que empiece a las ${turno.horaInicio} ese día. Elegí uno de la grilla.`} />
    );
  }

  return (
    <Marco>
      <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-accent-hover">
        Confirmá tu turno
      </p>
      <h1 className="mt-2 font-display text-[clamp(30px,4vw,44px)] font-semibold leading-[1.05] tracking-[-0.03em]">
        {cancha.nombre} · {disciplina.nombre}
      </h1>

      <Card className="mt-8">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-text-muted">Día</dt>
            <dd className="mt-0.5 font-display text-lg font-semibold first-letter:uppercase">
              {fechaLegible(turno.fecha)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">Turno</dt>
            <dd className="mt-0.5 font-display text-lg font-semibold">
              {bloque.horaInicio} a {bloque.horaFin}
              <span className="ml-2 text-sm font-normal text-text-muted">
                {disciplina.duracionTurnoMin} min
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">Cancha</dt>
            <dd className="mt-0.5 font-display text-lg font-semibold">
              {cancha.superficie ?? disciplina.nombre}
              {cancha.techada ? " · techada" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">Precio del turno</dt>
            <dd className="mt-0.5 font-display text-lg font-semibold">
              {precioLegible(cancha.precioPorTurno)}
            </dd>
          </div>
        </dl>
      </Card>

      <FormularioReserva
        turno={turno}
        precioCancha={cancha.precioPorTurno}
        equipamiento={equipamiento.map((item) => ({
          id: item.id,
          nombre: item.nombre,
          precioPorTurno: item.precioPorTurno,
          // Sin `stockDisponible` (no debería pasar con fecha y hora) se toma el
          // total, y la API rechaza igual si no alcanza.
          disponible: item.stockDisponible ?? item.stockTotal,
        }))}
      />
    </Marco>
  );
}
