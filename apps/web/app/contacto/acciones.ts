"use server";

import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { ContactoResponse } from "@/lib/api/types";
import { EMAIL, texto } from "@/lib/formularios";

/**
 * Server Function del formulario de contacto, con el mismo patrón que las de la
 * sesión (design.md, decisión 8). Valida del lado del servidor del sitio para
 * no gastar un pedido a la API con datos que ya sabemos inválidos, y la API
 * vuelve a validar igual: es un endpoint público.
 */

export type CampoContacto = "nombre" | "email" | "telefono" | "mensaje";

export type ValoresContacto = {
  nombre: string;
  email: string;
  telefono: string;
  mensaje: string;
};

export type EstadoContacto = {
  /** La confirmación que devolvió la API, tal cual. */
  enviado?: string;
  /**
   * Cuántos envíos se aceptaron. El formulario se re-monta con esto para
   * vaciarse: un input no controlado no se limpia por cambiarle `defaultValue`.
   */
  envios?: number;
  /** Falla que no es de un campo: la API caída o un 429. */
  error?: string;
  errores?: Partial<Record<CampoContacto, string>>;
  valores?: ValoresContacto;
};

/** Los mismos límites que declara el contrato para `ContactoRequest`. */
const MAXIMO_NOMBRE = 60;
const MAXIMO_TELEFONO = 30;
const MAXIMO_MENSAJE = 1000;

export async function enviarContacto(
  anterior: EstadoContacto,
  formData: FormData,
): Promise<EstadoContacto> {
  const valores: ValoresContacto = {
    nombre: texto(formData, "nombre"),
    email: texto(formData, "email"),
    telefono: texto(formData, "telefono"),
    mensaje: texto(formData, "mensaje"),
  };
  // El campo trampa se reenvía tal cual: quien decide qué hacer es la API.
  const sitioWeb = texto(formData, "sitioWeb");

  // `envios` se arrastra en todos los caminos: la `key` del formulario depende
  // de él, y perderlo re-montaría los campos y el foco sin motivo.
  const envios = anterior.envios;

  const errores = validar(valores);
  if (Object.keys(errores).length > 0) return { errores, valores, envios };

  let respuesta: ContactoResponse;
  try {
    respuesta = await apiFetch<ContactoResponse>("/contacto", {
      method: "POST",
      timeoutMs: 2000,
      body: {
        nombre: valores.nombre,
        email: valores.email,
        mensaje: valores.mensaje,
        ...(valores.telefono ? { telefono: valores.telefono } : {}),
        sitioWeb,
      },
    });
  } catch (error) {
    // Un error que no vino de la API es un bug y va al error boundary.
    if (!(error instanceof ApiHttpError)) throw error;

    // `titulo` ya es el texto apto para la persona, también en el 429.
    const sinConexion = error.estado === 0;
    return {
      error: sinConexion
        ? "No pudimos enviar tu mensaje. Escribinos por mail o llamanos y lo resolvemos."
        : error.message,
      valores,
      envios,
    };
  }

  return { enviado: respuesta.mensaje, envios: (envios ?? 0) + 1 };
}

function validar(
  valores: ValoresContacto,
): NonNullable<EstadoContacto["errores"]> {
  const errores: NonNullable<EstadoContacto["errores"]> = {};

  if (!valores.nombre) errores.nombre = "Ingresá tu nombre.";
  else if (valores.nombre.length > MAXIMO_NOMBRE)
    errores.nombre = `Como máximo ${MAXIMO_NOMBRE} caracteres.`;

  if (!valores.email) errores.email = "Ingresá tu mail.";
  else if (!EMAIL.test(valores.email)) errores.email = "Ese mail no parece válido.";

  if (valores.telefono.length > MAXIMO_TELEFONO)
    errores.telefono = `Como máximo ${MAXIMO_TELEFONO} caracteres.`;

  if (!valores.mensaje) errores.mensaje = "Escribinos tu consulta.";
  else if (valores.mensaje.length > MAXIMO_MENSAJE)
    errores.mensaje = `Como máximo ${MAXIMO_MENSAJE} caracteres.`;

  return errores;
}
