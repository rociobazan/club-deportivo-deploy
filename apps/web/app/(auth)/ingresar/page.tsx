import type { Metadata } from "next";
import Link from "next/link";

import { destinoSeguro } from "@/lib/sesion";
import { FormularioIngreso } from "../formulario-ingreso";
import { TarjetaDeAcceso } from "../tarjeta-de-acceso";

export const metadata: Metadata = { title: "Ingresar — Deploy" };

// Tipo explícito: `PageProps<"/ingresar">` recién existe después del primer build.
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaginaIngresar({ searchParams }: Props) {
  const { volver, restablecida } = await searchParams;

  return (
    <TarjetaDeAcceso
      titulo="Ingresar"
      bajada="Con el mail y la contraseña de tu cuenta de socio."
    >
      {/* Lo pone `/restablecer` al terminar. Es solo un aviso: no da acceso a nada. */}
      {restablecida === "1" ? (
        <p
          role="status"
          className="mb-6 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-center text-sm text-text"
        >
          Listo, cambiaste tu contraseña. Ya podés ingresar con la nueva.
        </p>
      ) : null}

      <FormularioIngreso volver={destinoSeguro(volver)} />

      <p className="mt-4 text-center text-xs">
        <Link href="/recuperar" className="text-text-muted hover:text-accent hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>

      <p className="mt-6 text-center text-xs text-text-subtle">
        ¿Todavía no tenés cuenta?{" "}
        <Link href="/registro" className="font-semibold text-accent hover:underline">
          Creá la tuya, es gratis
        </Link>
      </p>
    </TarjetaDeAcceso>
  );
}
