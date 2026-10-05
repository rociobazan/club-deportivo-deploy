"use client";

import { useActionState } from "react";

import { MensajeDeFormulario } from "@/components/admin/mensaje-de-formulario";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input, Select } from "@/components/ui/input";
import type { Cancha, Disciplina } from "@/lib/api/types";
import {
  actualizarCancha,
  crearCancha,
  type EstadoFormularioCancha,
  type ValoresCancha,
} from "./acciones";

/**
 * Alta (sin `cancha`) o edición (con `cancha`) de una cancha. En la edición no
 * se elige disciplina: el contrato no deja cambiarla.
 */
export function FormularioCancha({
  disciplinas,
  cancha,
}: {
  disciplinas: Disciplina[];
  cancha?: Cancha;
}) {
  const [estado, accion, enviando] = useActionState<EstadoFormularioCancha, FormData>(
    cancha ? actualizarCancha : crearCancha,
    { intentos: 0 },
  );

  // Después de un error valen los valores enviados; después de un alta, el
  // formulario vuelve a quedar vacío; en la edición, los de la cancha.
  const valores: ValoresCancha = estado.valores ?? {
    disciplinaId: "",
    nombre: cancha?.nombre ?? "",
    superficie: cancha?.superficie ?? "",
    techada: cancha?.techada ?? false,
    precioPorTurno: cancha ? String(cancha.precioPorTurno) : "",
  };
  // Un id por formulario: hay uno de alta y uno de edición por fila.
  const prefijo = cancha ? `cancha-${cancha.id}` : "cancha-nueva";

  return (
    <form
      key={estado.intentos}
      action={accion}
      noValidate
      className="flex flex-col gap-4"
      aria-label={cancha ? `Editar ${cancha.nombre}` : "Nueva cancha"}
    >
      {cancha ? <input type="hidden" name="id" value={cancha.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {cancha ? null : (
          <Campo id={`${prefijo}-disciplina`} label="Disciplina">
            <Select
              id={`${prefijo}-disciplina`}
              name="disciplinaId"
              required
              defaultValue={valores.disciplinaId}
            >
              <option value="" disabled>
                Elegí una
              </option>
              {disciplinas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </Select>
          </Campo>
        )}
        <Campo id={`${prefijo}-nombre`} label="Nombre">
          <Input
            id={`${prefijo}-nombre`}
            name="nombre"
            required
            maxLength={50}
            defaultValue={valores.nombre}
          />
        </Campo>
        <Campo id={`${prefijo}-superficie`} label="Superficie (opcional)">
          <Input
            id={`${prefijo}-superficie`}
            name="superficie"
            maxLength={30}
            placeholder="Polvo de ladrillo, sintético…"
            defaultValue={valores.superficie}
          />
        </Campo>
        <Campo id={`${prefijo}-precio`} label="Precio por turno">
          <Input
            id={`${prefijo}-precio`}
            name="precioPorTurno"
            inputMode="decimal"
            required
            placeholder="15000"
            defaultValue={valores.precioPorTurno}
          />
        </Campo>
      </div>

      <label className="flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          name="techada"
          defaultChecked={valores.techada}
          className="size-4 accent-accent"
        />
        Techada
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={enviando}>
          {cancha ? "Guardar cambios" : "Dar de alta"}
        </Button>
        <MensajeDeFormulario error={estado.error} guardado={estado.guardado} />
      </div>
    </form>
  );
}
