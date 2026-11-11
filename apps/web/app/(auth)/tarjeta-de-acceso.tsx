import Image from "next/image";
import type { ReactNode } from "react";

/** La tarjeta centrada con el logo de `/ingresar`, `/recuperar` y `/restablecer`. */
export function TarjetaDeAcceso({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada?: string;
  children: ReactNode;
}) {
  return (
    <main className="fondo-mezcla flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-border-strong bg-surface p-8 shadow-2xl">
        <div className="flex flex-col items-center">
          <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 shadow-lg">
            <Image src="/logo-deploy.png" alt="" width={28} height={28} />
          </span>

          <h1 className="font-display text-2xl font-semibold">{titulo}</h1>
          {bajada ? <p className="mt-1 text-center text-sm text-text-muted">{bajada}</p> : null}
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
