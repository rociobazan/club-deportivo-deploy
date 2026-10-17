import assert from "node:assert/strict";
import { test } from "node:test";

import { ipDelVisitante } from "./ip-del-visitante.ts";

test("sin X-Forwarded-For no hay IP que reenviar", () => {
  assert.equal(ipDelVisitante(null), undefined);
  assert.equal(ipDelVisitante(""), undefined);
  assert.equal(ipDelVisitante("  ,  "), undefined);
});

test("con una sola IP, es esa", () => {
  assert.equal(ipDelVisitante("203.0.113.10"), "203.0.113.10");
  assert.equal(ipDelVisitante(" 2001:db8::1 "), "2001:db8::1");
});

test("con varias, toma la última: es la que agregó el proxy de confianza", () => {
  assert.equal(ipDelVisitante("1.1.1.1, 203.0.113.10"), "203.0.113.10");
  assert.equal(ipDelVisitante("1.1.1.1, 203.0.113.10, "), "203.0.113.10");
});

test("descarta lo que no parece una IP, para no reenviar basura ni saltos de línea", () => {
  assert.equal(ipDelVisitante("evil\r\nX-Otro: 1"), undefined);
  assert.equal(ipDelVisitante("no-es-una-ip"), undefined);
  // Hexadecimal sin dos puntos no es IPv6.
  assert.equal(ipDelVisitante("dead"), undefined);
  assert.equal(ipDelVisitante("abc"), undefined);
  assert.equal(ipDelVisitante("203.0.113.10:8080"), undefined);
});
