/**
 * La IP del visitante, para reenviársela a la API en `X-Forwarded-For` desde
 * las Server Actions públicas (contacto, ingreso y registro). La API aplica sus
 * límites por IP, y sin esto siempre vería la del servidor del sitio: un solo
 * contador para todos los visitantes.
 *
 * Toma la **última** entrada del `X-Forwarded-For` que recibió Next, que es la
 * que agregó el proxy de confianza (Caddy pisa la que traiga el cliente).
 * Sin encabezado, como en local sin Caddy, no hay nada que reenviar y la API
 * usa la IP del socket. Módulo sin dependencias para probarlo con Node a secas.
 */

// IPv4 con puntos o IPv6 con dos puntos y hexadecimales: lo que puede haber
// puesto un proxy. Cualquier otra cosa (texto, saltos de línea, puerto) se
// descarta en vez de reenviarse.
const IP = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-fA-F:]+)$/;

export function ipDelVisitante(xForwardedFor: string | null | undefined): string | undefined {
  if (!xForwardedFor) return undefined;
  const entradas = xForwardedFor
    .split(",")
    .map((entrada) => entrada.trim())
    .filter((entrada) => entrada !== "");
  const ultima = entradas.at(-1);
  if (!ultima || !IP.test(ultima)) return undefined;
  return ultima;
}
