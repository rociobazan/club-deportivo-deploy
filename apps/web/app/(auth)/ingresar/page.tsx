import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { GradientWave } from "@/components/ui/gradient-wave";
import { destinoSeguro } from "@/lib/sesion";
import { FormularioIngreso } from "../formulario-ingreso";

export const metadata: Metadata = { title: "Ingresar — Deploy" };

/**
 * Los tokens de `globals.css`, en hexadecimal porque el shader los parsea con
 * `parseInt`: el fondo del sitio como color base y el verde del club en las
 * ondas, en lugar del celeste y el blanco del componente original. Va fuera del
 * componente para que su identidad no cambie en cada render.
 */
const COLORES_DEL_CLUB = [
  "#060807", // --bg
  "#0b0f0e", // --surface
  "#00e58f", // --accent
  "#0e1211", // --surface-raised
];

/**
 * Animación calmada a pedido: la velocidad general multiplica el tiempo de
 * todas las capas, y una amplitud más baja aplana la onda. Dos oscuros entre
 * medio dejan al verde como acento en lugar de llenar la pantalla.
 */
const VELOCIDAD = 0.000004;
const AMPLITUD = 140;

// Tipo explícito: `PageProps<"/ingresar">` recién existe después del primer build.
type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaginaIngresar({ searchParams }: Props) {
  const { volver } = await searchParams;

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <GradientWave
        colors={COLORES_DEL_CLUB}
        noiseSpeed={VELOCIDAD}
        waveAmplitude={AMPLITUD}
      />

      {/*
        La tarjeta va opaca sobre el fondo animado y no traslúcida: con las ondas
        pasando por detrás, el texto perdería contraste justo donde hay que leer
        un error de validación. El `backdrop-blur` mantiene el efecto de vidrio
        en el borde sin comerse la legibilidad.
      */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border-strong bg-surface/90 p-8 shadow-2xl backdrop-blur-md">
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
