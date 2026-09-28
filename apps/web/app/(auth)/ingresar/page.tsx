import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardTitle } from "@/components/ui/card";
import { destinoSeguro } from "@/lib/sesion";
import { FormularioIngreso } from "../formulario-ingreso";

export const metadata: Metadata = { title: "Ingresar — Deploy" };

// Tipo explícito: `PageProps<"/ingresar">` recién existe después del primer build.
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaginaIngresar({ searchParams }: Props) {
  const { volver } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Card>
        <CardTitle className="text-2xl">Ingresar</CardTitle>
        <p className="mt-1 text-sm text-text-muted">
          Con el mail y la contraseña de tu cuenta de socio.
        </p>

        <div className="mt-6">
          <FormularioIngreso volver={destinoSeguro(volver)} />
        </div>

        <p className="mt-6 text-sm text-text-muted">
          ¿Todavía no tenés cuenta?{" "}
          <Link href="/registro" className="font-semibold text-accent hover:underline">
            Crear cuenta de socio
          </Link>
        </p>
      </Card>
    </main>
  );
}
