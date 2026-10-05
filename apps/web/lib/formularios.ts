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

/**
 * Un número como se escribe en Argentina: "15000", "15.000", "15000,50" o
 * "$ 15.000,50". Un punto seguido de grupos de tres dígitos es separador de
 * miles, no decimal: "15.000" son quince mil. Lo que no se entiende da `NaN`,
 * y la validación lo rechaza.
 */
export function aNumeroArgentino(valor: string): number {
  const limpio = valor.replace(/[\s$]/g, "");
  if (limpio === "") return Number.NaN;
  if (limpio.includes(",")) return Number(limpio.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) return Number(limpio.replace(/\./g, ""));
  return Number(limpio);
}
