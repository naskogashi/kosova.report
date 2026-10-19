import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { insideBoundary } from "../src/lib/boundary-geometry.js";

const prishtina = JSON.parse(readFileSync(new URL("../public/boundaries/PR.json", import.meta.url), "utf8"));

test("Prishtina boundary is the official municipality from OpenStreetMap", () => {
  assert.equal(prishtina.properties.code, "PR");
  assert.equal(prishtina.properties.osmRelation, 1332181);
  assert.equal(prishtina.properties.adminLevel, "6");
});

test("points in Prishtina are inside", () => {
  for (const point of [
    [42.66224, 21.16241], // Sheshi Nëna Terezë
    [42.66433, 21.165], // Rruga Agim Ramadani
    [42.672, 21.205], // Gërmia park
  ])
    assert.equal(insideBoundary(prishtina, point), true, `expected inside: ${point}`);
});

test("points in neighbouring municipalities are outside", () => {
  for (const point of [
    [42.6395, 21.0935], // Fushë Kosovë centre
    [42.596, 21.193], // Gračanica centre
    [42.687, 21.072], // Obiliq centre
    [43.0, 21.3], // far north
  ])
    assert.equal(insideBoundary(prishtina, point), false, `expected outside: ${point}`);
});

test("invalid points are never inside", () => {
  assert.equal(insideBoundary(prishtina, [NaN, 21.1]), false);
  assert.equal(insideBoundary(null, [42.66, 21.16]), false);
});
