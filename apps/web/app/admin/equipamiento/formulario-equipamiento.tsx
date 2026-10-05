"use client";

import { useActionState } from "react";

import { MensajeDeFormulario } from "@/components/admin/mensaje-de-formulario";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input, Select } from "@/components/ui/input";
import type { Disciplina, Equipamiento } from "@/lib/api/types";
import {
  actualizarEquipamiento,
  crearEquipamiento,
  type EstadoFormularioEquipamiento,
  type ValoresEquipamiento,
} from "./acciones";

/** Alta (sin `item`) o edición (con `item`) de un ítem de equipamiento. */
export function FormularioEquipamiento({
  disciplinas,
  item,
}: {
  disciplinas: Disciplina[];
  item?: Equipamiento;
}) {
  const [estado, accion, enviando] = useActionState<EstadoFormularioEquipamiento, FormData>(
    item ? actualizarEquipamiento : crearEquipamiento,
    { intentos: 0 },
  );

  const valores: ValoresEquipamiento = estado.valores ?? {
    disciplinaId: "",
    nombre: item?.nombre ?? "",
    stockTotal: item ? String(item.stockTotal) : "",
    precioPorTurno: item ? String(item.precioPorTurno) : "",
  };
  const prefijo = item ? `item-${item.id}` : "item-nuevo";

  return (
    <form
      key={estado.intentos}
      action={accion}
      noValidate
      className="flex flex-col gap-4"
      aria-label={item ? `Editar ${item.nombre}` : "Nuevo ítem"}
    >
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {item ? null : (
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
            maxLength={60}
            defaultValue={valores.nombre}
          />
        </Campo>
        <Campo id={`${prefijo}-stock`} label="Stock total">
          <Input
            id={`${prefijo}-stock`}
            name="stockTotal"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={valores.stockTotal}
          />
        </Campo>
        <Campo id={`${prefijo}-precio`} label="Precio por turno">
          <Input
            id={`${prefijo}-precio`}
            name="precioPorTurno"
            inputMode="decimal"
            required
            placeholder="2500"
            defaultValue={valores.precioPorTurno}
          />
        </Campo>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={enviando}>
          {item ? "Guardar cambios" : "Dar de alta"}
        </Button>
        <MensajeDeFormulario error={estado.error} guardado={estado.guardado} />
      </div>
    </form>
  );
}
