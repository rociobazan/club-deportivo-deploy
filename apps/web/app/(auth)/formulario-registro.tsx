"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { registrarse, type EstadoRegistro } from "./acciones";
import { Campo } from "./campo";

export function FormularioRegistro({ volver }: { volver: string }) {
  const [estado, accion, enviando] = useActionState<EstadoRegistro, FormData>(
    registrarse,
    {},
  );
  const errores = estado.errores ?? {};
  const valores = estado.valores;

  return (
    <form action={accion} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="volver" value={volver} />

      {/* Nombre y apellido separados, como pide RegistroRequest del contrato. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="nombre" label="Nombre" error={errores.nombre}>
          <Input
            id="nombre"
            name="nombre"
            autoComplete="given-name"
            required
            maxLength={60}
            defaultValue={valores?.nombre}
            aria-invalid={errores.nombre ? true : undefined}
            aria-describedby={errores.nombre ? "nombre-error" : undefined}
          />
        </Campo>
        <Campo id="apellido" label="Apellido" error={errores.apellido}>
          <Input
            id="apellido"
            name="apellido"
            autoComplete="family-name"
            required
            maxLength={60}
            defaultValue={valores?.apellido}
            aria-invalid={errores.apellido ? true : undefined}
            aria-describedby={errores.apellido ? "apellido-error" : undefined}
          />
        </Campo>
      </div>

      <Campo id="email" label="Mail" error={errores.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={valores?.email}
          aria-invalid={errores.email ? true : undefined}
          aria-describedby={errores.email ? "email-error" : undefined}
        />
      </Campo>

      <Campo id="password" label="Contraseña" error={errores.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={errores.password ? true : undefined}
          aria-describedby={errores.password ? "password-error" : undefined}
        />
        {!errores.password ? (
          <p className="text-xs text-text-subtle">Al menos 8 caracteres.</p>
        ) : null}
      </Campo>

      <Campo id="telefono" label="Teléfono (opcional)" error={errores.telefono}>
        <Input
          id="telefono"
          name="telefono"
          type="tel"
          autoComplete="tel"
          maxLength={30}
          defaultValue={valores?.telefono}
          aria-invalid={errores.telefono ? true : undefined}
          aria-describedby={errores.telefono ? "telefono-error" : undefined}
        />
      </Campo>

      {estado.error ? (
        <p role="alert" className="text-sm text-danger">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="mt-2">
        {enviando ? "Creando la cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
