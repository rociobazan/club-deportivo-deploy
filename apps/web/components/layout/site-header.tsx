import Link from "next/link";

import { NavLink } from "@/components/layout/nav-link";
import { buttonClasses } from "@/components/ui/button";

const navegacion = [
  { href: "/el-club", label: "El club" },
  { href: "/canchas", label: "Canchas y precios" },
  { href: "/disponibilidad", label: "Disponibilidad" },
  { href: "/contacto", label: "Contacto" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border-subtle bg-surface/95 px-5 py-3.5 backdrop-blur">
      <Link href="/" className="order-1 mr-auto flex items-center gap-2">
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-lg bg-accent font-display text-lg font-bold text-text-on-accent"
        >
          D
        </span>
        <span className="font-display text-lg font-semibold">Deploy</span>
      </Link>

      {/* En pantalla chica la navegación baja a su propia fila, para que el header
          no se coma tres filas de alto siendo sticky. */}
      <nav
        aria-label="Principal"
        className="order-3 -mx-1 flex w-full gap-4 overflow-x-auto px-1 sm:order-2 sm:w-auto"
      >
        {navegacion.map((item) => (
          <NavLink key={item.href} href={item.href}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Con sesión, acá van el nombre y "Mis reservas": lo resuelve el cambio de
          autenticación (RF-00), que es el dueño del estado de sesión. */}
      <Link
        href="/ingresar"
        className={buttonClasses("primary", "order-2 sm:order-3")}
      >
        Ingresar
      </Link>
    </header>
  );
}
