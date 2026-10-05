import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AvisoSoloAdmin } from "@/components/admin/aviso-solo-admin";
import { MAIN_ADMIN } from "@/components/admin/encabezado-admin";
import { DetalleDeReserva } from "@/components/reservas/detalle-de-reserva";
import { AccionesDeReserva } from "@/app/mis-reservas/[id]/acciones-de-reserva";
import { pantallaDeErrorAdmin, sesionDeOtroRol } from "@/lib/admin";
import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Reserva } from "@/lib/api/types";
import { leerToken } from "@/lib/sesion";

export const metadata: Metadata = { title: "Detalle de la reserva — Deploy" };

type Props = { params: Promise<{ id: string }> };

/**
 * `/admin/reservas/{id}`: el detalle con el titular, la cancelación **sin** el
 * plazo de RN-04 (la API no se lo aplica a un ADMIN) y el reenvío del mail al
 * titular (RF-14). Comparte la presentación y las Server Functions con
 * "Mis reservas".
 */
export default async function PaginaDetalleReservaAdmin({ params }: Props) {
  if (await sesionDeOtroRol()) {
    return (
      <main className={MAIN_ADMIN}>
        <AvisoSoloAdmin />
      </main>
    );
  }

  const { id } = await params;
  // Un id que no es un entero de la base no puede ser una reserva: es un 404, y
  // no un "Reintentar" que va a fallar siempre igual.
  if (!/^\d{1,10}$/.test(id) || Number(id) < 1 || Number(id) > 2_147_483_647) notFound();
  const ruta = `/admin/reservas/${id}`;

  let reserva: Reserva;
  try {
    reserva = await apiFetch<Reserva>(`/reservas/${id}`, { token: await leerToken(), timeoutMs: 2000 });
  } catch (error) {
    if (error instanceof ApiHttpError && error.estado === 404) notFound();
    return (
      <main className={MAIN_ADMIN}>
        {pantallaDeErrorAdmin(error, {
          ruta,
          mensaje: "No pudimos cargar esta reserva. Probá de nuevo en unos segundos.",
        })}
      </main>
    );
  }

  // Un ADMIN cancela sin plazo: alcanza con que esté confirmada y no se haya
  // jugado, y una que ya terminó la API la devuelve como COMPLETADA.
  const puedeCancelar = reserva.estado === "CONFIRMADA";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/admin/reservas" className="text-sm text-text-muted hover:text-accent">
        ← Reservas de socios
      </Link>

      <DetalleDeReserva reserva={reserva} conTitular />

      <AccionesDeReserva id={reserva.id} puedeCancelar={puedeCancelar} conMotivo />
    </main>
  );
}
