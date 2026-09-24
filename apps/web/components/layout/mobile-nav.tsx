"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { NavLink } from "@/components/layout/nav-link";

// Cliente porque el panel abre y cierra: es estado de la pantalla.
export function MobileNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  const [rutaPrevia, setRutaPrevia] = useState(pathname);

  // Al navegar, el panel se cierra solo. Se ajusta durante el render en lugar
  // de en un efecto, que encadenaría un render de más.
  if (pathname !== rutaPrevia) {
    setRutaPrevia(pathname);
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((estaba) => !estaba)}
        aria-expanded={abierto}
        aria-controls="menu-principal"
        className="order-2 grid size-11 place-items-center rounded-full text-text transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:hidden"
      >
        <span className="sr-only">{abierto ? "Cerrar menú" : "Abrir menú"}</span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="size-6"
        >
          {abierto ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {abierto ? (
        <nav
          id="menu-principal"
          aria-label="Principal"
          // También cierra al tocar un link: si es la ruta actual, la
          // comparación de arriba no se entera y el panel quedaría abierto.
          onClick={() => setAbierto(false)}
          className="order-4 flex w-full flex-col gap-1 border-t border-border-subtle pt-3 sm:hidden"
        >
          {items.map((item) => (
            <NavLink key={item.href} href={item.href} className="py-2 text-base">
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </>
  );
}
