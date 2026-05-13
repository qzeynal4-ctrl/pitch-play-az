import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default marker icons
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const pitchIcon = L.divIcon({
  className: "",
  html: `<div style="background:oklch(0.38 0.12 155);color:white;width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3);"><span style="transform:rotate(45deg);font-size:18px;">⚽</span></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

type PitchLike = { id: string; name: string; latitude: number; longitude: number };

function FlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 14, { duration: 0.8 });
  }, [center, map]);
  return null;
}

export function PitchMap<T extends PitchLike>({
  pitches,
  onSelect,
  selectedId,
}: {
  pitches: T[];
  onSelect: (p: T) => void;
  selectedId?: string | null;
}) {
  const selected = pitches.find((p) => p.id === selectedId);
  const center: [number, number] = selected
    ? [selected.latitude, selected.longitude]
    : [40.4093, 49.8671];

  return (
    <MapContainer
      center={center}
      zoom={12}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pitches.map((p) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={pitchIcon}
          eventHandlers={{ click: () => onSelect(p) }}
        />
      ))}
      <FlyTo center={selected ? [selected.latitude, selected.longitude] : null} />
    </MapContainer>
  );
}
