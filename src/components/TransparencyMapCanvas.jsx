"use client";
import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "../i18n/navigation";
import { boundaryOutline } from "../lib/boundary-geometry";

const statusClass = { Pending: "pending", "In Progress": "progress", Resolved: "resolved" };

// OpenStreetMap with the municipality's boundary and one dot per issue, coloured by status.
// Approximate places are a larger dashed circle; published issues are a small solid dot.
export default function TransparencyMapCanvas({ city, issues, label, text }) {
  const [boundary, setBoundary] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`/boundaries/${city.code}.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((feature) => alive && setBoundary(feature))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [city.code]);
  const customURL = process.env.NEXT_PUBLIC_MAP_TILE_URL;
  const customAttribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION;
  const useCustom = Boolean(customURL && customAttribution);
  return (
    <MapContainer
      center={city.center}
      zoom={city.zoom}
      minZoom={10}
      scrollWheelZoom={false}
      className="h-[min(70svh,36rem)] w-full rounded-lg shadow-[0_0_0_1px_var(--color-rule)]"
      style={{ zIndex: 0 }}
      aria-label={label}
    >
      <TileLayer
        attribution={useCustom ? customAttribution : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}
        url={useCustom ? customURL : "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
        referrerPolicy="strict-origin-when-cross-origin"
      />
      {boundary && <Polygon positions={boundaryOutline(boundary)} interactive={false} pathOptions={{ className: "map-boundary" }} />}
      {issues.map((issue) => (
        <CircleMarker
          key={issue.ref}
          center={issue.point}
          radius={issue.exact ? 7 : 11}
          pathOptions={{ className: `map-dot map-${statusClass[issue.status] || "pending"}${issue.exact ? "" : " map-approximate"}` }}
        >
          <Popup>
            <p className="m-0 font-bold">{text.category(issue.category)}</p>
            <p className="m-0">{text.status(issue.status)}</p>
            <p className="m-0 text-pencil">
              {text.reported(issue.report_count)} · {text.since(issue.first_reported_at)}
            </p>
            <Link href={{ pathname: "/incident/[ref]", params: { ref: issue.ref } }} className="font-bold text-blue">
              {text.open}
            </Link>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
