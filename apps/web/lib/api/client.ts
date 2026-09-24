import type { ApiError } from "./types";

/**
 * Error de la API con el formato `Error` del contrato: `tipo`, `titulo`,
 * `estado` y, cuando vienen, `detalle` e `instancia`. `titulo` es el texto
 * apto para mostrarle a la persona.
 */
export class ApiHttpError extends Error {
  readonly estado: number;
  readonly tipo: string;
  readonly detalle?: string;
  readonly instancia?: string;

  constructor(error: ApiError) {
    super(error.titulo);
    this.name = "ApiHttpError";
    this.estado = error.estado;
    this.tipo = error.tipo;
    this.detalle = error.detalle;
    this.instancia = error.instancia;
  }
}

/** `estado: 0` es la API inalcanzable: no hubo respuesta HTTP. */
const SIN_RESPUESTA = 0;

export function getApiUrl(): string {
  // Sin la barra final, así `${base}${path}` nunca queda con doble barra.
  const url = process.env.API_URL?.replace(/\/+$/, "");
  if (url) return url;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta la variable de entorno API_URL con la base de la API.",
    );
  }
  return "http://localhost:3000/api/v1";
}

function esApiError(valor: unknown): valor is ApiError {
  if (typeof valor !== "object" || valor === null) return false;
  const posible = valor as Record<string, unknown>;
  return (
    typeof posible.tipo === "string" &&
    typeof posible.titulo === "string" &&
    typeof posible.estado === "number"
  );
}

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  /** Se serializa como JSON, salvo que ya sea un `FormData` o un `string`. */
  body?: unknown;
  /** JWT del usuario. Lo lee de la cookie quien llama, no este módulo. */
  token?: string;
  /** Corta la espera y lanza `ApiHttpError` con `estado: 0`. */
  timeoutMs?: number;
};

/**
 * Llama a la API del club y devuelve el cuerpo ya tipado.
 *
 * Lanza `ApiHttpError` si la respuesta no es exitosa o si la API no responde,
 * así quien llama distingue por `estado` y por `tipo` sin volver a parsear nada.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, token, timeoutMs, headers, ...init } = options;

  const cabeceras = new Headers(headers);
  if (token) cabeceras.set("Authorization", `Bearer ${token}`);

  let cuerpo: BodyInit | undefined;
  if (body instanceof FormData || typeof body === "string") {
    cuerpo = body;
  } else if (body !== undefined) {
    cuerpo = JSON.stringify(body);
    if (!cabeceras.has("Content-Type")) {
      cabeceras.set("Content-Type", "application/json");
    }
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(`${getApiUrl()}${path}`, {
      ...init,
      body: cuerpo,
      headers: cabeceras,
      signal: init.signal ?? (timeoutMs ? AbortSignal.timeout(timeoutMs) : null),
      // Explícito a propósito: son datos por usuario y en vivo (disponibilidad,
      // reservas). Quien necesite cachear lo pide con `cache` o `next`.
      cache: init.cache ?? "no-store",
    });
  } catch (causa) {
    // Si quien llama abortó su propio pedido, eso no es una falla de la API:
    // se propaga tal cual. El vencimiento de `timeoutMs` llega como
    // `TimeoutError` y sí cuenta como "no hubo respuesta".
    if (causa instanceof DOMException && causa.name === "AbortError") throw causa;

    throw new ApiHttpError({
      tipo: "SIN_CONEXION",
      titulo: "No se pudo conectar con la API. Intentá de nuevo en un momento.",
      estado: SIN_RESPUESTA,
      detalle: causa instanceof Error ? causa.message : undefined,
      instancia: path,
    });
  }

  const texto = await respuesta.text();
  let datos: unknown;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = undefined;
    }
  }

  if (!respuesta.ok) {
    throw new ApiHttpError(
      esApiError(datos)
        ? datos
        : {
            tipo: "RESPUESTA_INESPERADA",
            titulo: "La API respondió con un error inesperado.",
            estado: respuesta.status,
            instancia: path,
          },
    );
  }

  return datos as T;
}
