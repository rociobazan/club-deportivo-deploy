import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

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
    <main className="fondo-mezcla flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-border-strong bg-surface p-8 shadow-2xl">
        <div className="flex flex-col items-center">
          <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 shadow-lg">
            <Image src="/logo-deploy.png" alt="" width={28} height={28} />
          </span>

          <h1 className="font-display text-2xl font-semibold">Ingresar</h1>
          <p className="mt-1 text-center text-sm text-text-muted">
            Con el mail y la contraseña de tu cuenta de socio.
          </p>
        </div>

        <div className="mt-6">
          <FormularioIngreso volver={destinoSeguro(volver)} />
        </div>

        <p className="mt-6 text-center text-xs text-text-subtle">
          ¿Todavía no tenés cuenta?{" "}
          <Link href="/registro" className="font-semibold text-accent hover:underline">
            Creá la tuya, es gratis
          </Link>
        </p>
      </div>
    </main>
  );
}
