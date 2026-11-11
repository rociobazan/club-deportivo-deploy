"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { pedirRecuperacion, type EstadoRecuperacion } from "./acciones";

export function FormularioRecuperacion({ vigenciaMinutos }: { vigenciaMinutos: number }) {
  const [estado, accion, enviando] = useActionState<EstadoRecuperacion, FormData>(
    pedirRecuperacion,
    {},
  );

  if (estado.enviado) {
    // El mismo texto exista o no la cuenta: la pantalla no puede saberlo, y no debe.
    return (
      <div className="flex flex-col gap-4 text-center">
        <p role="status" className="text-sm text-text">
          Si <strong>{estado.valores?.email}</strong> está registrado, te va a llegar un mail con
          un enlace para elegir una contraseña nueva. El enlace dura {vigenciaMinutos} minutos.
        </p>
        <p className="text-xs text-text-subtle">
          Si no lo ves en unos minutos, revisá la carpeta de spam.
        </p>
        <Link href="/ingresar" className="text-sm font-semibold text-accent hover:underline">
          Volver a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form action={accion} noValidate className="flex w-full flex-col gap-4">
      <Campo id="email" label="Mail" error={estado.errorEmail}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={120}
          defaultValue={estado.valores?.email}
          aria-invalid={estado.errorEmail ? true : undefined}
          aria-describedby={estado.errorEmail ? "email-error" : undefined}
        />
      </Campo>

      {estado.error ? (
        <p role="alert" className="text-sm text-danger">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" disabled={enviando} className="w-full">
        {enviando ? "Enviando…" : "Enviarme el enlace"}
      </Button>

      <Link href="/ingresar" className="text-center text-xs text-text-subtle hover:underline">
        Volver a ingresar
      </Link>
    </form>
  );
}
