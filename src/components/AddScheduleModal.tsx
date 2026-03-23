"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMapsLibrary,
  useMap,
} from "@vis.gl/react-google-maps";
import type { ItineraryItem } from "@/lib/types";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const CATEGORIES = ["관광지", "식당", "카페", "쇼핑", "숙소", "이동"];
const CAT_EMOJI: Record<string, string> = {
  "관광지": "🏛️", "식당": "🍽️", "카페": "☕", "쇼핑": "🛍️", "숙소": "🏨", "이동": "🚌",
};

interface AddScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Partial<ItineraryItem>) => Promise<void>;
  tripId: number;
  dayNumber: number;
  cityId: number | null;
  defaultCenter?: [number, number];
}

/* ── Places Autocomplete input ── */
function PlacesAutocomplete({
  onSelect,
}: {
  onSelect: (place: { name: string; lat: number; lng: number }) => void;
}) {
  const places = useMapsLibrary("places");
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!places || !inputRef.current) return;
    autocompleteRef.current = new places.Autocomplete(inputRef.current, {
      fields: ["geometry", "name", "formatted_address"],
    });
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.geometry?.location) {
        onSelect({
          name: place.name || place.formatted_address || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    });
  }, [places, onSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder="장소 검색 (Google Places)"
      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
}

/* ── Click handler for map ── */
function MapClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener(
      "click",
      (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          onClick(e.latLng.lat(), e.latLng.lng());
        }
      }
    );
    return () => listener.remove();
  }, [map, onClick]);

  return null;
}

export default function AddScheduleModal({
  open,
  onClose,
  onSave,
  tripId,
  dayNumber,
  cityId,
  defaultCenter = [48.2, 16.37],
}: AddScheduleModalProps) {
  const [spotName, setSpotName] = useState("");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState("관광지");
  const [memo, setMemo] = useState("");
  const [costKrw, setCostKrw] = useState(0);
  const [costEur, setCostEur] = useState(0);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSpotName("");
      setTime("");
      setCategory("관광지");
      setMemo("");
      setCostKrw(0);
      setCostEur(0);
      setLat(null);
      setLng(null);
    }
  }, [open]);

  const handlePlaceSelect = useCallback(
    (place: { name: string; lat: number; lng: number }) => {
      setSpotName(place.name);
      setLat(place.lat);
      setLng(place.lng);
    },
    []
  );

  const handleMapClick = useCallback((latitude: number, longitude: number) => {
    setLat(latitude);
    setLng(longitude);
  }, []);

  const handleSubmit = async () => {
    if (!spotName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        trip_id: tripId,
        city_id: cityId,
        day_number: dayNumber,
        spot_name: spotName.trim(),
        time: time || null,
        category,
        memo: memo || null,
        cost_krw: costKrw,
        cost_eur: costEur,
        latitude: lat,
        longitude: lng,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-bold text-slate-800">
            일정 추가 (Day {dayNumber})
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Places search */}
          {API_KEY && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                장소 검색
              </label>
              <APIProvider apiKey={API_KEY}>
                <PlacesAutocomplete onSelect={handlePlaceSelect} />

                {/* Mini map for click-to-set-coordinate */}
                <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                  <div style={{ height: 200 }}>
                    <Map
                      defaultCenter={{
                        lat: lat ?? defaultCenter[0],
                        lng: lng ?? defaultCenter[1],
                      }}
                      center={
                        lat !== null && lng !== null
                          ? { lat, lng }
                          : undefined
                      }
                      defaultZoom={12}
                      mapId="schedule-add-map"
                      style={{ width: "100%", height: "100%" }}
                      gestureHandling="greedy"
                      disableDefaultUI
                    >
                      <MapClickHandler onClick={handleMapClick} />
                      {lat !== null && lng !== null && (
                        <AdvancedMarker position={{ lat, lng }}>
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "#3b82f6",
                              border: "2px solid white",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                            }}
                          />
                        </AdvancedMarker>
                      )}
                    </Map>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  지도를 클릭하여 좌표를 직접 지정할 수도 있습니다
                </p>
              </APIProvider>
            </div>
          )}

          {/* Spot name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              장소명 *
            </label>
            <input
              type="text"
              value={spotName}
              onChange={(e) => setSpotName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="장소 이름"
            />
          </div>

          {/* Time + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                시간
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                카테고리
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CAT_EMOJI[c]} {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Costs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                비용 (KRW)
              </label>
              <input
                type="number"
                value={costKrw || ""}
                onChange={(e) => setCostKrw(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                비용 (EUR)
              </label>
              <input
                type="number"
                value={costEur || ""}
                onChange={(e) => setCostEur(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
          </div>

          {/* Coordinates display */}
          {lat !== null && lng !== null && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
              <span>📍</span>
              <span>
                {lat.toFixed(5)}, {lng.toFixed(5)}
              </span>
              <button
                onClick={() => {
                  setLat(null);
                  setLng(null);
                }}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                제거
              </button>
            </div>
          )}

          {/* Memo */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              placeholder="메모 (선택)"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!spotName.trim() || saving}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? "저장 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
}
