"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Compass, MapPin } from "lucide-react";
import CoordinateInput from "@/components/coordinate-input";
import ThemeToggle from "@/components/theme-toggle";
import type { PlottedCoordinate } from "@/lib/coordinate-input";
import type { PhotoRecord } from "@/types/photo";

const MapCanvas = dynamic(() => import("@/components/map-canvas"), { ssr: false });
const noPhotos: PhotoRecord[] = [];

export default function GisWorkspace() {
  const [boundary, setBoundary] = useState<PlottedCoordinate[]>([]);
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(null);

  function plot(points: PlottedCoordinate[]) {
    setBoundary(points);
    if (points.length) {
      setCenter({ latitude: points[0].latitude, longitude: points[0].longitude });
      setPin(null);
    }
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
            measurementPoints={[]}
            measurementMode={null}
            onSelectPhoto={() => {}}
            onMapPick={(point) => {
              setPin(point);
              setCenter(point);
            }}
          />
          <div className="map-top-left"><div className="map-count-pill"><Compass size={13} /> Coordinate plotting</div></div>
        </div>
        <CoordinateInput onPlot={plot} />
      </section>
      <footer className="page-footer"><span>GIS COORDINATE WORKSPACE <span className="footer-star">✳</span></span><Link href="/">BACK TO YOUR JOURNAL</Link><span>GEOARCHIVE&nbsp; © 2026</span></footer>
    </main>
  );
}
