"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import type { Usuario } from "@/lib/api/types";
import { actualizarPerfil, type EstadoPerfil } from "./acciones";

/**
 * Los datos de la cuenta. Va aparte del formulario de contraseña: son dos
 * operaciones con dos modos de fallar, y un error en una no puede borrar lo
 * que la persona cargó en la otra.
 */
export function FormularioDatos({ usuario }: { usuario: Usuario }) {
  const [estado, accion, enviando] = useActionState<EstadoPerfil, FormData>(
    actualizarPerfil,
    {},
  );

  // Lo último que se envió manda sobre lo que trajo el servidor: así un rechazo
  // no borra lo que la persona venía escribiendo.
  const valor = (campo: keyof NonNullable<EstadoPerfil["valores"]>) =>
    estado.valores?.[campo] ?? (campo === "telefono" ? (usuario.telefono ?? "") : usuario[campo]);

  return (
    <form action={accion} noValidate className="flex flex-col gap-4">
      {/* Para saber si el mail cambió sin volver a pedirlo a la API. */}
      <input type="hidden" name="emailAnterior" value={usuario.email} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="nombre" label="Nombre" error={estado.errores?.nombre}>
          <Input
            id="nombre"
            name="nombre"
            autoComplete="given-name"
            required
            maxLength={60}
            defaultValue={valor("nombre")}
            aria-invalid={estado.errores?.nombre ? true : undefined}
            aria-describedby={estado.errores?.nombre ? "nombre-error" : undefined}
          />
        </Campo>
        <Campo id="apellido" label="Apellido" error={estado.errores?.apellido}>
          <Input
            id="apellido"
            name="apellido"
            autoComplete="family-name"
            required
            maxLength={60}
            defaultValue={valor("apellido")}
            aria-invalid={estado.errores?.apellido ? true : undefined}
            aria-describedby={estado.errores?.apellido ? "apellido-error" : undefined}
          />
        </Campo>
      </div>

      <Campo id="email" label="Mail" error={estado.errores?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={valor("email")}
          aria-invalid={estado.errores?.email ? true : undefined}
          aria-describedby={estado.errores?.email ? "email-error" : undefined}
        />
      </Campo>

      <Campo id="telefono" label="Teléfono (opcional)" error={estado.errores?.telefono}>
        <Input
          id="telefono"
          name="telefono"
          type="tel"
          autoComplete="tel"
          maxLength={30}
          defaultValue={valor("telefono")}
          aria-invalid={estado.errores?.telefono ? true : undefined}
          aria-describedby={estado.errores?.telefono ? "telefono-error" : undefined}
        />
      </Campo>

      {estado.error ? (
        <p role="alert" className="text-sm text-danger">
          {estado.error}
        </p>
      ) : null}

      {estado.guardado ? (
        <p role="status" className="text-sm font-semibold text-accent">
          {estado.guardado}
          {estado.mailCambiado ? " A partir de ahora ingresás con el mail nuevo." : ""}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="mt-2 self-start">
        {enviando ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
