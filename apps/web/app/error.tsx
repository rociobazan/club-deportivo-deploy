"use client"; // Los error boundaries tienen que ser componentes cliente.

import { useEffect } from "react";
import Link from "next/link";

import { Button, buttonClasses } from "@/components/ui/button";

/**
 * En esta versión de Next el prop es `retry`, no `reset`: vuelve a renderizar
 * el segmento. Al visitante se le muestra un mensaje genérico; el detalle va a
 * la consola del servidor y del navegador, no a la pantalla.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-display text-2xl font-semibold">
        Algo salió mal de nuestro lado
      </h1>
      <p className="text-text-muted">
        No pudimos cargar esta pantalla. Probá de nuevo; si sigue pasando,
        escribinos y lo revisamos.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button onClick={retry}>Reintentar</Button>
        <Link href="/" className={buttonClasses("secondary")}>
          Ir al inicio
        </Link>
      </div>
      {error.digest ? (
        <p className="text-sm text-text-subtle">
          Código del error: {error.digest}
        </p>
      ) : null}
    </main>
  );
}
