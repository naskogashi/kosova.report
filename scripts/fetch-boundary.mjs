// Fetches a municipality's official administrative boundary from OpenStreetMap
// and saves it as GeoJSON in public/boundaries/<CODE>.json. Kosovo's municipal
// boundaries in OSM are tagged boundary=administrative, admin_level=6.
//
//   npm run boundary -- --code PR --relation 1332181
//
// --code is the city code used in the admin panel (cities.code); --relation is
// the OSM relation id (search "Komuna e ..." on openstreetmap.org). Run it once
// per new city, check the result, and commit the file.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => args[args.indexOf(`--${name}`) + 1];
const code = String(flag("code") || "").toUpperCase();
const relation = Number(flag("relation"));
if (!/^[A-Z0-9]{2,10}$/.test(code) || !Number.isInteger(relation) || relation <= 0) {
  console.error("Usage: npm run boundary -- --code PR --relation 1332181");
  process.exit(1);
}

const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const query = `[out:json][timeout:120];relation(${relation});out body geom;`;

async function overpass() {
  let wait = 5000;
  for (let attempt = 1; attempt <= 6; attempt++) {
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "kosova.report-boundary-tool/1.0" },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(150000),
        });
        if (response.ok) return await response.json();
        console.warn(`${endpoint} answered ${response.status}`);
      } catch (error) {
        console.warn(`${endpoint} failed: ${error.message}`);
      }
    }
    console.warn(`Retrying in ${wait / 1000} s (attempt ${attempt} of 6)…`);
    await new Promise((resolve) => setTimeout(resolve, wait));
    wait *= 2;
  }
  throw new Error("Overpass is unavailable. Try again later.");
}

// Joins the relation's outer ways end to end into closed rings.
function rings(ways) {
  const pending = ways.map((way) => way.map(({ lon, lat }) => [lon, lat]));
  const done = [];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  while (pending.length) {
    let ring = pending.shift();
    let grew = true;
    while (!same(ring[0], ring.at(-1)) && grew) {
      grew = false;
      for (let i = 0; i < pending.length; i++) {
        const way = pending[i];
        if (same(ring.at(-1), way[0])) ring = ring.concat(way.slice(1));
        else if (same(ring.at(-1), way.at(-1))) ring = ring.concat(way.slice(0, -1).reverse());
        else if (same(ring[0], way.at(-1))) ring = way.slice(0, -1).concat(ring);
        else if (same(ring[0], way[0])) ring = way.slice(1).reverse().concat(ring);
        else continue;
        pending.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (!same(ring[0], ring.at(-1))) throw new Error("A boundary ring does not close. Check the relation in OSM.");
    done.push(ring);
  }
  return done;
}

// Douglas–Peucker, about 8 m tolerance: keeps the shape, drops most points.
// A closed ring is split at its farthest point first, because its two ends coincide.
function simplify(points, tolerance = 0.00008) {
  const [x0, y0] = points[0];
  const closed = points.length > 3 && x0 === points.at(-1)[0] && y0 === points.at(-1)[1];
  if (!closed) return simplifyPath(points, tolerance);
  let far = 1;
  for (let i = 1; i < points.length - 1; i++)
    if (Math.hypot(points[i][0] - x0, points[i][1] - y0) > Math.hypot(points[far][0] - x0, points[far][1] - y0)) far = i;
  return simplifyPath(points.slice(0, far + 1), tolerance).concat(simplifyPath(points.slice(far), tolerance).slice(1));
}
function simplifyPath(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0;
    let index = -1;
    const [x1, y1] = points[a];
    const [x2, y2] = points[b];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * points[i][0] - dx * points[i][1] + x2 * y1 - y2 * x1) / length;
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (max > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]).map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))]);
}

const data = await overpass();
const element = data.elements?.find((item) => item.type === "relation");
if (!element) throw new Error(`Relation ${relation} not found.`);
const tags = element.tags || {};
if (tags.boundary !== "administrative") throw new Error(`Relation ${relation} is not an administrative boundary.`);
const outer = element.members.filter((m) => m.type === "way" && m.role === "outer" && m.geometry).map((m) => m.geometry);
const inner = element.members.filter((m) => m.type === "way" && m.role === "inner" && m.geometry).map((m) => m.geometry);
const outerRings = rings(outer).map((ring) => simplify(ring));
const innerRings = inner.length ? rings(inner).map((ring) => simplify(ring)) : [];
const geojson = {
  type: "Feature",
  properties: {
    code,
    name: tags.name,
    nameSq: tags["name:sq"],
    nameSr: tags["name:sr-Latn"] || tags["name:sr"],
    nameEn: tags["name:en"],
    adminLevel: tags.admin_level,
    wikidata: tags.wikidata,
    osmRelation: relation,
    source: "OpenStreetMap administrative boundary (official municipal border). © OpenStreetMap contributors, ODbL 1.0",
    fetched: new Date().toISOString().slice(0, 10),
  },
  geometry: {
    type: "MultiPolygon",
    // Holes are attached to the outer ring that contains them.
    coordinates: outerRings.map((ring) => [ring, ...innerRings.filter((hole) => contains(ring, hole[0]))]),
  },
};
function contains(ring, [x, y]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const directory = path.join(process.cwd(), "public", "boundaries");
mkdirSync(directory, { recursive: true });
const file = path.join(directory, `${code}.json`);
writeFileSync(file, JSON.stringify(geojson) + "\n");
const points = outerRings.reduce((sum, ring) => sum + ring.length, 0);
console.log(`Saved ${file}: ${tags["name:sq"] || tags.name}, ${outerRings.length} outer ring(s), ${points} points.`);
