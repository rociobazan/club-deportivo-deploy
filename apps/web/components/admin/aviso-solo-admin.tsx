import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

/**
 * Lo que ve una sesión que no es de ADMIN en cualquier pantalla de `/admin`
 * (specs: "Socio en el panel" y equivalentes). Sin datos del club: la página
 * lo devuelve antes de pedir nada a la API.
 */
export function AvisoSoloAdmin() {
  return (
    <Card role="alert" className="mx-auto max-w-md text-center">
      <CardTitle>Esta sección es solo para administradores</CardTitle>
      <p className="mt-2 text-sm text-text-muted">
        Con tu cuenta podés reservar turnos y ver tus reservas.
      </p>
      <Link href="/mis-reservas" className={buttonClasses("secondary", "mt-5")}>
        Ir a mis reservas
      </Link>
    </Card>
  );
}
