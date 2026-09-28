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

  // Ruta completa, con su query, para volver exactamente a lo que se pidió.
  const { pathname, search } = request.nextUrl;
  const destino = new URL('/ingresar', request.url);
  destino.searchParams.set('volver', pathname + search);
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ["/mis-reservas", "/reservar", "/admin/:path*"],
};
