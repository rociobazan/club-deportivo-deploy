import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardTitle } from "@/components/ui/card";
import { destinoSeguro } from "@/lib/sesion";
import { FormularioRegistro } from "../formulario-registro";

export const metadata: Metadata = { title: "Crear cuenta de socio — Deploy" };

// Tipo explícito: `PageProps<"/registro">` recién existe después del primer build.
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaginaRegistro({ searchParams }: Props) {
  const { volver } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Card>
        <CardTitle className="text-2xl">Crear cuenta de socio</CardTitle>
        <p className="mt-1 text-sm text-text-muted">
          Con una cuenta podés reservar canchas y ver tus turnos.
        </p>

        <div className="mt-6">
          <FormularioRegistro volver={destinoSeguro(volver)} />
        </div>

        <p className="mt-6 text-sm text-text-muted">
          ¿Ya sos socio?{" "}
          <Link href="/ingresar" className="font-semibold text-accent hover:underline">
            Ingresar
          </Link>
        </p>
      </Card>
    </main>
  );
}
