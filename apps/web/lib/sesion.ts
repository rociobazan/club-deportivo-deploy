import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Usuario } from "@/lib/api/types";

/**
 * La sesión del sitio es una cookie `httpOnly` con el JWT que emitió la API.
 * Solo el servidor de Next la lee; el navegador no puede (design.md, 11).
 */
export const COOKIE_SESION = "sesion";

/** Solo se puede llamar desde una Server Function o un Route Handler. */
export async function guardarSesion(token: string, expiraEn: number) {
  const almacen = await cookies();
  almacen.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // En localhost sin HTTPS el navegador rechazaría una cookie `Secure`.
    secure: process.env.NODE_ENV === "production",
    maxAge: expiraEn,
  });
}

export async function borrarSesion() {
  const almacen = await cookies();
  almacen.delete(COOKIE_SESION);
}

export async function leerToken(): Promise<string | undefined> {
  const almacen = await cookies();
  return almacen.get(COOKIE_SESION)?.value;
}

/**
 * Quién está usando el sitio, según la API. Memoizada por request con
 * `cache()`: el layout y la página comparten una sola llamada a `/auth/perfil`.
 *
 * Sin cookie no llama a nada. Si el token venció o la API no responde, el
 * sitio trata a la persona como visitante: las páginas públicas tienen que
 * renderizar igual (spec de `institucional`).
 */
export const obtenerUsuario = cache(async (): Promise<Usuario | null> => {
  const token = await leerToken();
  if (!token) return null;

  try {
    return await apiFetch<Usuario>("/auth/perfil", { token, timeoutMs: 2000 });
  } catch (error) {
    if (error instanceof ApiHttpError) return null;
    throw error;
  }
});

export { destinoSeguro } from "./destino-seguro";
