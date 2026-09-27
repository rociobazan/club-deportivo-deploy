/**
 * Lo que comparten las Server Functions que reciben un `FormData`: leer un
 * campo y validar un mail. Vivía repetido en las acciones de la sesión y en las
 * del contacto; con una sola copia las dos validan igual.
 */

/** Lee un campo de texto y le saca los espacios de los extremos. */
export const texto = (formData: FormData, campo: string) =>
  String(formData.get(campo) ?? "").trim();

/**
 * Misma forma que usa la API con `@IsEmail()` para lo que nos importa: que haya
 * algo, un arroba y un dominio con punto. La validación fina la hace la API.
 */
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
