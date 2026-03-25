"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";

interface MarkerData {
  position: [number, number];
  label: string;
  popup?: string;
  color?: string;
  shape?: "circle" | "square";
}

interface GoogleMapViewProps {
  center: [number, number];
  zoom?: number;
  markers?: MarkerData[];
  polyline?: [number, number][];
  height?: string;
  showMyLocation?: boolean;
  bounds?: [number, number][];
  highlightedMarkerIndex?: number | null;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

/* ────── Polyline drawer (uses Maps JS directly) ────── */
function PolylineLayer({ path }: { path: [number, number][] }) {
  const map = useMap();
  const polyRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || path.length < 2) return;
    if (polyRef.current) polyRef.current.setMap(null);

    polyRef.current = new google.maps.Polyline({
      path: path.map(([lat, lng]) => ({ lat, lng })),
      strokeColor: "#94a3b8",
      strokeWeight: 2,
      strokeOpacity: 0.8,
      geodesic: true,
      icons: [
        {
          icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
          offset: "0",
          repeat: "16px",
        },
      ],
    });
    polyRef.current.setMap(map);

    return () => {
      polyRef.current?.setMap(null);
    };
  }, [map, path]);

  return null;
}

/* ────── Fit bounds controller ────── */
function FitBoundsController({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || bounds.length === 0) return;
    if (bounds.length === 1) {
      map.setCenter({ lat: bounds[0][0], lng: bounds[0][1] });
      map.setZoom(13);
      return;
    }
    const gb = new google.maps.LatLngBounds();
    bounds.forEach(([lat, lng]) => gb.extend({ lat, lng }));
    map.fitBounds(gb, 40);
  }, [map, bounds]);

  return null;
}

