"use server";

import { redirect } from "next/navigation";

import { apiFetch, ApiHttpError } from "@/lib/api/client";
import type { LoginResponse, Usuario } from "@/lib/api/types";
import { borrarSesion, destinoSeguro, guardarSesion } from "@/lib/sesion";

/*
 * Server Functions de la sesión (design.md, decisión 10). Son los únicos
 * lugares, junto con los Route Handlers, donde Next permite escribir cookies.
 * `redirect()` lanza por diseño, así que va siempre fuera de los try/catch.
 */

export type EstadoIngreso = {
  error?: string;
  valores?: { email: string };
};

export type CampoRegistro = "nombre" | "apellido" | "email" | "password" | "telefono";

export type EstadoRegistro = {
  error?: string;
  errores?: Partial<Record<CampoRegistro, string>>;
  valores?: { nombre: string; apellido: string; email: string; telefono: string };
};

const texto = (formData: FormData, campo: string) =>
  String(formData.get(campo) ?? "").trim();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `titulo` es el texto apto para la persona; si no fue la API, es un bug y se propaga. */
function mensajeDe(error: unknown): string {
  if (error instanceof ApiHttpError) return error.message;
  throw error;
}

export async function ingresar(
  _anterior: EstadoIngreso,
  formData: FormData,
): Promise<EstadoIngreso> {
  const email = texto(formData, "email");
  const password = String(formData.get("password") ?? "");
  const volver = destinoSeguro(formData.get("volver"));
  const valores = { email };

  if (!email || !password) {
    return { error: "Completá el mail y la contraseña.", valores };
  }

  let sesion: LoginResponse;
  try {
    sesion = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
  } catch (error) {
    // Ante credenciales inválidas la API responde lo mismo exista o no el mail.
    return { error: mensajeDe(error), valores };
  }

  await guardarSesion(sesion.accessToken, sesion.expiraEn);
  redirect(volver);
}

export async function registrarse(
  _anterior: EstadoRegistro,
  formData: FormData,
): Promise<EstadoRegistro> {
  const valores = {
    nombre: texto(formData, "nombre"),
    apellido: texto(formData, "apellido"),
    email: texto(formData, "email"),
    telefono: texto(formData, "telefono"),
  };
  const password = String(formData.get("password") ?? "");
  const volver = destinoSeguro(formData.get("volver"));

  const errores = validarRegistro(valores, password);
  if (Object.keys(errores).length > 0) return { errores, valores };

  try {
    await apiFetch<Usuario>("/auth/registro", {
      method: "POST",
      body: {
        nombre: valores.nombre,
        apellido: valores.apellido,
        email: valores.email,
        password,
        ...(valores.telefono ? { telefono: valores.telefono } : {}),
      },
    });
  } catch (error) {
    if (error instanceof ApiHttpError && error.estado === 409) {
      return {
        errores: { email: "Ese mail ya está registrado. Si es tuyo, ingresá." },
        valores,
      };
    }
    return { error: mensajeDe(error), valores };
  }

  // El registro no devuelve token (así lo define el contrato): se ingresa después.
  let sesion: LoginResponse;
  try {
    sesion = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email: valores.email, password },
    });
  } catch (error) {
    // Un error que no vino de la API es un bug y se propaga al error boundary.
    if (!(error instanceof ApiHttpError)) throw error;
    return {
      error: "La cuenta se creó, pero no pudimos iniciar la sesión. Ingresá con tu mail y contraseña.",
      valores,
    };
  }

  await guardarSesion(sesion.accessToken, sesion.expiraEn);
  redirect(volver);
}

export async function cerrarSesion(): Promise<void> {
  await borrarSesion();
  redirect("/");
}

function validarRegistro(
  valores: NonNullable<EstadoRegistro["valores"]>,
  password: string,
): NonNullable<EstadoRegistro["errores"]> {
  const errores: NonNullable<EstadoRegistro["errores"]> = {};

  if (!valores.nombre) errores.nombre = "Ingresá tu nombre.";
  else if (valores.nombre.length > 60) errores.nombre = "Como máximo 60 caracteres.";

  if (!valores.apellido) errores.apellido = "Ingresá tu apellido.";
  else if (valores.apellido.length > 60) errores.apellido = "Como máximo 60 caracteres.";

  if (!valores.email) errores.email = "Ingresá tu mail.";
  else if (!EMAIL.test(valores.email)) errores.email = "Ese mail no parece válido.";

  if (password.length < 8) errores.password = "La contraseña tiene que tener al menos 8 caracteres.";

  if (valores.telefono.length > 30) errores.telefono = "Como máximo 30 caracteres.";

  return errores;
}
