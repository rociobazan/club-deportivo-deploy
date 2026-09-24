import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLink } from "@/components/layout/nav-link";
import {
  iniciales,
  navegacionPara,
  type UsuarioDelHeader,
} from "@/components/layout/navegacion";
import { buttonClasses } from "@/components/ui/button";

/**
 * `usuario` llega vacío hasta que exista la sesión: leer la cookie `httpOnly`
 * y cerrar sesión son del cambio de autenticación (RF-00), que es su dueño.
 */
export function SiteHeader({ usuario }: { usuario?: UsuarioDelHeader }) {
  const navegacion = navegacionPara(usuario);

  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle bg-surface/95 px-5 py-3 backdrop-blur">
      <Link href="/" className="order-1 mr-auto flex items-center">
        <Logo />
      </Link>

      {/* En pantalla chica la navegación vive en el panel de MobileNav. */}
      <nav aria-label="Principal" className="order-2 hidden gap-4 sm:flex">
        {navegacion.map((item) => (
          <NavLink key={item.href} href={item.href}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {usuario ? (
        <span className="order-3 flex items-center gap-2" title={usuario.nombre}>
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-full border border-border-strong text-sm font-bold text-accent"
          >
            {iniciales(usuario.nombre)}
          </span>
          <span className="hidden text-sm text-text-muted sm:inline">
            {usuario.nombre}
          </span>
          {usuario.rol === "ADMIN" ? (
            <span className="hidden rounded-full border border-accent/40 px-2 py-0.5 text-[11px] text-accent sm:inline">
              Admin
            </span>
          ) : null}
        </span>
      ) : (
        <Link
          href="/ingresar"
          className={buttonClasses(
            "primary",
            "order-3 max-sm:min-h-10 max-sm:px-4",
          )}
        >
          Ingresar
        </Link>
      )}

      <MobileNav items={navegacion} />
    </header>
  );
}
