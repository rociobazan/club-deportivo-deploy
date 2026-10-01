"use server";

import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { CrearReservaRequest, Reserva } from "@/lib/api/types";
import { texto } from "@/lib/formularios";
import { leerToken } from "@/lib/sesion";

/*
 * Server Function del formulario de reserva, con el patrón de
 * `app/(auth)/acciones.ts`: ante un error de la API devuelve su `titulo` —que es
 * el texto apto para la persona— más los valores, para no perder lo cargado.
 *
 * No redirige: la confirmación se muestra en la misma pantalla. `/mis-reservas`
 * es del ítem 1.4 y hoy daría 404.
 */

/** Lo elegido, para repoblar el formulario cuando la API rechaza el pedido. */
export type ValoresReserva = {
  cantidadJugadores: string;
  /** `equipamientoId` (como texto, porque viene de un `name`) → cantidad. */
  equipamiento: Record<string, number>;
};

export type EstadoReserva = {
  error?: string;
  reserva?: Reserva;
  valores?: ValoresReserva;
};

/** Los selectores del equipamiento se llaman `equipamiento-<id>`. */
const NOMBRE_DE_ITEM = /^equipamiento-(\d+)$/;

export async function crearReserva(
  _anterior: EstadoReserva,
  formData: FormData,
): Promise<EstadoReserva> {
  const canchaId = Number(texto(formData, "canchaId"));
  const fecha = texto(formData, "fecha");
  const horaInicio = texto(formData, "horaInicio");
  const jugadores = texto(formData, "cantidadJugadores");

  const elegido: Record<string, number> = {};
  const equipamiento: { equipamientoId: number; cantidad: number }[] = [];
  for (const [clave, valor] of formData.entries()) {
    const coincide = NOMBRE_DE_ITEM.exec(clave);
    if (!coincide) continue;

    const cantidad = Number(String(valor));
    if (!Number.isInteger(cantidad) || cantidad < 0) continue;
    elegido[coincide[1]] = cantidad;
    // Los ceros no viajan: el contrato pide cantidad mínima 1 por ítem.
    if (cantidad > 0) {
      equipamiento.push({ equipamientoId: Number(coincide[1]), cantidad });
    }
  }

  const valores: ValoresReserva = { cantidadJugadores: jugadores, equipamiento: elegido };

  if (!Number.isInteger(canchaId) || canchaId < 1 || !fecha || !horaInicio) {
    return { error: "Faltan datos del turno. Volvé a elegirlo en Disponibilidad.", valores };
  }

  const cuerpo: CrearReservaRequest = { canchaId, fecha, horaInicio };

  if (jugadores) {
    const cantidad = Number(jugadores);
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      return {
        error: "La cantidad de jugadores tiene que ser un número entero de 1 o más.",
        valores,
      };
    }
    cuerpo.cantidadJugadores = cantidad;
  }
  if (equipamiento.length > 0) cuerpo.equipamiento = equipamiento;

  const token = await leerToken();
  // El proxy protege la ruta, pero la cookie puede haber vencido entre que se
  // abrió la pantalla y se confirmó.
  if (!token) {
    return { error: "Se cerró tu sesión. Volvé a ingresar para reservar.", valores };
  }

  try {
    const reserva = await apiFetch<Reserva>("/reservas", {
      method: "POST",
      body: cuerpo,
      token,
    });
    return { reserva };
  } catch (error) {
    // `message` es el `titulo` que mandó la API: ya está escrito para la persona.
    if (error instanceof ApiHttpError) return { error: error.message, valores };
    throw error;
  }
}
