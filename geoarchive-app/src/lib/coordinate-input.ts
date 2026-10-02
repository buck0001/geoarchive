import { area } from "@turf/area";
import { distance } from "@turf/distance";
import { point, polygon } from "@turf/helpers";
import proj4 from "proj4";

export const coordinateSystems = {
  "EPSG:4326": { label: "WGS 84 — EPSG:4326", projected: false },
  "EPSG:32631": { label: "WGS 84 / UTM Zone 31N — EPSG:32631", projected: true },
  "EPSG:32632": { label: "WGS 84 / UTM Zone 32N — EPSG:32632", projected: true },
} as const;

export type CoordinateSystem = keyof typeof coordinateSystems;
export type CoordinateFormat =
  | "automatic"
  | "latitude-longitude"
  | "longitude-latitude"
  | "easting-northing"
  | "x-y";
export type ParsedCoordinate = {
  label: string;
  first: number;
  second: number;
  kind: "latitude-longitude" | "longitude-latitude" | "easting-northing" | "x-y" | "numeric";
};
export type PlottedCoordinate = {
  label: string;
  sourceFirst: number;
  sourceSecond: number;
  latitude: number;
  longitude: number;
  easting?: number;
  northing?: number;
};

type CoordinateGroup = {
  label: string;
  lat?: number;
  lon?: number;
  east?: number;
  north?: number;
  x?: number;
  y?: number;
  numeric?: [number, number];
};

const numberPattern = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?";
const labeledCoordinatePattern = new RegExp(
  `\\b(latitude|lat|longitude|long|lon|easting|northing|e|n|x\\s*(?:coordinate|coord)?|y\\s*(?:coordinate|coord)?)\\s*[:=]\\s*(${numberPattern})`,
  "gi",
);
const numericPattern = new RegExp(numberPattern, "gi");

function normalizeLabel(value: string): keyof CoordinateGroup | null {
  const normalized = value.toLowerCase().replace(/\s+(coordinate|coord)$/, "").trim();
  if (normalized === "latitude" || normalized === "lat") return "lat";
  if (normalized === "longitude" || normalized === "long" || normalized === "lon") return "lon";
  if (normalized === "easting" || normalized === "e") return "east";
  if (normalized === "northing" || normalized === "n") return "north";
  if (normalized === "x") return "x";
  if (normalized === "y") return "y";
  return null;
}

export function parseCoordinateText(input: string): { points: ParsedCoordinate[]; error: string } {
  const groups = new Map<string, CoordinateGroup>();
  let anonymousRow = 0;
  let implicitGroupIndex = 1;
  let hasLabeledValues = false;
  let hasNumericRows = false;

  for (const [lineIndex, rawLine] of input.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const idMatch = line.match(/^(?:P|POINT)\s*(\d+)\b[\s,:;-]*/i);
    const groupId = idMatch ? `P${Number(idMatch[1])}` : "single";
    const content = idMatch ? line.slice(idMatch[0].length) : line;
    const matches = Array.from(content.matchAll(labeledCoordinatePattern));

    if (matches.length) {
      hasLabeledValues = true;
      let currentGroupId = groupId;
      for (const match of matches) {
        const key = normalizeLabel(match[1]);
        if (!key || key === "label" || key === "numeric") continue;
        let group = groups.get(currentGroupId);
        if (!idMatch && group?.[key] !== undefined) {
          implicitGroupIndex += 1;
          currentGroupId = `implicit-${implicitGroupIndex}`;
          group = groups.get(currentGroupId);
        }
        group ??= { label: idMatch ? groupId : `P${implicitGroupIndex}` };
        group[key] = Number(match[2]);
        groups.set(currentGroupId, group);
      }
      continue;
    }

    const values = Array.from(content.matchAll(numericPattern), (match) => Number(match[0]));
    if (values.length !== 2 || values.some((value) => !Number.isFinite(value))) {
      return { points: [], error: `Line ${lineIndex + 1} should contain a labeled coordinate pair or exactly two numbers.` };
    }
    hasNumericRows = true;
    const label = idMatch ? groupId : `P${++anonymousRow}`;
    groups.set(`${label}-${lineIndex}`, { label, numeric: [values[0], values[1]] });
  }

  if (hasLabeledValues && hasNumericRows) {
    return { points: [], error: "Use either labeled coordinates or plain coordinate pairs, not both in the same input." };
  }
  if (!groups.size) return { points: [], error: "Enter one or more coordinate pairs to continue." };

  const points: ParsedCoordinate[] = [];
  for (const group of groups.values()) {
    if (group.numeric) {
      points.push({ label: group.label, first: group.numeric[0], second: group.numeric[1], kind: "numeric" });
    } else if (group.lat !== undefined && group.lon !== undefined) {
      points.push({ label: group.label, first: group.lat, second: group.lon, kind: "latitude-longitude" });
    } else if (group.lon !== undefined && group.lat !== undefined) {
      points.push({ label: group.label, first: group.lon, second: group.lat, kind: "longitude-latitude" });
    } else if (group.east !== undefined && group.north !== undefined) {
      points.push({ label: group.label, first: group.east, second: group.north, kind: "easting-northing" });
    } else if (group.x !== undefined && group.y !== undefined) {
      points.push({ label: group.label, first: group.x, second: group.y, kind: "x-y" });
    } else {
      return { points: [], error: `${group.label} is missing its matching coordinate label.` };
    }
  }
  const explicitKinds = new Set(points.filter((coordinate) => coordinate.kind !== "numeric").map((coordinate) => coordinate.kind));
  if (explicitKinds.size > 1) {
    return { points: [], error: "Use the same coordinate labels for every point in a bulk input." };
  }
  return { points, error: "" };
}

