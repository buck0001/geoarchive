"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotoRecord } from "@/types/photo";

type Coordinates = { latitude: number; longitude: number };

type MapCanvasProps = {
  photos: PhotoRecord[];
  activePhoto: string | null;
  fitToMarkers?: boolean;
  viewCenter?: Coordinates | null;
  userLocation?: Coordinates | null;
  measurementPoints: Coordinates[];
  measurementMode: "distance" | "area" | null;
  onSelectPhoto: (photo: PhotoRecord) => void;
  onMapPick?: (coordinates: Coordinates) => void;
  onCoordinatesChange?: (coordinates: Coordinates) => void;
};

export default function MapCanvas({
  photos,
  activePhoto,
  fitToMarkers = false,
  viewCenter = null,
  userLocation = null,
  measurementPoints,
  measurementMode,
  onSelectPhoto,
  onMapPick,
  onCoordinatesChange,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").LayerGroup | null>(null);
  const userLocationLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const measurementLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const hasFittedMarkersRef = useRef(false);
  const callbacksRef = useRef({ onSelectPhoto, onMapPick, onCoordinatesChange });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onSelectPhoto, onMapPick, onCoordinatesChange };
  }, [onSelectPhoto, onMapPick, onCoordinatesChange]);

  useEffect(() => {
    let disposed = false;

    async function initializeMap() {
      if (!containerRef.current || mapRef.current) return;

      const leaflet = await import("leaflet");
      if (disposed || !containerRef.current) return;

      const map = leaflet.map(containerRef.current, {
        center: [0, 20],
        zoom: 3,
        zoomControl: false,
        attributionControl: true,
      });

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        })
        .addTo(map);

      leaflet.control.zoom({ position: "bottomright" }).addTo(map);
      const markerLayer = leaflet.layerGroup().addTo(map);
      const userLocationLayer = leaflet.layerGroup().addTo(map);
      const measurementLayer = leaflet.layerGroup().addTo(map);
      map.on("click", (event) => {
        const coordinates = {
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        };
        callbacksRef.current.onMapPick?.(coordinates);
        callbacksRef.current.onCoordinatesChange?.(coordinates);
      });

      mapRef.current = map;
      markersRef.current = markerLayer;
      userLocationLayerRef.current = userLocationLayer;
      measurementLayerRef.current = measurementLayer;
      setReady(true);
    }

    void initializeMap();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
      userLocationLayerRef.current = null;
      measurementLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !viewCenter) return;
    mapRef.current.setView([viewCenter.latitude, viewCenter.longitude], 12);
  }, [ready, viewCenter]);

  useEffect(() => {
    if (!ready || !userLocationLayerRef.current) return;

    async function refreshUserLocation() {
      const leaflet = await import("leaflet");
      const layer = userLocationLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      if (!userLocation) return;
      leaflet.circleMarker([userLocation.latitude, userLocation.longitude], {
        radius: 8,
        color: "#fffefa",
        weight: 3,
        fillColor: "#2378f5",
        fillOpacity: 1,
      }).addTo(layer);
    }

    void refreshUserLocation();
  }, [ready, userLocation]);

  useEffect(() => {
    if (!ready || !markersRef.current) return;

    async function refreshMarkers() {
      const leaflet = await import("leaflet");
      const layer = markersRef.current;
      if (!layer) return;
      layer.clearLayers();
      const markerCoordinates: [number, number][] = [];

      photos.forEach((photo) => {
        if (photo.latitude === null || photo.longitude === null) return;
        markerCoordinates.push([photo.latitude, photo.longitude]);
        const icon = leaflet.divIcon({
          className: "photo-marker-wrap",
          html: `<span class="photo-marker${photo.id === activePhoto ? " photo-marker-active" : ""}"><span></span></span>`,
          iconSize: [34, 42],
          iconAnchor: [17, 38],
        });
        leaflet
          .marker([photo.latitude, photo.longitude], { icon })
          .addTo(layer)
          .on("click", () => callbacksRef.current.onSelectPhoto(photo));
      });
      const map = mapRef.current;
      if (fitToMarkers && !hasFittedMarkersRef.current && map && markerCoordinates.length) {
        hasFittedMarkersRef.current = true;
        const bounds = leaflet.latLngBounds(markerCoordinates);
        if (markerCoordinates.length === 1) {
          map.setView(markerCoordinates[0], 12);
        } else {
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
        }
      }
    }

    void refreshMarkers();
  }, [photos, activePhoto, fitToMarkers, ready]);

  useEffect(() => {
    if (!ready || !measurementLayerRef.current) return;

    async function refreshMeasurement() {
      const leaflet = await import("leaflet");
      const layer = measurementLayerRef.current;
      if (!layer) return;

      layer.clearLayers();
      const points = measurementPoints.map(
        ({ latitude, longitude }) => [latitude, longitude] as [number, number],
      );
      if (points.length > 1 && measurementMode === "distance") {
        leaflet.polyline(points, {
          color: "#5c4ade",
          weight: 3,
          dashArray: "7 6",
        }).addTo(layer);
      }
      if (points.length > 2 && measurementMode === "area") {
        leaflet.polygon(points, {
          color: "#101010",
          weight: 2,
          fillColor: "#e9ccff",
          fillOpacity: 0.45,
        }).addTo(layer);
      }
      points.forEach((point) => {
        leaflet.circleMarker(point, {
          radius: 5,
          color: "#101010",
          weight: 1,
          fillColor: "#ffd731",
          fillOpacity: 1,
        }).addTo(layer);
      });
    }

    void refreshMeasurement();
  }, [measurementPoints, measurementMode, ready]);

  return <div ref={containerRef} className="map-canvas" aria-label="Interactive map of photo locations" />;
}
