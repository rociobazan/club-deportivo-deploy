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
  if (limpio.includes(",")) {
    // "15,000" es ambiguo: quince mil con coma de miles, o quince con tres
    // decimales. Un precio no lleva más de dos decimales, así que se rechaza
    // en vez de guardar 15 en silencio.
    if (!/,\d{1,2}$/.test(limpio)) return Number.NaN;
    return Number(limpio.replace(/\./g, "").replace(",", "."));
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) return Number(limpio.replace(/\./g, ""));
  return Number(limpio);
}

/** El mayor precio que entra en la columna `Decimal(10,2)`, igual que en la API. */
const PRECIO_MAXIMO = 99_999_999.99;

/**
 * Lo que la API va a rechazar de un precio, dicho para la persona y antes de
 * mandarlo: si no, el 400 llega con el título genérico "La solicitud tiene
 * datos inválidos" y no dice qué corregir. `null` si está bien.
 */
export function errorDePrecio(valor: string): string | null {
  const precio = aNumeroArgentino(valor);
  if (Number.isNaN(precio)) {
    return "Revisá el precio: escribilo en números, con coma para los centavos (15000 o 15000,50).";
  }
  if (precio <= 0) return "El precio por turno tiene que ser mayor que 0.";
  if (Math.round(precio * 100) / 100 !== precio) return "El precio admite hasta dos decimales.";
  if (precio > PRECIO_MAXIMO) return "El precio por turno no puede pasar de $ 99.999.999,99.";
  return null;
}
