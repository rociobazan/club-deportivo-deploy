"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { restablecerPassword, type EstadoRestablecimiento } from "./acciones";

/** Lo que se muestra cuando el enlace no sirve: sin token, vencido, usado o inventado. */
export function EnlaceInvalido() {
  return (
    <div className="flex flex-col gap-4 text-center">
      <p role="alert" className="text-sm text-text">
        Este enlace no sirve: puede que haya vencido o que ya se haya usado.
      </p>
      <Link
        href="/recuperar"
        className="text-sm font-semibold text-accent hover:underline"
      >
        Pedir un enlace nuevo
      </Link>
    </div>
  );
}

export function FormularioRestablecimiento({ token }: { token: string }) {
  const [estado, accion, enviando] = useActionState<EstadoRestablecimiento, FormData>(
    restablecerPassword,
    {},
  );
  const errores = estado.errores ?? {};

  if (estado.enlaceInvalido) return <EnlaceInvalido />;

  // Los campos no llevan `defaultValue`: después de cualquier error quedan vacíos.
  return (
    <form action={accion} noValidate className="flex w-full flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <p className="text-center text-sm text-text-muted">
        Escribila dos veces. Tiene que tener al menos 8 caracteres.
      </p>

      <Campo id="password" label="Contraseña nueva" error={errores.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          aria-invalid={errores.password ? true : undefined}
          aria-describedby={errores.password ? "password-error" : undefined}
        />
      </Campo>

      <Campo id="repetir" label="Repetí la contraseña" error={errores.repetir}>
        <Input
          id="repetir"
          name="repetir"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={errores.repetir ? true : undefined}
          aria-describedby={errores.repetir ? "repetir-error" : undefined}
        />
      </Campo>

      {estado.error ? (
        <p role="alert" className="text-sm text-danger">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="w-full">
        {enviando ? "Guardando…" : "Guardar la contraseña"}
      </Button>
    </form>
  );
}
