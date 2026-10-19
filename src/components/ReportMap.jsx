"use client";
import { useEffect, useRef } from "react";
import { divIcon } from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const pinIcon = divIcon({
  className: "report-pin",
  html: '<svg width="36" height="46" viewBox="-12 -34 24 34" aria-hidden="true"><path d="M0 0C0 0-11-12.5-11-20a11 11 0 0 1 22 0C11-12.5 0 0 0 0Z" fill="var(--color-gold)" stroke="var(--color-ink)" stroke-width="1.5"/><circle cy="-20" r="4.2" fill="var(--color-ink)"/></svg>',
  iconSize: [36, 46],
  iconAnchor: [18, 46],
});

const buzz = () => {
  try {
    navigator.vibrate?.(10);
  } catch {}
};

function Pin({ position, onChange, center, zoom, label }) {
  const map = useMap();
  const marker = useRef(null);
  const valid = position?.every?.(Number.isFinite);
  const pinned = useRef(null);
  pinned.current = valid ? position : null;
  useEffect(() => {
    if (pinned.current)
      map.fitBounds([center, pinned.current], { maxZoom: Math.max(zoom, 16), padding: [40, 40] });
    else map.setView(center, zoom);
  }, [map, center[0], center[1], zoom]);
  useEffect(() => {
    if (valid && !map.getBounds().contains(position)) map.panTo(position);
  }, [position, valid, map]);
  // Keyboard: Enter or Space drops the pin at the centre of the map; arrows nudge it.
  useMapEvents({
    click(event) {
      onChange([event.latlng.lat, event.latlng.lng]);
      buzz();
    },
    keydown(event) {
      const key = event.originalEvent.key;
      if ((key === "Enter" || key === " ") && !pinned.current) {
        event.originalEvent.preventDefault();
        const c = map.getCenter();
        onChange([c.lat, c.lng]);
      }
    },
  });
  useEffect(() => {
    const element = marker.current?.getElement();
    if (!element) return;
    element.setAttribute("aria-label", label);
    const nudge = (event) => {
      const step = 0.00004 * 2 ** (18 - map.getZoom());
      const delta = {
        ArrowUp: [step, 0],
        ArrowDown: [-step, 0],
        ArrowLeft: [0, -step],
        ArrowRight: [0, step],
      }[event.key];
      if (!delta || !pinned.current) return;
      event.preventDefault();
      event.stopPropagation();
      onChange([pinned.current[0] + delta[0], pinned.current[1] + delta[1]]);
    };
    element.addEventListener("keydown", nudge);
    return () => element.removeEventListener("keydown", nudge);
  }, [valid, map, onChange, label]);
  return valid ? (
    <Marker
      ref={marker}
      position={position}
      icon={pinIcon}
      draggable
      keyboard
      eventHandlers={{
        dragend(event) {
          const point = event.target.getLatLng();
          onChange([point.lat, point.lng]);
          buzz();
        },
      }}
    />
  ) : null;
}

export default function ReportMap({
  position,
  onChange,
  center = [42.6629, 21.1655],
  zoom = 13,
  label,
  pinLabel,
  onTileError,
}) {
  const customURL = process.env.NEXT_PUBLIC_MAP_TILE_URL;
  const customAttribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION;
  const useCustom = Boolean(customURL && customAttribution);
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      minZoom={11}
      scrollWheelZoom={false}
      className="report-map h-[min(58svh,26rem)] w-full"
      style={{ zIndex: 0 }}
      attributionControl
      aria-label={label}
    >
      <TileLayer
        attribution={
          useCustom
            ? customAttribution
            : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }
        url={useCustom ? customURL : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
        referrerPolicy="strict-origin-when-cross-origin"
        eventHandlers={{ tileerror: () => onTileError?.() }}
      />
      <Pin position={position} onChange={onChange} center={center} zoom={zoom} label={pinLabel} />
    </MapContainer>
  );
}
