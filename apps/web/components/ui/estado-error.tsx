import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

/**
 * Cuando la API no responde, la página lo muestra como estado propio en lugar
 * de romperse (spec: "API sin respuesta"). "Reintentar" es un link a la misma
 * URL: sin estado, sin JavaScript.
 */
export function EstadoError({
  titulo = "No pudimos cargar esta información",
  mensaje,
  reintentarHref,
}: {
  titulo?: string;
  mensaje: string;
  reintentarHref: string;
}) {
  return (
    <Card role="alert" className="mx-auto max-w-md text-center">
      <CardTitle>{titulo}</CardTitle>
      <p className="mt-2 text-sm text-text-muted">{mensaje}</p>
      <Link href={reintentarHref} className={buttonClasses("secondary", "mt-5")}>
        Reintentar
      </Link>
    </Card>
  );
}
