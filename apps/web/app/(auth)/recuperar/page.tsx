import type { Metadata } from "next";

import { RECUPERACION_VIGENCIA_MINUTOS } from "@/lib/club";
import { FormularioRecuperacion } from "../formulario-recuperacion";
import { TarjetaDeAcceso } from "../tarjeta-de-acceso";

export const metadata: Metadata = { title: "Recuperar la contraseña — Deploy" };

export default function PaginaRecuperar() {
  return (
    <TarjetaDeAcceso
      titulo="Recuperar la contraseña"
      bajada="Escribí el mail de tu cuenta y te mandamos un enlace para elegir una nueva."
    >
      <FormularioRecuperacion vigenciaMinutos={RECUPERACION_VIGENCIA_MINUTOS} />
    </TarjetaDeAcceso>
  );
}
