// Street linework for the city motif, projected once from OpenStreetMap
// (equirectangular, cos 42.66°). Add an entry per city when it launches.
export const cityMaps = {
  PR: {
    src: "/maps/prishtina.svg",
    west: 21.143,
    north: 42.676,
    east: 21.188,
    south: 42.65,
    scale: 1000 / (0.045 * 0.7353),
  },
};

export function project(map, [lat, lng]) {
  return [
    (lng - map.west) * 0.7353 * map.scale,
    (map.north - lat) * map.scale,
  ];
}

export function covers(map, [lat, lng]) {
  return lat <= map.north && lat >= map.south && lng >= map.west && lng <= map.east;
}

export const formatCoords = ([lat, lng]) =>
  `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
