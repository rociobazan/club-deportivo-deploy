import assert from "node:assert/strict";
import { test } from "node:test";

import { destinoSeguro } from "./destino-seguro.ts";

test("una ruta relativa del sitio se respeta, con su query", () => {
  assert.equal(destinoSeguro("/mis-reservas"), "/mis-reservas");
  assert.equal(destinoSeguro("/mis-reservas?x=1&y=2"), "/mis-reservas?x=1&y=2");
  assert.equal(destinoSeguro("/"), "/");
});

test("sin parámetro, o con algo que no es texto, vuelve al inicio", () => {
  assert.equal(destinoSeguro(undefined), "/");
  assert.equal(destinoSeguro(null), "/");
  assert.equal(destinoSeguro(["/a", "/b"]), "/");
  assert.equal(destinoSeguro(""), "/");
});

test("un destino externo o sin barra inicial se ignora", () => {
  assert.equal(destinoSeguro("https://otro.test"), "/");
  assert.equal(destinoSeguro("//evil.com"), "/");
  assert.equal(destinoSeguro("mis-reservas"), "/");
  assert.equal(destinoSeguro("javascript:alert(1)"), "/");
});

test("una barra invertida se ignora: los navegadores la leen como barra", () => {
  assert.equal(destinoSeguro("/\\evil.com"), "/");
  assert.equal(destinoSeguro("/\\/evil.com"), "/");
});

test("un carácter de control se ignora: el parser de URL lo descarta y cambia el destino", () => {
  assert.equal(destinoSeguro("/\t/evil.com"), "/");
  assert.equal(destinoSeguro("/\n/evil.com"), "/");
  assert.equal(destinoSeguro("/mis-reservas\u0000"), "/");
});
