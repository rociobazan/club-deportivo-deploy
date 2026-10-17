/**
 * Adónde volver después de ingresar. Solo rutas relativas del propio sitio:
 * `https://otro.test` y `//otro.test` se descartan (spec: "Destino externo
 * ignorado"). Módulo sin dependencias para poder probarlo con Node a secas.
 *
 * Dos filtros y una resolución (decisión 36). Primero lo que ningún destino
 * legítimo tiene: una barra invertida, que los navegadores leen como barra
 * (`/\evil.com` → `//evil.com`), y los caracteres de control, que el parser
 * de URL descarta antes de resolver (`/\t/evil.com` → `//evil.com`). Después
 * se resuelve contra un origen cualquiera y se exige que siga siendo ese
 * origen y una ruta con barra inicial: cubre cualquier otra forma de escaparse.
 */
const PROHIBIDOS = /[\\\u0000-\u001f\u007f]/;
const ORIGEN = "http://sitio.local";

export function destinoSeguro(volver: unknown): string {
  if (typeof volver !== "string") return "/";
  if (!volver.startsWith("/") || volver.startsWith("//")) return "/";
  if (PROHIBIDOS.test(volver)) return "/";

  let resuelta: URL;
  try {
    resuelta = new URL(volver, ORIGEN);
  } catch {
    return "/";
  }
  if (resuelta.origin !== ORIGEN || !resuelta.pathname.startsWith("/")) return "/";
  return volver;
}
