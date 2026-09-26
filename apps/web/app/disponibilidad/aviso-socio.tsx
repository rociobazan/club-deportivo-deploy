"use client";

import Link from "next/link";
import { useRef, type MouseEvent, type ReactNode } from "react";

import { Button, buttonClasses } from "@/components/ui/button";

/**
 * Para el visitante sin sesión: un único <dialog> por página que se abre al
 * tocar cualquier bloque libre. Los bloques los renderiza el servidor con
 * `data-turno-libre`; acá solo se delega el clic (design.md, decisión 10).
 */
export function AvisoSocio({ volver, children }: { volver: string; children: ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null);

  const alTocar = (evento: MouseEvent<HTMLDivElement>) => {
    const objetivo = (evento.target as HTMLElement).closest("[data-turno-libre]");
    if (objetivo) dialogo.current?.showModal();
  };

  const destino = encodeURIComponent(volver);

  return (
    <div onClick={alTocar}>
      {children}
      <dialog
        ref={dialogo}
        aria-labelledby="aviso-socio-titulo"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[20px] border border-border bg-surface-raised p-6 text-text backdrop:bg-black/70"
      >
        <h2 id="aviso-socio-titulo" className="font-display text-xl font-semibold">
          Para reservar hay que ser socio
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          Ver los horarios libres es abierto a todos. Para quedarte con el turno necesitás una
          cuenta: se hace en un minuto y es gratis.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/ingresar?volver=${destino}`} className={buttonClasses("primary")}>
            Ingresar
          </Link>
          <Link href={`/registro?volver=${destino}`} className={buttonClasses("secondary")}>
            Crear cuenta
          </Link>
          <Button type="button" variant="ghost" onClick={() => dialogo.current?.close()}>
            Cerrar
          </Button>
        </div>
      </dialog>
    </div>
  );
}
