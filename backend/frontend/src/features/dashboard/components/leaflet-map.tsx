import { useEffect, useRef, useState } from 'react';

interface MapLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  battery?: number;
  timestamp?: string;
}

interface LeafletMapProps {
  locations: MapLocation[];
}

export function LeafletMap({ locations }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // 1. Dynamically load Leaflet library from CDN (zero React 19 dependency conflicts)
  useEffect(() => {
    let active = true;

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-cdn-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-cdn-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet Script
    const loadScript = () => {
      if ((window as any).L) {
        if (active) setLeafletLoaded(true);
        return;
      }

      if (!document.getElementById('leaflet-cdn-js')) {
        const script = document.createElement('script');
        script.id = 'leaflet-cdn-js';
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => {
          if (active) setLeafletLoaded(true);
        };
        document.body.appendChild(script);
      }
    };

    loadScript();

    return () => {
      active = false;
    };
  }, []);

  // 2. Initialize the Map Instance once Leaflet JS is loaded
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapInstanceRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Center of US default
    mapInstanceRef.current = L.map(mapContainerRef.current, {
      zoomControl: true,
      maxZoom: 18,
    }).setView([37.0902, -95.7129], 4);

    // Standard OpenStreetMap Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstanceRef.current);

    // Set Default Icon configurations explicitly (bypasses Vite absolute path loading bugs)
    const DefaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = DefaultIcon;

  }, [leafletLoaded]);

  // 3. Update Markers dynamically when the locations list changes
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;

    // Remove obsolete markers
    const incomingIds = new Set(locations.map(loc => loc.id));
    markersRef.current.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add or Update markers
    locations.forEach(loc => {
      const popupText = `
        <div style="font-family: sans-serif; font-size: 13px;">
          <h4 style="margin: 0 0 6px 0; font-weight: bold; color: #10B981;">${loc.name}</h4>
          <div style="margin-bottom: 4px;"><b>Device:</b> <span style="font-family: monospace;">${loc.id}</span></div>
          <div style="margin-bottom: 4px;"><b>Battery:</b> ${loc.battery !== undefined ? `${loc.battery}%` : 'Unknown'}</div>
          ${loc.timestamp ? `<div style="font-size: 11px; color: #64748B; margin-top: 4px;"><b>Last updated:</b> ${new Date(loc.timestamp).toLocaleTimeString()}</div>` : ''}
          <div style="margin-top: 8px;">
            <a href="https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}" target="_blank" style="display: inline-block; background-color: #10B981; color: white; padding: 4px 8px; border-radius: 4px; text-decoration: none; font-size: 11px; font-weight: bold;">Google Maps</a>
          </div>
        </div>
      `;

      if (markersRef.current.has(loc.id)) {
        // Update Position & Popup Content
        const marker = markersRef.current.get(loc.id);
        marker.setLatLng([loc.lat, loc.lng]);
        marker.setPopupContent(popupText);
      } else {
        // Create new Marker
        const marker = L.marker([loc.lat, loc.lng])
          .addTo(mapInstanceRef.current)
          .bindPopup(popupText);
        markersRef.current.set(loc.id, marker);
      }
    });

    // Zoom/pan to fit active devices if they exist
    if (locations.length > 0) {
      const markersArray = Array.from(markersRef.current.values());
      const group = L.featureGroup(markersArray);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.15));
    }
  }, [locations, leafletLoaded]);

  return (
    <div className="relative w-full h-full min-h-[350px] md:min-h-[450px] rounded-lg overflow-hidden border bg-slate-900 border-slate-800 flex items-center justify-center">
      {!leafletLoaded && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900/80 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span className="text-slate-400 text-sm font-medium">Loading map assets...</span>
        </div>
      )}
      {leafletLoaded && locations.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/70 p-4 text-center pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-2">
            📍
          </div>
          <h3 className="text-white font-semibold text-sm">No Location Data</h3>
          <p className="text-slate-500 text-xs max-w-xs leading-relaxed">
            Connected devices are currently not broadcasting coordinates. Map markers will appear once devices synchronize active clock-in GPS logs.
          </p>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  );
}
