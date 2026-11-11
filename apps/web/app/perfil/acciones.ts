"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiFetch, ApiHttpError, encabezadosDelVisitante } from "@/lib/api/client";
import type { LoginResponse, Usuario } from "@/lib/api/types";
import { EMAIL, texto } from "@/lib/formularios";
import { borrarSesion, guardarSesion, leerToken, obtenerUsuario } from "@/lib/sesion";

/*
 * Las dos Server Functions del perfil, separadas a propósito: son dos
 * operaciones con dos modos de fallar, y un error de contraseña no puede
 * borrar lo que la persona escribió en sus datos (design.md, decisión 6).
 *
 * La autorización real la hace la API con el token: acá no se decide nada
 * sobre permisos, solo se reenvía la sesión.
 */

export type CampoPerfil = "nombre" | "apellido" | "email" | "telefono";

export type EstadoPerfil = {
  error?: string;
  errores?: Partial<Record<CampoPerfil, string>>;
  guardado?: string;
  /** Avisa que a partir de ahora se ingresa con el mail nuevo. */
  mailCambiado?: boolean;
  valores?: Record<CampoPerfil, string>;
};

export type EstadoPassword = {
  error?: string;
  guardado?: string;
  /**
   * Cuenta de intentos. El formulario la usa como `key` para re-montarse y
   * vaciar los campos: con el texto del mensaje no alcanzaba, porque dos
   * errores iguales seguidos daban la misma `key` y la contraseña rechazada
   * se quedaba escrita en pantalla.
   */
  intentos?: number;
};

/** `titulo` es el texto apto para la persona; si no fue la API, es un bug y se propaga. */
function mensajeDe(error: unknown): string {
  if (error instanceof ApiHttpError) return error.message;
  throw error;
}

function validar(valores: Record<CampoPerfil, string>) {
  const errores: Partial<Record<CampoPerfil, string>> = {};
  if (!valores.nombre) errores.nombre = "Poné tu nombre.";
  if (!valores.apellido) errores.apellido = "Poné tu apellido.";
  if (!EMAIL.test(valores.email)) errores.email = "Revisá el mail.";
  return errores;
}

export async function actualizarPerfil(
  _anterior: EstadoPerfil,
  formData: FormData,
): Promise<EstadoPerfil> {
  const valores: Record<CampoPerfil, string> = {
    nombre: texto(formData, "nombre"),
    apellido: texto(formData, "apellido"),
    email: texto(formData, "email"),
    telefono: texto(formData, "telefono"),
  };
  const emailAnterior = texto(formData, "emailAnterior");

  const errores = validar(valores);
  if (Object.keys(errores).length > 0) return { errores, valores };

  const token = await leerToken();

  try {
    await apiFetch<Usuario>("/auth/perfil", {
      method: "PATCH",
      token,
      timeoutMs: 2000,
      // El teléfono vacío se manda como `null`: así se borra, según el contrato.
      body: {
        nombre: valores.nombre,
        apellido: valores.apellido,
        email: valores.email,
        telefono: valores.telefono || null,
      },
    });
  } catch (error) {
    if (error instanceof ApiHttpError && error.estado === 409) {
      return { errores: { email: "Ese mail ya está registrado por otra cuenta." }, valores };
    }
    return { error: mensajeDe(error), valores };
  }

  // La página vuelve a pedir el perfil, así lo que se ve es lo que quedó guardado.
  revalidatePath("/perfil");

  return {
    guardado: "Guardamos tus datos.",
    /*
     * Sin normalizar, escribir el mismo mail con otras mayúsculas mostraba el
     * aviso de que cambió. La API lo pasa a minúsculas, así que ahí no cambió
     * nada y decirlo sería mentir.
     */
    mailCambiado: valores.email.toLowerCase() !== emailAnterior.toLowerCase(),
    valores,
  };
}

export async function cambiarPassword(
  anterior: EstadoPassword,
  formData: FormData,
): Promise<EstadoPassword> {
  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const repetida = String(formData.get("repetida") ?? "");

  /*
   * La repetición se valida acá y no en la API: es una ayuda de la pantalla
   * para que nadie se cambie la contraseña por una que escribió mal, no una
   * regla del sistema. El contrato no la conoce.
   */
  const intentos = (anterior.intentos ?? 0) + 1;

  if (nueva !== repetida) return { error: "Las dos contraseñas nuevas no coinciden.", intentos };
  if (nueva.length < 8)
    return { error: "La contraseña nueva necesita al menos 8 caracteres.", intentos };

  const token = await leerToken();
  // El mail para volver a ingresar se lee antes: después del cambio este token ya no sirve.
  const usuario = await obtenerUsuario();

  try {
    await apiFetch<void>("/auth/password", {
      method: "PUT",
      token,
      timeoutMs: 2000,
      body: { actual, nueva },
    });
  } catch (error) {
    return { error: mensajeDe(error), intentos };
  }

  /*
   * El cambio cerró todas las sesiones de la cuenta, también esta
   * (design.md de RF-16, decisión 10). Se vuelve a ingresar con la nueva para
   * que quien la cambió siga adentro en este navegador.
   */
  if (usuario) {
    try {
      const sesion = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        headers: await encabezadosDelVisitante(),
        timeoutMs: 2000,
        body: { email: usuario.email, password: nueva },
      });
      await guardarSesion(sesion.accessToken, sesion.expiraEn);
      return { guardado: "Cambiamos tu contraseña.", intentos };
    } catch (error) {
      /*
       * Cualquier falla, no solo las de la API: la contraseña ya cambió y la
       * cookie quedó con un token revocado, así que relanzar dejaría a la
       * persona en la pantalla de error con una sesión que da 401 en la
       * próxima navegación. Lo que no vino de la API va al log, sin datos.
       */
      if (!(error instanceof ApiHttpError)) {
        console.error(`Falló el reingreso después de cambiar la contraseña (${nombreDeError(error)}).`);
      }
    }
  }

  // Sin reingreso la cookie ya no sirve: se borra y se avisa en el ingreso,
  // que después de entrar vuelve al perfil.
  await borrarSesion();
  redirect("/ingresar?cambiada=1&volver=%2Fperfil");
}

/** Solo el nombre: el mensaje de un error puede traer datos de la solicitud. */
function nombreDeError(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
