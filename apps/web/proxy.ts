import { NextResponse, type NextRequest } from "next/server";

import { COOKIE_SESION } from "@/lib/sesion";

/**
 * Rutas privadas del sitio (spec de `autenticacion`): sin cookie de sesión se
 * redirige a `/ingresar?volver=<ruta>`. Chequeo optimista a propósito: corre en
 * cada navegación y en cada prefetch, así que solo mira si la cookie existe. La
 * autorización real es el 401/403 de la API (design.md, decisión 12).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(COOKIE_SESION)) return NextResponse.next();

  // Se arma como string para que `volver` quede legible (`/mis-reservas`, no `%2F...`).
  const destino = new URL(
    `/ingresar?volver=${request.nextUrl.pathname}`,
    request.url,
  );
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/mis-reservas", "/reservar", "/admin/:path*"],
};
