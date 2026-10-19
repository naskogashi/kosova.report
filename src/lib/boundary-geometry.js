// Point-in-municipality checks against the GeoJSON boundaries in public/boundaries/.
// Pure functions, used in the browser (live feedback) and on the server (validation).
// Coordinates in GeoJSON are [lng, lat]; points here are [lat, lng] like the rest of the app.

function inRing(ring, lng, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function insideBoundary(feature, [lat, lng]) {
  const geometry = feature?.geometry;
  if (!geometry || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates || [];
  return polygons.some(([outer, ...holes]) => inRing(outer, lng, lat) && !holes.some((hole) => inRing(hole, lng, lat)));
}

// Leaflet wants [lat, lng] rings.
export const boundaryOutline = (feature) =>
  (feature?.geometry?.coordinates || []).map((polygon) => polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng])));
