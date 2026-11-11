/**
 * La API no respondió a tiempo o no se pudo llegar a ella. `apiFetch` lo
 * convierte en `ApiHttpError` con `estado: 0` y `tipo: SIN_CONEXION`.
 */
export class SinRespuestaError extends Error {
  constructor(causa: unknown) {
    super(causa instanceof Error ? causa.message : String(causa));
    this.name = "SinRespuestaError";
  }
}

/**
 * Hace el pedido y lee el cuerpo **bajo el mismo `try`**. La señal de corte
 * (`AbortSignal.timeout`) también interrumpe la lectura del cuerpo: si la API
 * manda los encabezados a tiempo y el cuerpo tarde, `text()` rechaza con un
 * `TimeoutError` que antes escapaba crudo, sin pasar por `SIN_CONEXION`.
 *
 * Si quien llama abortó su propio pedido (`AbortError`), eso no es una falla
 * de la API y se propaga tal cual.
 */
export async function pedirTexto(
  url: string,
  init: RequestInit,
): Promise<{ respuesta: Response; texto: string }> {
  try {
    const respuesta = await fetch(url, init);
    const texto = await respuesta.text();
    return { respuesta, texto };
  } catch (causa) {
    if (causa instanceof DOMException && causa.name === "AbortError") throw causa;
    throw new SinRespuestaError(causa);
  }
}
