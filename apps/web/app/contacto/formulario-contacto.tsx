"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input, Textarea } from "@/components/ui/input";
import { enviarContacto, type EstadoContacto } from "./acciones";

// Cliente por `useActionState`: estado de envío y errores sin código de fetch.
export function FormularioContacto() {
  const [estado, accion, enviando] = useActionState<EstadoContacto, FormData>(
    enviarContacto,
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      {/*
        Región viva persistente, fuera del formulario a propósito. Un lector de
        pantalla anuncia un cambio de contenido, no la aparición de una región
        con el texto ya puesto, y la `key` del formulario re-monta todo su
        subárbol en cada envío aceptado. Acá el nodo vive siempre y solo cambia
        su texto, así que la confirmación se anuncia.
      */}
      <p aria-live="polite" className="sr-only">
        {estado.enviado ?? estado.error ?? ""}
      </p>

      {/*
        `noValidate`: los mensajes los da el servidor, iguales en todos los
        navegadores. La `key` cambia con cada envío aceptado y re-monta los
        campos: así quedan vacíos, algo que `defaultValue` por sí solo no hace.
      */}
      <form
        key={estado.envios ?? 0}
        action={accion}
        noValidate
        className="flex flex-col gap-4"
      >
        <Campo id="nombre" label="Nombre" error={estado.errores?.nombre}>
          <Input
            id="nombre"
            name="nombre"
            autoComplete="name"
            placeholder="Cómo te llamás"
            required
            maxLength={60}
            defaultValue={estado.valores?.nombre}
            aria-invalid={estado.errores?.nombre ? true : undefined}
            aria-describedby={estado.errores?.nombre ? "nombre-error" : undefined}
          />
        </Campo>

        <Campo id="email" label="Mail" error={estado.errores?.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="tu@mail.com"
            required
            defaultValue={estado.valores?.email}
            aria-invalid={estado.errores?.email ? true : undefined}
            aria-describedby={estado.errores?.email ? "email-error" : undefined}
          />
        </Campo>

        <Campo
          id="telefono"
          label="Teléfono (opcional)"
          error={estado.errores?.telefono}
        >
          <Input
            id="telefono"
            name="telefono"
            type="tel"
            autoComplete="tel"
            placeholder="351 000 0000"
            maxLength={30}
            defaultValue={estado.valores?.telefono}
            aria-invalid={estado.errores?.telefono ? true : undefined}
            aria-describedby={estado.errores?.telefono ? "telefono-error" : undefined}
          />
        </Campo>

        <Campo id="mensaje" label="Mensaje" error={estado.errores?.mensaje}>
          <Textarea
            id="mensaje"
            name="mensaje"
            rows={5}
            placeholder="Contanos en qué te podemos ayudar"
            required
            maxLength={1000}
            defaultValue={estado.valores?.mensaje}
            aria-invalid={estado.errores?.mensaje ? true : undefined}
            aria-describedby={estado.errores?.mensaje ? "mensaje-error" : undefined}
          />
        </Campo>

        {/*
          Campo trampa anti-spam: existe en el HTML pero está fuera del flujo
          visual, fuera del árbol de accesibilidad y fuera del recorrido con
          teclado, así que ninguna persona lo completa. Un bot que llene todo sí.
          `tabIndex={-1}` además evita el `aria-hidden` sobre algo enfocable.
        */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="sitioWeb">Sitio web</label>
          <input id="sitioWeb" name="sitioWeb" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <Button type="submit" disabled={enviando} className="mt-2 self-start">
          {enviando ? "Enviando…" : "Enviar mensaje"}
        </Button>
      </form>

      {/* Los mismos mensajes, visibles. Sin rol: los anuncia la región de arriba. */}
      {estado.error ? <p className="text-sm text-danger">{estado.error}</p> : null}

      {estado.enviado ? (
        <p className="text-sm font-semibold text-accent">{estado.enviado}</p>
      ) : null}
    </div>
  );
}
