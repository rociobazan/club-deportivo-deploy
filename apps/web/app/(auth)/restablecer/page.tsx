import type { Metadata } from "next";

import { EnlaceInvalido, FormularioRestablecimiento } from "../formulario-restablecimiento";
import { TarjetaDeAcceso } from "../tarjeta-de-acceso";

export const metadata: Metadata = {
  title: "Elegir una contraseña nueva — Deploy",
  // El token viaja en la URL: que ningún buscador la guarde.
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaginaRestablecer({ searchParams }: Props) {
  const { token } = await searchParams;
  // Si la API lo considera válido o no lo decide ella; acá solo se descarta lo que no es un texto.
  const valido = typeof token === "string" && token.length > 0 ? token : null;

  return (
    <TarjetaDeAcceso titulo="Elegir una contraseña nueva">
      {valido ? <FormularioRestablecimiento token={valido} /> : <EnlaceInvalido />}
    </TarjetaDeAcceso>
  );
}
