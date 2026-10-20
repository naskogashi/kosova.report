"use client";
import { useEffect } from "react";
import { divIcon } from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// A look-only map: the reporter's own pin and numbered pins for problems already reported nearby,
// or one incident on its public page. Approximate places are drawn as a soft circle, not a pin.
const youIcon = divIcon({
  className: "report-pin",
  html: '<svg width="30" height="38" viewBox="-12 -34 24 34" aria-hidden="true"><path d="M0 0C0 0-11-12.5-11-20a11 11 0 0 1 22 0C11-12.5 0 0 0 0Z" fill="var(--color-gold)" stroke="var(--color-ink)" stroke-width="1.5"/><circle cy="-20" r="4.2" fill="var(--color-ink)"/></svg>',
  iconSize: [30, 38],
  iconAnchor: [15, 38],
});
const numberIcon = (number, selected) =>
  divIcon({
    className: "incident-pin",
    html: `<span style="display:flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:999px;font:800 15px/1 var(--font-sans,system-ui);background:${selected ? "var(--color-blue)" : "var(--color-card)"};color:${selected ? "var(--color-on-blue)" : "var(--color-blue)"};box-shadow:0 0 0 2px var(--color-blue),0 4px 10px var(--shadow-tint)">${number}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

function Fit({ points }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join(";");
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 17);
    else if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 18 });
  }, [map, key]);
  return null;
}

export default function IncidentMap({ you, places = [], label, className = "h-64" }) {
  const points = [...(you ? [you] : []), ...places.map((place) => place.point)];
  const customURL = process.env.NEXT_PUBLIC_MAP_TILE_URL;
  const customAttribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION;
  const useCustom = Boolean(customURL && customAttribution);
  if (!points.length) return null;
  return (
    <MapContainer
      center={points[0]}
      zoom={17}
      minZoom={11}
      scrollWheelZoom={false}
      dragging={false}
      touchZoom
      doubleClickZoom
      keyboard={false}
      className={`w-full ${className}`}
      style={{ zIndex: 0 }}
      aria-label={label}
    >
      <TileLayer
        attribution={useCustom ? customAttribution : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}
        url={useCustom ? customURL : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <Fit points={points} />
      {places.map((place) =>
        place.exact || place.number ? (
          <Marker
            key={place.key}
            position={place.point}
            icon={place.number ? numberIcon(place.number, place.selected) : youIcon}
            keyboard={false}
            interactive={false}
          />
        ) : null,
      )}
      {places
        .filter((place) => !place.exact)
        .map((place) => (
          <Circle
            key={`area-${place.key}`}
            center={place.point}
            radius={40}
            interactive={false}
            pathOptions={{ className: "incident-area" }}
          />
        ))}
      {you && <Marker position={you} icon={youIcon} keyboard={false} interactive={false} />}
    </MapContainer>
  );
}
