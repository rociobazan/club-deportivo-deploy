import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="font-display text-5xl font-semibold text-accent">404</p>
      <h1 className="font-display text-2xl font-semibold">
        No encontramos esta página
      </h1>
      <p className="text-text-muted">
        Puede que el link esté mal escrito o que la página ya no exista.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClasses("primary")}>
          Ir al inicio
        </Link>
        <Link href="/disponibilidad" className={buttonClasses("secondary")}>
          Ver disponibilidad
        </Link>
      </div>
    </main>
  );
}
