import Link from "next/link";

import { Card, CardTitle } from "@/components/ui/card";
import type { DisponibilidadResponse } from "@/lib/api/types";
import { HORA_APERTURA, HORA_CIERRE, precioLegible } from "@/lib/club";
import { estadoDeBloque, generarGrilla, type EstadoDeBloque } from "@/lib/grilla";

/** La forma del contrato, donde `disciplina` es opcional. */
type Cancha = DisponibilidadResponse["canchas"][number];

const ETIQUETA: Record<EstadoDeBloque, string> = {
  libre: "Libre",
  ocupada: "Ocupada",
  pasado: "Pasado",
};

const base =
  "flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 py-2 text-sm leading-tight";

const estilo: Record<EstadoDeBloque, string> = {
  libre:
    "border-accent/40 bg-accent/10 text-text hover:border-accent hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  ocupada: "border-border bg-surface text-text-subtle",
  pasado: "border-border-subtle bg-surface text-text-subtle opacity-60",
};

/**
 * La grilla completa del club para una cancha: lo que la API devolvió es
 * Libre, lo que ya empezó (si es hoy) es Pasado y el resto está Ocupada.
 * Con sesión, un bloque libre lleva a reservar; sin sesión, el clic lo captura
 * `AvisoSocio` por el atributo `data-turno-libre`.
 */
export function GrillaCancha({
  cancha,
  duracionMin,
  fecha,
  esHoy,
  horaAhora,
  conSesion,
}: {
  cancha: Cancha;
  duracionMin: number;
  fecha: string;
  esHoy: boolean;
  horaAhora: string;
  conSesion: boolean;
}) {
  const libres = new Set(cancha.slots.map((s) => s.horaInicio));
  const bloques = generarGrilla(HORA_APERTURA, HORA_CIERRE, duracionMin);
  const cantidadLibres = libres.size;

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardTitle>{cancha.nombre}</CardTitle>
          <p className="text-sm text-text-muted">
            {cancha.disciplina ? `${cancha.disciplina} · ` : ""}turnos de {duracionMin} min ·{" "}
            <span className="text-text">{precioLegible(cancha.precioPorTurno)}</span> por turno
          </p>
        </div>
        <p className="text-sm text-text-muted">
          {cantidadLibres === 0
            ? "Sin turnos libres"
            : `${cantidadLibres} ${cantidadLibres === 1 ? "turno libre" : "turnos libres"}`}
        </p>
      </div>

      <ul
        className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5"
        aria-label={`Turnos de ${cancha.nombre}`}
      >
        {bloques.map((bloque) => {
          const estado = estadoDeBloque(bloque, libres, esHoy, horaAhora);
          const contenido = (
            <>
              <span className="font-semibold">{bloque.horaInicio}</span>
              <span className="text-[11px] uppercase tracking-wide opacity-80">
                {ETIQUETA[estado]}
              </span>
            </>
          );

          return (
            <li key={bloque.horaInicio}>
              {estado !== "libre" ? (
                <span className={`${base} ${estilo[estado]}`} aria-disabled>
                  {contenido}
                </span>
              ) : conSesion ? (
                <Link
                  href={`/reservar?canchaId=${cancha.canchaId}&fecha=${fecha}&horaInicio=${bloque.horaInicio}`}
                  className={`${base} ${estilo.libre}`}
                  aria-label={`Reservar ${cancha.nombre} el ${fecha} a las ${bloque.horaInicio}`}
                >
                  {contenido}
                </Link>
              ) : (
                <button
                  type="button"
                  data-turno-libre
                  className={`${base} ${estilo.libre} w-full`}
                  aria-label={`Turno libre ${bloque.horaInicio} en ${cancha.nombre}: hace falta ser socio para reservar`}
                >
                  {contenido}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
