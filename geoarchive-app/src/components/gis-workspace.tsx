"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { distance as turfDistance } from "@turf/distance";
import { point as turfPoint } from "@turf/helpers";
import { ArrowLeft, Check, Compass, Copy, Expand, MapPin, Ruler, Sparkles, X } from "lucide-react";
import CoordinateInput from "@/components/coordinate-input";
import ThemeToggle from "@/components/theme-toggle";
import { calculateBoundary, type PlottedCoordinate } from "@/lib/coordinate-input";
import type { PhotoRecord } from "@/types/photo";

const MapCanvas = dynamic(() => import("@/components/map-canvas"), { ssr: false });
const noPhotos: PhotoRecord[] = [];
type Coordinates = { latitude: number; longitude: number };
type MeasurementMode = "distance" | "area" | null;

function formatLength(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters.toFixed(1)} m`;
}

export default function GisWorkspace() {
  const [boundary, setBoundary] = useState<PlottedCoordinate[]>([]);
  const [center, setCenter] = useState<Coordinates | null>(null);
  const [pin, setPin] = useState<Coordinates | null>(null);
  const [measurementMode, setMeasurementMode] = useState<MeasurementMode>(null);
  const [measurementPoints, setMeasurementPoints] = useState<Coordinates[]>([]);
  const [coordinatesCopied, setCoordinatesCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const measurements = useMemo(
    () => calculateBoundary(measurementPoints, false),
    [measurementPoints],
  );
  const measurementLength = measurementPoints.slice(1).reduce((total, point, index) => {
    const previous = measurementPoints[index];
    return total + turfDistance(
      turfPoint([previous.longitude, previous.latitude]),
      turfPoint([point.longitude, point.latitude]),
      { units: "meters" },
    );
  }, 0);

  function plot(points: PlottedCoordinate[]) {
    setBoundary(points);
    if (points.length) {
      setCenter({ latitude: points[0].latitude, longitude: points[0].longitude });
      setPin(null);
    }
  }

  function addMapPoint(point: Coordinates) {
    setPin(point);
    setCoordinatesCopied(false);
    setCopyError("");
    if (measurementMode) {
      setMeasurementPoints((current) => [...current, point]);
    }
  }

  async function copyCoordinates() {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(`${pin.latitude.toFixed(6)}, ${pin.longitude.toFixed(6)}`);
      setCoordinatesCopied(true);
      setCopyError("");
    } catch (error) {
      setCoordinatesCopied(false);
      setCopyError(`Could not copy coordinates: ${error instanceof Error ? error.message : "Clipboard unavailable."}`);
    }
  }

  function selectMeasurementMode(mode: Exclude<MeasurementMode, null>) {
    setMeasurementMode((current) => current === mode ? null : mode);
    setMeasurementPoints([]);
  }

  return (
    <main className="gis-page app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="GeoArchive home">
          <span className="brand-mark"><MapPin size={18} strokeWidth={2.7} /></span>
          <span className="brand-word">geoarchive<span>.</span></span>
          <span className="brand-beta">FIELD NOTES</span>
        </Link>
        <div className="topbar-actions">
          <ThemeToggle />
          <Link className="pill-button" href="/explore"><ArrowLeft size={14} /> Back to map</Link>
        </div>
      </header>
      <section className="gis-page-content">
        <div className="gis-page-heading">
          <p className="eyebrow"><Compass size={13} /> GIS WORKSPACE</p>
          <h1>Coordinate <span>tools.</span></h1>
          <p>Convert, inspect and plot geographic or projected coordinates without crowding your field journal.</p>
        </div>
        <div className="gis-workspace-map">
          <MapCanvas
            photos={noPhotos}
            activePhoto={null}
            viewCenter={center}
            viewZoom={boundary.length > 0 ? 14 : 12}
            droppedPin={pin}
            boundaryPoints={boundary}
            fitToBoundary={boundary.length > 0}
            measurementPoints={measurementPoints}
            measurementMode={measurementMode}
            onSelectPhoto={() => {}}
            onMapPick={addMapPoint}
          />
          <div className="map-top-left"><div className="map-count-pill"><Compass size={13} /> Coordinate plotting</div></div>
        </div>
        <section className="gis-interaction-panel" aria-label="Map point and measurement tools">
          <div className="gis-selected-coordinate">
            <div className="gis-coordinate-copy">
              <p className="eyebrow"><MapPin size={12} /> SELECTED MAP POINT</p>
              {pin ? (
                <p className="gis-coordinate-value">
                  {pin.latitude.toFixed(6)}°,&nbsp; {pin.longitude.toFixed(6)}° <span>WGS84</span>
                </p>
              ) : (
                <p className="gis-coordinate-placeholder">Click the map to inspect and select a coordinate.</p>
              )}
              {copyError && <p className="gis-coordinate-error" role="alert">{copyError}</p>}
            </div>
            <button className="gis-tool-action" type="button" onClick={() => void copyCoordinates()} disabled={!pin}>
              {coordinatesCopied ? <Check size={13} /> : <Copy size={13} />}
              {coordinatesCopied ? "Copied" : "Copy coordinates"}
            </button>
          </div>
          <div className="gis-measure-tools">
            <div className="gis-tool-actions">
              <button
                className={`gis-tool-action${measurementMode === "distance" ? " gis-tool-action-active" : ""}`}
                type="button"
                aria-pressed={measurementMode === "distance"}
                onClick={() => selectMeasurementMode("distance")}
              ><Ruler size={13} /> Measure length</button>
              <button
                className={`gis-tool-action${measurementMode === "area" ? " gis-tool-action-active" : ""}`}
                type="button"
                aria-pressed={measurementMode === "area"}
                onClick={() => selectMeasurementMode("area")}
              ><Expand size={13} /> Measure area</button>
              {measurementPoints.length > 0 && (
                <button className="gis-tool-action" type="button" onClick={() => setMeasurementPoints([])}>
                  <X size={13} /> Clear points
                </button>
              )}
            </div>
            <div className="gis-measurement-result" aria-live="polite">
              {!measurementMode ? (
                <span>Choose a tool, then click the map to add measurement points.</span>
              ) : measurementMode === "distance" ? (
                <><strong>Length</strong> {measurementPoints.length < 2 ? "Add at least 2 points" : formatLength(measurementLength)} <span>{measurementPoints.length} {measurementPoints.length === 1 ? "point" : "points"}</span></>
              ) : (
                <><strong>Area</strong> {measurementPoints.length < 3
                  ? "Add at least 3 points"
                  : measurements.areaSquareMeters >= 1_000_000
                    ? `${(measurements.areaSquareMeters / 1_000_000).toFixed(2)} km²`
                    : `${(measurements.areaSquareMeters / 10_000).toFixed(2)} ha`}
                  <span>{measurementPoints.length} {measurementPoints.length === 1 ? "point" : "points"}</span></>
              )}
            </div>
          </div>
        </section>
        <CoordinateInput onPlot={plot} />
      </section>
      <footer className="page-footer"><span>GIS COORDINATE WORKSPACE <span className="footer-star"><Sparkles size={12} /></span></span><Link href="/">BACK TO YOUR JOURNAL</Link><span>GEOARCHIVE&nbsp; © 2026</span></footer>
    </main>
  );
}
