import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardTitle } from "@/components/ui/card";
import { EstadoError } from "@/components/ui/estado-error";
import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { Usuario } from "@/lib/api/types";
import { leerToken } from "@/lib/sesion";
import { FormularioDatos } from "./formulario-datos";
import { FormularioPassword } from "./formulario-password";

export const metadata: Metadata = { title: "Mi perfil — Deploy" };

/**
 * Ruta privada: `proxy.ts` redirige a `/ingresar` sin cookie de sesión, así que
 * acá ya hay token. La autorización real la hace la API con ese token.
 */
export default async function PaginaPerfil() {
  const token = await leerToken();

  let usuario: Usuario;
  try {
    usuario = await apiFetch<Usuario>("/auth/perfil", { token, timeoutMs: 2000 });
  } catch (error) {
    // Lo que no vino de la API es un bug y va al error boundary.
    if (!(error instanceof ApiHttpError)) throw error;

    /*
     * Una sesión vencida o inválida no es un problema pasajero: `proxy.ts` mira
     * si la cookie existe, no si el token sigue vivo, así que se llega hasta
     * acá y la API contesta 401. Ofrecer "reintentar" sería mandar a la persona
     * a un bucle que nunca va a funcionar; lo que necesita es volver a ingresar.
     */
    if (error.estado === 401 || error.estado === 403) {
      redirect(`/ingresar?volver=${encodeURIComponent("/perfil")}`);
    }

    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <EstadoError
          mensaje="No pudimos cargar tus datos. Probá de nuevo en unos segundos."
          reintentarHref="/perfil"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Mi perfil</h1>
      <p className="mt-2 text-text-muted">
        Tus datos de socio. Con el mail iniciás sesión, así que si lo cambiás vas a entrar
        con el nuevo.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        <Card>
          <CardTitle>Tus datos</CardTitle>
          <div className="mt-4">
            <FormularioDatos usuario={usuario} />
          </div>
        </Card>

        <Card>
          <CardTitle>Contraseña</CardTitle>
          <p className="mt-1 text-sm text-text-muted">
            Para cambiarla necesitamos la actual. Las sesiones que tengas abiertas en otros
            dispositivos siguen activas hasta que venzan.
          </p>
          <div className="mt-4">
            <FormularioPassword />
          </div>
        </Card>
      </div>
    </main>
  );
}
