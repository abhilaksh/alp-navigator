'use client';

import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import type { SearchResult } from './search-panel';

interface HotelResultsMapProps {
  results: SearchResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const containerStyle = { width: '100%', height: '100%' };

export function HotelResultsMap({ results, selectedId, onSelect }: HotelResultsMapProps) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const points = results.filter((r): r is SearchResult & { lat: number; lng: number } => r.lat != null && r.lng != null);

  if (!isLoaded) {
    return <div className="flex items-center justify-center h-full text-ink-mute text-xs font-sans">Loading map…</div>;
  }
  if (points.length === 0) {
    return <div className="flex items-center justify-center h-full text-ink-mute text-xs font-sans px-4 text-center">No mappable results for this search.</div>;
  }

  const center = { lat: points[0].lat, lng: points[0].lng };

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={13}
      options={{ disableDefaultUI: true, zoomControl: true, clickableIcons: false }}
    >
      {points.map(p => (
        <MarkerF
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          title={p.name}
          onClick={() => onSelect(p.id)}
          icon={selectedId === p.id ? {
            url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
          } : undefined}
        />
      ))}
    </GoogleMap>
  );
}