/* ────── My Location button ────── */
function MyLocationButton() {
  const map = useMap();
  const [loading, setLoading] = useState(false);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  const handleClick = useCallback(() => {
    if (!navigator.geolocation || !map) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.panTo(latlng);

        // cleanup old
        markerRef.current?.setMap(null);
        circleRef.current?.setMap(null);

        circleRef.current = new google.maps.Circle({
          center: latlng,
          radius: pos.coords.accuracy,
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
          strokeColor: "#3b82f6",
          strokeWeight: 1,
          map,
        });

        markerRef.current = new google.maps.Marker({
          position: latlng,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "white",
            strokeWeight: 2,
          },
          title: "My Location",
        });

        setLoading(false);
      },
      () => {
        alert("위치를 가져올 수 없습니다.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [map]);

  return (
    <button
      onClick={handleClick}
      title="내 위치"
      style={{
        position: "absolute",
        top: 10,
        right: 60,
        zIndex: 1,
        width: 40,
        height: 40,
        background: "white",
        border: "none",
        borderRadius: 2,
        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
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

/* ────── Highlight controller: pan + zoom to highlighted marker ────── */
function HighlightController({
  markers,
  highlightedMarkerIndex,
}: {
  markers: MarkerData[];
  highlightedMarkerIndex: number | null | undefined;
}) {
  const map = useMap();

  useEffect(() => {
    if (
      !map ||
      highlightedMarkerIndex == null ||
      highlightedMarkerIndex < 0 ||
      highlightedMarkerIndex >= markers.length
    )
      return;

    const m = markers[highlightedMarkerIndex];
    map.panTo({ lat: m.position[0], lng: m.position[1] });
    map.setZoom(14);
  }, [map, markers, highlightedMarkerIndex]);

  return null;
}

/* ────── Single marker (highlight only, no popup) ────── */
function MarkerWithInfo({
  marker,
  highlighted = false,
}: {
  marker: MarkerData;
  highlighted?: boolean;
}) {
  const size = marker.shape === "square" ? 16 : 14;
  const radius = marker.shape === "square" ? "3px" : "50%";

  return (
    <AdvancedMarker
      position={{ lat: marker.position[0], lng: marker.position[1] }}
      title={marker.label}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Label above marker when highlighted */}
        {highlighted && (
          <div
            style={{
              background: "rgba(30,41,59,0.85)",
              color: "white",
              fontSize: 11,
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: 6,
              marginBottom: 4,
              whiteSpace: "nowrap",
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {marker.label}
          </div>
        )}
        <div
          style={{
            background: marker.color || "#3b82f6",
            width: highlighted ? size + 6 : size,
            height: highlighted ? size + 6 : size,
            borderRadius: radius,
            border: highlighted ? "3px solid #facc15" : "2px solid white",
            boxShadow: highlighted
              ? "0 0 8px rgba(250, 204, 21, 0.6), 0 1px 4px rgba(0,0,0,0.3)"
              : "0 1px 4px rgba(0,0,0,0.3)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        />
      </div>
    </AdvancedMarker>
  );
}

/* ────── Google Maps URL: 마커 전체를 한번에 열기 ────── */
function buildGoogleMapsUrl(markers: MarkerData[], polyline?: [number, number][]) {
  if (markers.length === 0) return null;

  // 경유지가 있으면 directions 모드 (최대 10개 waypoint)
  if (polyline && polyline.length >= 2) {
    const origin = `${polyline[0][0]},${polyline[0][1]}`;
    const dest = `${polyline[polyline.length - 1][0]},${polyline[polyline.length - 1][1]}`;
    const waypoints = polyline
      .slice(1, -1)
      .slice(0, 8) // Google Maps URL은 waypoint 최대 8개
      .map(([lat, lng]) => `${lat},${lng}`)
      .join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ""}&travelmode=transit`;
  }

  // 마커가 1개면 단일 위치
  if (markers.length === 1) {
    const m = markers[0];
    return `https://www.google.com/maps/search/?api=1&query=${m.position[0]},${m.position[1]}`;
  }

  // 여러 마커 → search로 중심점 열고 zoom
  const centerLat = markers.reduce((s, m) => s + m.position[0], 0) / markers.length;
  const centerLng = markers.reduce((s, m) => s + m.position[1], 0) / markers.length;
  return `https://www.google.com/maps/@${centerLat},${centerLng},13z`;
}

/* ────── KML 내보내기 (Google My Maps에서 임포트 가능) ────── */
/* Google My Maps는 Folder = 레이어로 인식. 카테고리별 Folder로 나눠야 마커 구분 가능 */
const COLOR_TO_CATEGORY: Record<string, string> = {
  "#3b82f6": "관광지",
  "#ef4444": "식당",
  "#f59e0b": "카페",
  "#ec4899": "쇼핑",
  "#10b981": "숙소",
  "#6b7280": "이동",
  "#0d9488": "기차역",
  "#d97706": "버스",
};

/* Google My Maps 아이콘: 카테고리별 모양 + 색상 */
const CATEGORY_KML: Record<string, { icon: string; color: string }> = {
  "관광지": { icon: "http://maps.google.com/mapfiles/kml/shapes/museums.png", color: "#3b82f6" },
  "식당": { icon: "http://maps.google.com/mapfiles/kml/shapes/dining.png", color: "#ef4444" },
  "카페": { icon: "http://maps.google.com/mapfiles/kml/shapes/snack_bar.png", color: "#f59e0b" },
  "쇼핑": { icon: "http://maps.google.com/mapfiles/kml/shapes/shopping.png", color: "#ec4899" },
  "숙소": { icon: "http://maps.google.com/mapfiles/kml/shapes/lodging.png", color: "#10b981" },
  "이동": { icon: "http://maps.google.com/mapfiles/kml/shapes/trail.png", color: "#6b7280" },
  "기차역": { icon: "http://maps.google.com/mapfiles/kml/shapes/rail.png", color: "#0d9488" },
  "버스": { icon: "http://maps.google.com/mapfiles/kml/shapes/bus.png", color: "#d97706" },
  "기타": { icon: "http://maps.google.com/mapfiles/kml/shapes/info-i.png", color: "#9ca3af" },
};

function exportKml(markers: MarkerData[], filename = "travel-map") {
  // Group markers by category (color → category name)
  const grouped: Record<string, MarkerData[]> = {};
  for (const m of markers) {
    const cat = COLOR_TO_CATEGORY[m.color || "#3b82f6"] || "기타";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(m);
  }

  // Build styles with shape icons + color
  const styles = Object.keys(grouped)
    .map((cat) => {
      const cfg = CATEGORY_KML[cat] || CATEGORY_KML["기타"];
      const kmlColor = hexToKmlColor(cfg.color);
      return `    <Style id="style-${escapeXml(cat)}">
      <IconStyle>
        <color>${kmlColor}</color>
        <scale>1.2</scale>
        <Icon><href>${cfg.icon}</href></Icon>
      </IconStyle>
    </Style>`;
    })
    .join("\n");

  // Each category becomes a Folder (= layer in Google My Maps)
  const folders = Object.entries(grouped)
    .map(
      ([cat, items]) => {
        const placemarks = items
          .map(
            (m) => `      <Placemark>
        <name>${escapeXml(m.label)}</name>
        <description>${escapeXml(m.popup?.replace(/<[^>]*>/g, "") || "")}</description>
        <styleUrl>#style-${escapeXml(cat)}</styleUrl>
        <Point><coordinates>${m.position[1]},${m.position[0]},0</coordinates></Point>
      </Placemark>`
          )
          .join("\n");
        return `    <Folder>
      <name>${escapeXml(cat)} (${items.length})</name>
${placemarks}
    </Folder>`;
      }
    )
    .join("\n");

  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(filename)}</name>
${styles}
${folders}
  </Document>
</kml>`;

  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.kml`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function hexToKmlColor(hex: string) {
  // KML: aaBBGGRR format
  const h = hex.replace("#", "");
  const r = h.substring(0, 2);
  const g = h.substring(2, 4);
  const b = h.substring(4, 6);
  return `ff${b}${g}${r}`;
}

/* ────── Main component ────── */
export default function GoogleMapView({
  center,
  zoom = 7,
  markers = [],
  polyline,
  height = "400px",
  showMyLocation = false,
  bounds,
  highlightedMarkerIndex,
}: GoogleMapViewProps) {
  const gmapsUrl = buildGoogleMapsUrl(markers, polyline);

  if (!API_KEY) {
    return (
      <div
        style={{ height }}
        className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center"
      >
        <div className="text-center text-slate-400 text-sm p-4">
          <p className="font-semibold mb-1">Google Maps API Key Required</p>
          <p>.env.local 에 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 를 추가하세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div style={{ height, position: "relative" }} className="rounded-xl overflow-hidden border border-slate-200">
        <APIProvider apiKey={API_KEY}>
          <Map
            defaultCenter={{ lat: center[0], lng: center[1] }}
            defaultZoom={zoom}
            mapId="eeur-travel-map"
            style={{ width: "100%", height: "100%" }}
            gestureHandling="greedy"
            disableDefaultUI={false}
            streetViewControl={false}
            mapTypeControl={false}
          >
            {bounds && bounds.length > 0 && <FitBoundsController bounds={bounds} />}
            {highlightedMarkerIndex != null && (
              <HighlightController
                markers={markers}
                highlightedMarkerIndex={highlightedMarkerIndex}
              />
            )}
            {markers.map((m, i) => (
              <MarkerWithInfo
                key={i}
                marker={m}
                highlighted={highlightedMarkerIndex === i}
              />
            ))}
            {polyline && polyline.length > 1 && <PolylineLayer path={polyline} />}
          </Map>
          {showMyLocation && <MyLocationButton />}
        </APIProvider>
      </div>

      {/* Action buttons */}
      {markers.length > 0 && (
        <div className="flex gap-2">
          {gmapsUrl && (
            <a
              href={gmapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
              </svg>
              Google Maps에서 열기
            </a>
          )}
          <button
            onClick={() => exportKml(markers, "eeur-travel")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-green-50 hover:text-green-600 hover:border-green-200 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor"/>
            </svg>
            KML 내보내기 (My Maps용)
          </button>
        </div>
      )}
    </div>
  );
}
