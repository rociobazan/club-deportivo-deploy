import "server-only";

import { redirect } from "next/navigation";

import { AvisoSoloAdmin } from "@/components/admin/aviso-solo-admin";
import { EstadoError } from "@/components/ui/estado-error";
import { ApiHttpError } from "@/lib/api/client";
import { obtenerUsuario } from "@/lib/sesion";

/*
 * El acceso a las pantallas de `/admin` (design.md, decisión 7). El chequeo va
 * en cada página y no en un layout: la guía de autenticación de Next dice que
 * un layout que oculta `children` no impide que la página corra.
 */

/**
 * `true` si la sesión es de alguien que no es ADMIN: la página devuelve
 * `AvisoSoloAdmin` sin pedir sus datos. `obtenerUsuario()` está memoizada por
 * request y el layout raíz ya la llamó para el header, así que esto no suma
 * ningún pedido a la API.
 *
 * Sin usuario devuelve `false`: puede ser una sesión vencida o la API caída, y
 * `obtenerUsuario()` no los distingue a propósito. La página pide sus datos y
 * el error de la API decide (ver `pantallaDeErrorAdmin`).
 */
export async function sesionDeOtroRol(): Promise<boolean> {
  const usuario = await obtenerUsuario();
  return usuario !== null && usuario.rol !== "ADMIN";
}

/**
 * Qué mostrar cuando la API rechaza un pedido de una pantalla de `/admin`:
 *
 * - **401**: la sesión venció. Al login, volviendo a esta misma `ruta`.
 *   "Reintentar" sería un bucle que nunca va a funcionar.
 * - **403**: la sesión es de otro rol. El aviso, **no** el login: ya está
 *   logueado, y mandarlo a ingresar sería otro bucle.
 * - **El resto**, sin conexión incluido: el aviso con reintentar.
 *
 * Lo que no vino de la API es un bug y se propaga al error boundary.
 */
export function pantallaDeErrorAdmin(
  error: unknown,
  { ruta, mensaje }: { ruta: string; mensaje: string },
) {
  if (!(error instanceof ApiHttpError)) throw error;
  if (error.estado === 401) redirect(`/ingresar?volver=${encodeURIComponent(ruta)}`);
  if (error.estado === 403) return <AvisoSoloAdmin />;
  return <EstadoError mensaje={mensaje} reintentarHref={ruta} />;
}
