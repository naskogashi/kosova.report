"use client";
import { useEffect, useRef, useState } from "react";
import { divIcon } from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from "react-leaflet";
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

// Turns one-finger panning on or off after the map has mounted.
function Panning({ enabled }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) map.dragging.enable();
    else map.dragging.disable();
  }, [map, enabled]);
  return null;
}

export default function ReportMap({
  position,
  onChange,
  center = [42.6629, 21.1655],
  zoom = 13,
  label,
  pinLabel,
  onTileError,
  outline,
  moveLabel = "Move map",
  doneLabel = "Done",
}) {
  const customURL = process.env.NEXT_PUBLIC_MAP_TILE_URL;
  const customAttribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION;
  const useCustom = Boolean(customURL && customAttribution);
  // On touch screens a swipe over the map scrolls the page. Panning is opt-in with a button;
  // tapping still places the pin, the pin can still be dragged and two fingers still zoom.
  const [touch, setTouch] = useState(false);
  const [panning, setPanning] = useState(false);
  useEffect(() => {
    const query = matchMedia("(pointer: coarse)");
    const sync = () => setTouch(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const locked = touch && !panning;
  return (
    <div className="relative">
    {touch && (
      <button
        type="button"
        onClick={() => setPanning((value) => !value)}
        aria-pressed={panning}
        className="absolute top-3 right-3 z-[500] inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-4 text-sm font-bold text-ink shadow-lift aria-pressed:bg-blue aria-pressed:text-on-blue"
      >
        {panning ? doneLabel : moveLabel}
      </button>
    )}
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
      <Panning enabled={!locked} />
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
      {/* The municipality's official border, so people can see where reports are accepted. */}
      {outline && (
        <Polygon positions={outline} interactive={false} pathOptions={{ className: "city-outline", fill: false }} />
      )}
      <Pin position={position} onChange={onChange} center={center} zoom={zoom} label={pinLabel} />
    </MapContainer>
    </div>
  );
}
