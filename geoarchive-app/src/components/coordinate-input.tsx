"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Check, MapPinned } from "lucide-react";
import {
  calculateBoundary,
  convertCoordinates,
  coordinateSystems,
  inferCoordinateFormat,
  parseCoordinateText,
  type CoordinateFormat,
  type CoordinateSystem,
  type PlottedCoordinate,
} from "@/lib/coordinate-input";

type CoordinateInputProps = {
  onPlot: (points: PlottedCoordinate[], crs: CoordinateSystem | "") => void;
};

const exampleText = "P1  532421.35  789543.72\nP2  532510.20  789580.14\nP3  532600.41  789510.27\nP4  532480.17  789450.88";

function formatLength(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(3)} km` : `${meters.toFixed(2)} m`;
}

export default function CoordinateInput({ onPlot }: CoordinateInputProps) {
  const [input, setInput] = useState("");
  const [format, setFormat] = useState<CoordinateFormat>("automatic");
  const [order, setOrder] = useState<"latitude-longitude" | "longitude-latitude">("latitude-longitude");
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [crs, setCrs] = useState<CoordinateSystem | "">("");
  const [plotted, setPlotted] = useState<PlottedCoordinate[]>([]);
  const [plotCrs, setPlotCrs] = useState<CoordinateSystem | "">("");
  const [message, setMessage] = useState("");

  const parsed = useMemo(() => parseCoordinateText(input), [input]);
  const detection = useMemo(() => inferCoordinateFormat(parsed.points), [parsed.points]);
  const effectiveFormat = format === "automatic" ? detection.format : format;
  const displayOrder = effectiveFormat === "longitude-latitude"
    ? "longitude-latitude"
    : effectiveFormat === "latitude-longitude"
      ? "latitude-longitude"
      : order;
  const effectiveCrs = crs || (
    effectiveFormat === "latitude-longitude" || effectiveFormat === "longitude-latitude"
      ? "EPSG:4326"
      : ""
  );
  const converted = useMemo(
    () => parsed.error
      ? { points: [], error: "" }
      : convertCoordinates(parsed.points, format, order, effectiveCrs),
    [parsed, format, order, effectiveCrs],
  );
  const needsOrderConfirmation = detection.ambiguousOrder && format === "automatic";
  const canPlot = parsed.points.length > 0 && !parsed.error && !converted.error &&
    (!needsOrderConfirmation || orderConfirmed);
  const isProjected = effectiveCrs !== "" && effectiveCrs !== "EPSG:4326";
  const measurements = useMemo(
    () => calculateBoundary(plotted, plotCrs !== "" && plotCrs !== "EPSG:4326"),
    [plotted, plotCrs],
  );

  function clearPlottedBoundary() {
    setPlotted([]);
    setPlotCrs("");
    onPlot([], "");
  }

  function handleInputChange(value: string) {
    if (plotted.length) clearPlottedBoundary();
    setInput(value);
    setMessage("");
    setOrderConfirmed(false);
    if (!value.trim()) {
      setCrs("");
      return;
    }
    const next = parseCoordinateText(value);
    if (next.error) return;
    const inferred = inferCoordinateFormat(next.points);
    if (inferred.format === "latitude-longitude" || inferred.format === "longitude-latitude") {
      setCrs("EPSG:4326");
    } else {
      setCrs("");
    }
  }

  function handleFormatChange(value: CoordinateFormat) {
    if (plotted.length) clearPlottedBoundary();
    setFormat(value);
    setMessage("");
    if (value === "latitude-longitude" || value === "longitude-latitude") {
      setCrs("EPSG:4326");
      setOrder(value);
      setOrderConfirmed(true);
    } else {
      setCrs("");
      setOrderConfirmed(false);
    }
  }

  function plotCoordinates() {
    if (!canPlot) return;
    setPlotted(converted.points);
    setPlotCrs(effectiveCrs);
    onPlot(converted.points, effectiveCrs);
    setMessage(`${converted.points.length} ${converted.points.length === 1 ? "point" : "points"} plotted on the map.`);
  }

  return (
    <section className="coordinate-tool" aria-labelledby="coordinate-tool-heading">
      <div className="coordinate-tool-heading">
        <div>
          <p className="eyebrow"><MapPinned size={12} /> GIS COORDINATE TOOL</p>
          <h3 id="coordinate-tool-heading">Paste coordinates.</h3>
          <p>Recognizes latitude/longitude, Easting/Northing, and X/Y. Bulk rows can be used to draw a boundary.</p>
        </div>
        <button className="coordinate-example-button" type="button" onClick={() => {
          setFormat("automatic");
          setCrs("");
          handleInputChange(exampleText);
        }}>Load example</button>
      </div>

      <label className="field-label" htmlFor="coordinate-values">COORDINATE VALUES</label>
      <textarea
        id="coordinate-values"
        className="text-input coordinate-input"
        value={input}
        onChange={(event) => handleInputChange(event.target.value)}
        placeholder={"Paste one point per line, e.g.\nLatitude: 7.1478\nLongitude: 3.3619\n\nOr bulk points: P1 532421.35 789543.72"}
        spellCheck={false}
      />

      <div className="coordinate-options">
        <label className="field-label">COORDINATE FORMAT
          <select className="text-input select-input" value={format} onChange={(event) => handleFormatChange(event.target.value as CoordinateFormat)}>
            <option value="automatic">Automatic</option>
            <option value="latitude-longitude">Latitude / Longitude</option>
            <option value="longitude-latitude">Longitude / Latitude</option>
            <option value="easting-northing">Easting / Northing</option>
            <option value="x-y">X / Y</option>
          </select>
        </label>
        <label className="field-label">COORDINATE REFERENCE SYSTEM
          <select className="text-input select-input" value={effectiveCrs} onChange={(event) => {
            if (plotted.length) clearPlottedBoundary();
            setCrs(event.target.value as CoordinateSystem | "");
            setMessage("");
          }}>
            <option value="">{detection.projectedCandidate ? "Select CRS for projected coordinates" : "Select CRS"}</option>
            {Object.entries(coordinateSystems).map(([code, system]) => (
              <option key={code} value={code}>
                {system.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(detection.ambiguousOrder ||
        (format !== "automatic" &&
          parsed.points.some((coordinate) => coordinate.kind === "numeric") &&
          (effectiveFormat === "latitude-longitude" || effectiveFormat === "longitude-latitude"))) && (
        <fieldset className="coordinate-order">
          <legend className="field-label">COORDINATE ORDER</legend>
          <label><input type="radio" name="coordinate-order" value="latitude-longitude" checked={order === "latitude-longitude"} onChange={() => { setOrder("latitude-longitude"); setOrderConfirmed(true); }} /> Latitude, Longitude</label>
          <label><input type="radio" name="coordinate-order" value="longitude-latitude" checked={order === "longitude-latitude"} onChange={() => { setOrder("longitude-latitude"); setOrderConfirmed(true); }} /> Longitude, Latitude</label>
        </fieldset>
      )}

      <div className="coordinate-detection" aria-live="polite">
        <p className="eyebrow"><Check size={12} /> {parsed.error ? "CHECK INPUT" : "COORDINATES DETECTED"}</p>
        {parsed.error ? <p className="coordinate-error">{parsed.error}</p> : parsed.points.length > 0 ? (
          <>
            <dl>
              <div><dt>Coordinate type</dt><dd>{effectiveFormat.replaceAll("-", " / ").replace("latitude", "Latitude").replace("longitude", "Longitude").replace("easting", "Easting").replace("northing", "Northing").replace("x", "X").replace("y", "Y")}</dd></div>
              <div><dt>CRS</dt><dd>{effectiveCrs ? coordinateSystems[effectiveCrs].label : "Required — select a CRS to transform accurately"}</dd></div>
              <div><dt>Points detected</dt><dd>{parsed.points.length}</dd></div>
            </dl>
            {needsOrderConfirmation && (
              <p className="coordinate-warning">{orderConfirmed
                ? `Coordinate order confirmed: ${order === "latitude-longitude" ? "Latitude, Longitude" : "Longitude, Latitude"}.`
                : "Both values fit geographic ranges. Select the coordinate order before plotting."}</p>
            )}
            {detection.projectedCandidate && !effectiveCrs && (
              <p className="coordinate-warning">Projected coordinates detected. Their CRS cannot be safely inferred from the values; select it above.</p>
            )}
            <div className="coordinate-preview">
              {parsed.points.slice(0, 12).map((coordinate, index) => {
                const convertedPoint = converted.points[index];
                return (
                  <div className="coordinate-preview-row" key={`${coordinate.label}-${index}`}>
                    <strong>{coordinate.label}</strong>
                    <span>{effectiveFormat === "easting-northing"
                      ? `E ${coordinate.first.toFixed(2)} · N ${coordinate.second.toFixed(2)}`
                      : effectiveFormat === "x-y"
                        ? `X ${coordinate.first.toFixed(2)} · Y ${coordinate.second.toFixed(2)}`
                        : `${displayOrder === "latitude-longitude" ? "Lat" : "Lon"} ${coordinate.first} · ${displayOrder === "latitude-longitude" ? "Lon" : "Lat"} ${coordinate.second}`}</span>
                    {convertedPoint && isProjected && <small>→ {convertedPoint.latitude.toFixed(6)}°, {convertedPoint.longitude.toFixed(6)}°</small>}
                  </div>
                );
              })}
              {parsed.points.length > 12 && <p>and {parsed.points.length - 12} more point(s)</p>}
            </div>
            {converted.error && <p className="coordinate-error">{converted.error}</p>}
            <button className="primary-button coordinate-plot-button" type="button" disabled={!canPlot} onClick={plotCoordinates}>
              Plot {parsed.points.length > 2 ? "boundary" : parsed.points.length === 1 ? "point" : "line"} <ArrowRight size={14} />
            </button>
          </>
        ) : <p className="coordinate-empty">Paste coordinates to see the detected format and a preview before plotting.</p>}
        {message && <p className="review-success" role="status">{message}</p>}
      </div>

      {plotted.length > 0 && (
        <div className="coordinate-results">
          <h4>{plotted.length > 2 ? "Boundary results" : "Plotted coordinates"}</h4>
          {plotted.length > 1 && <p>Perimeter / line length: <strong>{formatLength(measurements.perimeter)}</strong></p>}
          {plotted.length > 2 && <p>Area: <strong>{measurements.areaSquareMeters.toLocaleString(undefined, { maximumFractionDigits: 2 })} m²</strong> · {(measurements.areaSquareMeters / 10000).toFixed(4)} ha</p>}
          {measurements.segmentLengths.map((length, index) => (
            <p key={`segment-${index}`}>P{index + 1} → P{(index + 1) % plotted.length + 1}: <strong>{formatLength(length)}</strong></p>
          ))}
          <button className="coordinate-clear-button" type="button" onClick={() => {
            clearPlottedBoundary();
            setMessage("");
          }}>Clear plotted coordinates</button>
        </div>
      )}
      <p className="coordinate-tool-footnote"><ArrowDown size={12} /> Map output is WGS 84. Original coordinates stay visible above; projected measurements use the selected UTM CRS.</p>
    </section>
  );
}
