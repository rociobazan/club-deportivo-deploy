"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { cambiarPassword, type EstadoPassword } from "./acciones";

export function FormularioPassword() {
  const [estado, accion, enviando] = useActionState<EstadoPassword, FormData>(
    cambiarPassword,
    {},
  );

  return (
    /*
     * La `key` cambia con cada intento y re-monta los campos, así quedan
     * vacíos salga bien o mal: una contraseña no se repone en pantalla, ni
     * siquiera la que se acaba de rechazar.
     */
    <form
      key={estado.intentos ?? 0}
      action={accion}
      noValidate
      className="flex flex-col gap-4"
    >
      <Campo id="actual" label="Contraseña actual">
        <Input
          id="actual"
          name="actual"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={estado.error ? true : undefined}
        />
      </Campo>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="nueva" label="Contraseña nueva">
          <Input
            id="nueva"
            name="nueva"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Campo>
        <Campo id="repetida" label="Repetir la nueva">
          <Input
            id="repetida"
            name="repetida"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Campo>
      </div>

      <p className="text-xs text-text-subtle">Al menos 8 caracteres.</p>

      {estado.error ? (
        <p role="alert" className="text-sm text-danger">
          {estado.error}
        </p>
      ) : null}

      {estado.guardado ? (
        <p role="status" className="text-sm font-semibold text-accent">
          {estado.guardado}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="mt-2 self-start">
        {enviando ? "Cambiando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
