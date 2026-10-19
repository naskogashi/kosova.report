"use client";
import { useEffect } from "react";
import { divIcon } from "leaflet";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
const pinIcon = divIcon({
  className: "report-pin",
  html: '<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg"><path d="M16 40S2 24 2 16a14 14 0 1 1 28 0c0 8-14 24-14 24Z" fill="#0843b5" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="white"/></svg>',
  iconSize: [32, 42],
  iconAnchor: [16, 40],
});
function Pin({ position, onChange }) {
  const map = useMap();
  const valid =
    position &&
    position.every(Number.isFinite) &&
    Math.abs(position[0]) <= 90 &&
    Math.abs(position[1]) <= 180;
  useMapEvents({
    click(event) {
      onChange([event.latlng.lat, event.latlng.lng]);
    },
  });
  useEffect(() => {
    if (valid && !map.getBounds().contains(position)) map.panTo(position);
  }, [position, valid, map]);
  return valid ? (
    <Marker
      position={position}
      icon={pinIcon}
      draggable
      eventHandlers={{
        dragend(event) {
          const point = event.target.getLatLng();
          onChange([point.lat, point.lng]);
        },
      }}
    />
  ) : null;
}
export default function ReportMap({ position, onChange }) {
  return (
    <MapContainer
      center={[42.6, 20.9]}
      zoom={8}
      minZoom={7}
      maxBounds={[
        [41.5, 19.5],
        [43.6, 22.3],
      ]}
      scrollWheelZoom={false}
      style={{ height: 340, width: "100%", zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Pin position={position} onChange={onChange} />
    </MapContainer>
  );
}
