"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotoRecord } from "@/types/photo";
import type { ExternalLocation } from "@/types/location-search";

type Coordinates = { latitude: number; longitude: number };

type MapCanvasProps = {
  photos: PhotoRecord[];
  activePhoto: string | null;
  fitToMarkers?: boolean;
  fitToBoundary?: boolean;
  viewCenter?: Coordinates | null;
  viewZoom?: number;
  searchLocation?: ExternalLocation | null;
  userLocation?: Coordinates | null;
  droppedPin?: Coordinates | null;
  boundaryPoints?: Array<Coordinates & { label?: string }>;
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
  fitToBoundary = false,
  viewCenter = null,
  viewZoom = 12,
  searchLocation = null,
  userLocation = null,
  droppedPin = null,
  boundaryPoints = [],
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
  const droppedPinLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const searchLocationLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
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
        .tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
          attribution: "Tiles &copy; Esri — Sources: Esri, HERE, Garmin, FAO, NOAA, USGS, EPA, NPS",
          maxZoom: 19,
        })
        .addTo(map);

      leaflet.control.zoom({ position: "bottomright" }).addTo(map);
      const markerLayer = leaflet.layerGroup().addTo(map);
      const userLocationLayer = leaflet.layerGroup().addTo(map);
      const droppedPinLayer = leaflet.layerGroup().addTo(map);
      const searchLocationLayer = leaflet.layerGroup().addTo(map);
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
      droppedPinLayerRef.current = droppedPinLayer;
      searchLocationLayerRef.current = searchLocationLayer;
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
      droppedPinLayerRef.current = null;
      searchLocationLayerRef.current = null;
      measurementLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !droppedPinLayerRef.current) return;

    async function refreshDroppedPin() {
      const leaflet = await import("leaflet");
      const layer = droppedPinLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      if (!droppedPin) return;
      leaflet.circleMarker([droppedPin.latitude, droppedPin.longitude], {
        radius: 7,
        color: "#101010",
        weight: 2,
        fillColor: "#ffd731",
        fillOpacity: 1,
      }).addTo(layer);
    }

    void refreshDroppedPin();
  }, [ready, droppedPin]);

  useEffect(() => {
    if (!ready || !mapRef.current || !viewCenter) return;
    mapRef.current.setView([viewCenter.latitude, viewCenter.longitude], viewZoom);
  }, [ready, viewCenter, viewZoom]);

  useEffect(() => {
    if (!ready || !searchLocationLayerRef.current) return;

    async function refreshSearchLocation() {
      const leaflet = await import("leaflet");
      const layer = searchLocationLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      if (!searchLocation) return;
      const marker = leaflet.circleMarker([searchLocation.latitude, searchLocation.longitude], {
        radius: 9,
        color: "#ffffff",
        weight: 3,
        fillColor: "#7256d8",
        fillOpacity: 1,
      }).addTo(layer);
      const tooltip = document.createElement("span");
      tooltip.textContent = `Temporary search: ${searchLocation.name}`;
      marker.bindTooltip(tooltip).openTooltip();
    }

    void refreshSearchLocation();
  }, [ready, searchLocation]);

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
      const boundary = boundaryPoints.map(
        ({ latitude, longitude }) => [latitude, longitude] as [number, number],
      );
      if (boundary.length > 1) {
        const shape = boundary.length > 2
          ? leaflet.polygon(boundary, {
              color: "#101010",
              weight: 2,
              fillColor: "#e9ccff",
              fillOpacity: 0.35,
            })
          : leaflet.polyline(boundary, { color: "#5c4ade", weight: 3, dashArray: "7 6" });
        shape.addTo(layer);
        boundaryPoints.forEach((item, index) => {
          leaflet.circleMarker(boundary[index], {
            radius: 5,
            color: "#101010",
            weight: 1,
            fillColor: "#ffd731",
            fillOpacity: 1,
          }).addTo(layer).bindTooltip(item.label ?? `P${index + 1}`);
        });
      } else if (boundary.length === 1) {
        leaflet.circleMarker(boundary[0], {
          radius: 7,
          color: "#101010",
          weight: 2,
          fillColor: "#ffd731",
          fillOpacity: 1,
        }).addTo(layer).bindTooltip(boundaryPoints[0].label ?? "P1");
      }
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
  }, [boundaryPoints, measurementPoints, measurementMode, ready]);

  useEffect(() => {
    if (!ready || !fitToBoundary || !boundaryPoints.length || !mapRef.current) return;
    void import("leaflet").then((leaflet) => {
      const map = mapRef.current;
      if (!map) return;
      const bounds = leaflet.latLngBounds(
        boundaryPoints.map(({ latitude, longitude }) => [latitude, longitude] as [number, number]),
      );
      if (boundaryPoints.length === 1) {
        map.setView([boundaryPoints[0].latitude, boundaryPoints[0].longitude], 15);
      } else {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
      }
    });
  }, [boundaryPoints, fitToBoundary, ready]);

  return <div ref={containerRef} className="map-canvas" aria-label="Interactive map of photo locations" />;
}
