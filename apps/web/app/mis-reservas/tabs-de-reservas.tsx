"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { Reserva } from "@/lib/api/types";
import { fechaLegible, precioLegible } from "@/lib/club";
import { badgeDe } from "./badge-de-reserva";

type Tab = "activas" | "historial";

/**
 * Activas e historial se separan sobre la misma respuesta de `GET /reservas`,
 * sin volver a pedirla (design.md, decisión 4). Estado de UI puro: la pestaña
 * elegida no es algo que el servidor necesite saber.
 */
export function TabsDeReservas({ reservas }: { reservas: Reserva[] }) {
  const [tab, setTab] = useState<Tab>("activas");

  if (reservas.length === 0) {
    return (
      <Card className="border-dashed py-14 text-center">
        <CardTitle>Nada por acá todavía</CardTitle>
        <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
          Cuando reserves un turno lo vas a ver en esta lista, con su código y el monto.
        </p>
      </Card>
    );
  }

  const activas = reservas.filter((r) => r.estado === "CONFIRMADA");
  const historial = reservas.filter((r) => r.estado !== "CONFIRMADA");
  const visibles = tab === "activas" ? activas : historial;

  return (
    <div>
      <div className="flex gap-2" role="tablist">
        {(
          [
            ["activas", `Activas (${activas.length})`],
            ["historial", `Historial (${historial.length})`],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={tab === valor}
            onClick={() => setTab(valor)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === valor
                ? "bg-accent text-text-on-accent"
                : "border border-border-strong text-text-muted hover:text-text"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="mt-6 text-sm text-text-muted">No hay reservas en esta pestaña.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {visibles.map((reserva) => {
            const badge = badgeDe(reserva.estado);
            return (
              <li key={reserva.id}>
                <Card className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{reserva.cancha}</CardTitle>
                      <Badge tone={badge.tone}>{badge.texto}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">
                      {fechaLegible(reserva.fecha)} · {reserva.horaInicio} a {reserva.horaFin}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-semibold text-text">
                      {precioLegible(reserva.montoTotal)}
                    </p>
                    <p className="text-xs tracking-wide text-text-subtle">{reserva.codigo}</p>
                    <Link
                      href={`/mis-reservas/${reserva.id}`}
                      className={buttonClasses("secondary", "mt-2")}
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
    </div>
  );
}
