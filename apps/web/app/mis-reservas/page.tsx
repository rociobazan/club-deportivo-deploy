import type { Metadata } from "next";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EstadoError } from "@/components/ui/estado-error";
import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Reserva } from "@/lib/api/types";
import { leerToken } from "@/lib/sesion";
import { TabsDeReservas } from "./tabs-de-reservas";

export const metadata: Metadata = { title: "Mis reservas — Deploy" };

/**
 * Ruta privada (`proxy.ts`): el chequeo optimista ya mandó a `/ingresar` sin
 * cookie. Si el token venció entre el chequeo y esta carga, la API responde
 * 401 y se trata igual que cualquier otro error de la API.
 */
export default async function PaginaMisReservas() {
  const token = await leerToken();

  let reservas: Reserva[];
  try {
    reservas = await apiFetch<Reserva[]>("/reservas", { token, timeoutMs: 2000 });
  } catch (error) {
    if (!(error instanceof ApiHttpError)) throw error;
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <EstadoError
          mensaje="No pudimos cargar tus reservas. Probá de nuevo en unos segundos."
          reintentarHref="/mis-reservas"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent">
            Tu cuenta
          </span>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Mis reservas</h1>
        </div>
        <Link href="/disponibilidad" className={buttonClasses("primary")}>
          Reservar otro turno
        </Link>
      </header>

      <TabsDeReservas reservas={reservas} />
    </main>
  );
}
