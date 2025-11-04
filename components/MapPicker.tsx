import React from 'react';
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api';
import { MapContainer, TileLayer, Circle as LeafletCircle, Marker as LeafletMarker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// إصلاح أيقونة Marker الافتراضية مع Vite/webpack حتى تظهر وتعمل
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type MapPickerProps = {
  latitude: number;
  longitude: number;
  radius: number; // meters
  onChange: (lat: number, lng: number) => void;
};

const containerStyle: React.CSSProperties = { width: '100%', height: '100%' };

const LeafletClickHandler: React.FC<{ onChange: (lat: number, lng: number) => void }> = ({ onChange }) => {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// إعادة تمركز خريطة Leaflet عند تغيّر الإحداثيات القادمة من الأعلى
const RecenterLeaflet: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng]);
  return null;
};

export const MapPicker: React.FC<MapPickerProps> = ({ latitude, longitude, radius, onChange }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const center = { lat: latitude || 24.7136, lng: longitude || 46.6753 };
  const zoom = Math.max(10, Math.min(18, Math.round(12 + (radius / 2000) * 4)));

  // بديل بدون مفاتيح: استخدم Leaflet + OpenStreetMap
  if (!apiKey) {
    return (
      <div className="relative h-48 rounded-md overflow-hidden ring-1 ring-gray-200/60 dark:ring-gray-700/60">
        <MapContainer center={[center.lat, center.lng]} zoom={zoom} style={containerStyle} className="w-full h-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          <RecenterLeaflet lat={center.lat} lng={center.lng} />
          <LeafletMarker
            position={[center.lat, center.lng]}
            draggable
            eventHandlers={{
              dragend: (e: any) => {
                const latlng = e.target.getLatLng();
                onChange(latlng.lat, latlng.lng);
              },
            }}
          />
          <LeafletCircle
            center={[center.lat, center.lng]}
            radius={radius || 500}
            pathOptions={{ color: '#1e40af', fillColor: '#1e40af', fillOpacity: Math.min(0.4, 0.2 + (radius || 500) / 2000) }}
          />
          <LeafletClickHandler onChange={onChange} />
        </MapContainer>
      </div>
    );
  }

  // تكامل خرائط قوقل عند توفر المفتاح
  const { isLoaded, loadError } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: apiKey });
  if (loadError) {
    return <div className="p-3 text-sm text-red-600">فشل تحميل خرائط قوقل: {String(loadError)}</div>;
  }

  return (
    <div className="relative h-48 rounded-md overflow-hidden ring-1 ring-gray-200/60 dark:ring-gray-700/60">
      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={zoom}
          onClick={(e) => {
            const lat = e.latLng?.lat();
            const lng = e.latLng?.lng();
            if (typeof lat === 'number' && typeof lng === 'number') onChange(lat, lng);
          }}
          options={{ disableDefaultUI: true, gestureHandling: 'greedy' }}
        >
          <Marker
            position={center}
            draggable
            onDragEnd={(e) => {
              const lat = e.latLng?.lat();
              const lng = e.latLng?.lng();
              if (typeof lat === 'number' && typeof lng === 'number') onChange(lat, lng);
            }}
          />
          <Circle
            center={center}
            radius={radius || 500}
            options={{ fillColor: '#1e40af', fillOpacity: Math.min(0.4, 0.2 + (radius || 500) / 2000), strokeColor: '#1e40af', strokeOpacity: 0.4 }}
          />
        </GoogleMap>
      ) : (
        <div className="flex items-center justify-center h-full text-sm text-gray-600">تحميل الخرائط…</div>
      )}
    </div>
  );
};

export default MapPicker;