export function inferCoordinateFormat(points: ParsedCoordinate[]): {
  format: CoordinateFormat;
  ambiguousOrder: boolean;
  projectedCandidate: boolean;
} {
  const kinds = new Set(points.map((coordinate) => coordinate.kind));
  if (kinds.size === 1) {
    const kind = points[0].kind;
    if (kind !== "numeric") return { format: kind, ambiguousOrder: false, projectedCandidate: kind === "easting-northing" || kind === "x-y" };
  }

  const looksGeographic = points.every(({ first, second }) => Math.abs(first) <= 90 && Math.abs(second) <= 180);
  if (looksGeographic) {
    const ambiguousOrder = points.some(({ first, second }) => Math.abs(first) <= 90 && Math.abs(second) <= 90);
    return { format: "latitude-longitude", ambiguousOrder, projectedCandidate: false };
  }

  const looksReversedGeographic = points.every(({ first, second }) => Math.abs(first) <= 180 && Math.abs(second) <= 90);
  if (looksReversedGeographic) return { format: "longitude-latitude", ambiguousOrder: false, projectedCandidate: false };

  return { format: "easting-northing", ambiguousOrder: false, projectedCandidate: true };
}

function isGeographicValid(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function projectionDefinition(crs: CoordinateSystem) {
  if (crs === "EPSG:32631") return "+proj=utm +zone=31 +datum=WGS84 +units=m +no_defs +type=crs";
  if (crs === "EPSG:32632") return "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs +type=crs";
  return null;
}

export function convertCoordinates(
  points: ParsedCoordinate[],
  format: CoordinateFormat,
  order: "latitude-longitude" | "longitude-latitude",
  crs: CoordinateSystem | "",
): { points: PlottedCoordinate[]; error: string } {
  if (!points.length) return { points: [], error: "Enter coordinate values before plotting." };
  const detected = inferCoordinateFormat(points);
  const resolvedFormat = format === "automatic" ? detected.format : format;
  const xyUsesGeographicCRS = resolvedFormat === "x-y" && crs === "EPSG:4326";
  const projected =
    resolvedFormat === "easting-northing" ||
    (resolvedFormat === "x-y" && !xyUsesGeographicCRS);
  const geographic = resolvedFormat === "latitude-longitude" || resolvedFormat === "longitude-latitude";

  if (projected && (!crs || crs === "EPSG:4326")) {
    return { points: [], error: "Select a projected CRS (UTM Zone 31N or 32N) before plotting these coordinates." };
  }
  if (!projected && geographic && crs && crs !== "EPSG:4326") {
    return { points: [], error: "Latitude and longitude input requires WGS 84 / EPSG:4326." };
  }

  const projection = crs ? projectionDefinition(crs) : null;
  const plotted: PlottedCoordinate[] = [];
  for (const source of points) {
    const sourceFormat = source.kind === "numeric" ? resolvedFormat : source.kind;
    if (sourceFormat === "x-y" && crs === "EPSG:4326") {
      const longitude = source.first;
      const latitude = source.second;
      if (!isGeographicValid(latitude, longitude)) {
        return { points: [], error: `${source.label} X/Y values are outside the valid EPSG:4326 longitude/latitude range.` };
      }
      plotted.push({
        label: source.label,
        sourceFirst: source.first,
        sourceSecond: source.second,
        latitude,
        longitude,
      });
      continue;
    }
    if (sourceFormat === "latitude-longitude" || sourceFormat === "longitude-latitude") {
      const coordinateOrder = source.kind === "numeric"
        ? format === "automatic" && !detected.ambiguousOrder
          ? resolvedFormat as "latitude-longitude" | "longitude-latitude"
          : order
        : sourceFormat;
      const latitude = coordinateOrder === "longitude-latitude" ? source.second : source.first;
      const longitude = coordinateOrder === "longitude-latitude" ? source.first : source.second;
      if (!isGeographicValid(latitude, longitude)) {
        return { points: [], error: `${source.label} is outside the valid latitude (−90 to 90) or longitude (−180 to 180) range.` };
      }
      plotted.push({ label: source.label, sourceFirst: source.first, sourceSecond: source.second, latitude, longitude });
      continue;
    }

    const usesProjected = sourceFormat === "easting-northing" || sourceFormat === "x-y";
    if (!usesProjected) return { points: [], error: `Could not determine the coordinate format for ${source.label}.` };
    if (!projection || !crs || crs === "EPSG:4326") {
      return { points: [], error: "A projected CRS is required for Easting/Northing or X/Y values." };
    }
    const [longitude, latitude] = proj4(projection, "EPSG:4326", [source.first, source.second]);
    if (!isGeographicValid(latitude, longitude)) {
      return { points: [], error: `${source.label} could not be transformed using ${crs}. Check the coordinates and CRS.` };
    }
    plotted.push({
      label: source.label,
      sourceFirst: source.first,
      sourceSecond: source.second,
      latitude,
      longitude,
      easting: source.first,
      northing: source.second,
    });
  }
  return { points: plotted, error: "" };
}

export function calculateBoundary(
  points: Array<Pick<PlottedCoordinate, "latitude" | "longitude" | "easting" | "northing">>,
  projected: boolean,
): { segmentLengths: number[]; perimeter: number; areaSquareMeters: number } {
  if (points.length < 2) return { segmentLengths: [], perimeter: 0, areaSquareMeters: 0 };
  const edgeCount = points.length > 2 ? points.length : points.length - 1;
  const segmentLengths: number[] = [];
  for (let index = 0; index < edgeCount; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (projected) {
      const eastingDelta = (next.easting ?? 0) - (current.easting ?? 0);
      const northingDelta = (next.northing ?? 0) - (current.northing ?? 0);
      segmentLengths.push(Math.hypot(eastingDelta, northingDelta));
    } else {
      segmentLengths.push(distance(
        point([current.longitude, current.latitude]),
        point([next.longitude, next.latitude]),
        { units: "meters" },
      ));
    }
  }

  let areaSquareMeters = 0;
  if (points.length > 2) {
    if (projected) {
      const twiceArea = points.reduce((sum, current, index) => {
        const next = points[(index + 1) % points.length];
        return sum + (current.easting ?? 0) * (next.northing ?? 0) -
          (next.easting ?? 0) * (current.northing ?? 0);
      }, 0);
      areaSquareMeters = Math.abs(twiceArea) / 2;
    } else {
      const ring = points.map(({ longitude, latitude }) => [longitude, latitude] as [number, number]);
      ring.push(ring[0]);
      areaSquareMeters = area(polygon([ring]));
    }
  }
  return {
    segmentLengths,
    perimeter: segmentLengths.reduce((sum, length) => sum + length, 0),
    areaSquareMeters,
  };
}
