"use client";

import { useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix leaflet default icon
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MarkerData {
  position: [number, number];
  label: string;
  popup?: string;
  color?: string;
  shape?: "circle" | "square";
}

interface MapViewProps {
  center: [number, number];
  zoom?: number;
  markers?: MarkerData[];
  polyline?: [number, number][];
  height?: string;
  showMyLocation?: boolean;
}

function createIcon(color: string, shape: "circle" | "square" = "circle") {
  const radius = shape === "square" ? "3px" : "50%";
  const size = shape === "square" ? 16 : 14;
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:${radius};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const myLocationIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;width:20px;height:20px;">
    <div style="position:absolute;inset:0;background:#3b82f6;border-radius:50%;opacity:0.3;animation:pulse 2s infinite;"></div>
    <div style="position:absolute;top:4px;left:4px;width:12px;height:12px;background:#3b82f6;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
  </div>
  <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:0.3}50%{transform:scale(2);opacity:0}}</style>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function LocateButton({ onLocate }: { onLocate: (pos: [number, number]) => void }) {
  const map = useMap();
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    if (!navigator.geolocation) return alert("이 브라우저에서 위치 기능을 지원하지 않습니다.");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        onLocate(latlng);
        map.flyTo(latlng, map.getZoom());
        setLoading(false);
      },
      () => {
        alert("위치를 가져올 수 없습니다. 위치 권한을 확인하세요.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <button
      onClick={handleClick}
      title="내 위치"
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 1000,
        width: 34,
        height: 34,
        background: "white",
        border: "2px solid rgba(0,0,0,0.2)",
        borderRadius: 4,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
      }}
    >
      {loading ? "..." : "📍"}
    </button>
  );
}

export default function MapView({
  center,
  zoom = 7,
  markers = [],
  polyline,
  height = "400px",
  showMyLocation = false,
}: MapViewProps) {
  const [myPos, setMyPos] = useState<[number, number] | null>(null);

  return (
    <div style={{ height, position: "relative" }} className="rounded-xl overflow-hidden border border-slate-200">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {markers.map((m, i) => (
          <Marker key={i} position={m.position} icon={createIcon(m.color || "#3b82f6", m.shape || "circle")}>
            {m.popup && (
              <Popup>
                <div dangerouslySetInnerHTML={{ __html: m.popup }} />
              </Popup>
            )}
          </Marker>
        ))}
        {polyline && polyline.length > 1 && (
          <Polyline
            positions={polyline}
            pathOptions={{ color: "#94a3b8", weight: 2, dashArray: "8" }}
          />
        )}
        {myPos && (
          <>
            <Circle
              center={myPos}
              radius={100}
              pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.1, weight: 1 }}
            />
            <Marker position={myPos} icon={myLocationIcon}>
              <Popup>내 위치</Popup>
            </Marker>
          </>
        )}
        {showMyLocation && <LocateButton onLocate={setMyPos} />}
      </MapContainer>
    </div>
  );
}
