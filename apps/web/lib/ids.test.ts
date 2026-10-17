import assert from "node:assert/strict";
import { test } from "node:test";

import { esIdDeBase } from "./ids.ts";

test("un entero positivo que entra en la columna es un id", () => {
  assert.equal(esIdDeBase("1"), true);
  assert.equal(esIdDeBase("42"), true);
  assert.equal(esIdDeBase("2147483647"), true);
});

test("cero, negativos y lo que se pasa del entero de 32 bits no lo son", () => {
  assert.equal(esIdDeBase("0"), false);
  assert.equal(esIdDeBase("-1"), false);
  assert.equal(esIdDeBase("2147483648"), false);
  assert.equal(esIdDeBase("99999999999"), false);
});

test("lo que no son solo dígitos no lo es", () => {
  assert.equal(esIdDeBase("abc"), false);
  assert.equal(esIdDeBase("1e3"), false);
  assert.equal(esIdDeBase("1.5"), false);
  assert.equal(esIdDeBase(" 1"), false);
  assert.equal(esIdDeBase(""), false);
});
