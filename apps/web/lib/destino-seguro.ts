/**
 * Adónde volver después de ingresar. Solo rutas relativas del propio sitio:
 * `https://otro.test` y `//otro.test` se descartan (spec: "Destino externo
 * ignorado"). Módulo sin dependencias para poder probarlo con Node a secas.
 */
export function destinoSeguro(volver: unknown): string {
  if (typeof volver !== "string") return "/";
  if (!volver.startsWith("/") || volver.startsWith("//")) return "/";
  return volver;
}
