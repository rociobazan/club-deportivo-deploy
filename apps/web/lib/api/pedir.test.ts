import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

import { pedirTexto, SinRespuestaError } from "./pedir.ts";

/*
 * Un servidor de verdad y no un `fetch` falso: lo que se prueba es cómo corta
 * la señal de `AbortSignal.timeout` la lectura del cuerpo, y eso lo hace el
 * `fetch` de Node, no nuestro código.
 */
let servidor: Server;
let base: string;

before(async () => {
  servidor = createServer((pedido, respuesta) => {
    if (pedido.url === "/rapida") {
      respuesta.end('{"ok":true}');
    } else if (pedido.url === "/lenta") {
      setTimeout(() => respuesta.end("{}"), 500);
    } else {
      // Encabezados enseguida, cuerpo tarde: el caso que antes escapaba.
      respuesta.writeHead(200, { "content-type": "application/json" });
      respuesta.write("{");
      setTimeout(() => respuesta.end("}"), 500);
    }
  });
  await new Promise<void>((listo) => servidor.listen(0, "127.0.0.1", listo));
  const direccion = servidor.address();
  assert.ok(direccion && typeof direccion === "object");
  base = `http://127.0.0.1:${direccion.port}`;
});

after(() => {
  servidor.closeAllConnections();
  servidor.close();
});

test("devuelve la respuesta y el cuerpo cuando llegan a tiempo", async () => {
  const { respuesta, texto } = await pedirTexto(`${base}/rapida`, {
    signal: AbortSignal.timeout(1000),
  });

  assert.equal(respuesta.status, 200);
  assert.equal(texto, '{"ok":true}');
});

test("el corte esperando la respuesta es SinRespuestaError", async () => {
  await assert.rejects(
    pedirTexto(`${base}/lenta`, { signal: AbortSignal.timeout(100) }),
    SinRespuestaError,
  );
});

test("el corte leyendo el cuerpo también es SinRespuestaError, no un TimeoutError crudo", async () => {
  await assert.rejects(
    pedirTexto(`${base}/cuerpo-lento`, { signal: AbortSignal.timeout(100) }),
    SinRespuestaError,
  );
});

test("si quien llama aborta su propio pedido, el AbortError se propaga tal cual", async () => {
  const control = new AbortController();
  const pedido = pedirTexto(`${base}/lenta`, { signal: control.signal });
  control.abort();

  await assert.rejects(pedido, (error: unknown) => {
    assert.ok(error instanceof DOMException);
    assert.equal(error.name, "AbortError");
    return true;
  });
});

test("sin servidor del otro lado es SinRespuestaError", async () => {
  await assert.rejects(pedirTexto("http://127.0.0.1:1/nada", {}), SinRespuestaError);
});
