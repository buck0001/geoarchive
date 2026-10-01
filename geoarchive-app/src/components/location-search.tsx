"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Archive, ExternalLink, LoaderCircle, MapPin, Search } from "lucide-react";
import type { PhotoRecord, PlaceRecord } from "@/types/photo";
import type { ExternalLocation, LocationCoordinate, NominatimResult } from "@/types/location-search";

type LocationSearchProps = {
  photos: PhotoRecord[];
  places?: PlaceRecord[];
  onSelect: (location: ExternalLocation) => void;
  onOpenArchived: (location: ExternalLocation) => void;
  onContribute: (location: ExternalLocation) => void;
  onArchive: (location: ExternalLocation) => void;
};

function parseLatitudeLongitude(query: string): LocationCoordinate | null {
  const match = query.trim().match(
    /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*[,;\s]\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/,
  );
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Coordinates must be latitude, longitude with latitude from −90 to 90 and longitude from −180 to 180.");
  }
  return { latitude, longitude };
}

function distanceMeters(a: LocationCoordinate, b: LocationCoordinate) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function matchArchivedPlace(location: LocationCoordinate, places: PlaceRecord[]) {
  return places.find((place) =>
    place.latitude !== null &&
    place.longitude !== null &&
    distanceMeters(location, { latitude: place.latitude, longitude: place.longitude }) <= 100,
  ) ?? null;
}

function matchArchivedPhoto(location: LocationCoordinate, photos: PhotoRecord[]) {
  return photos.find((photo) =>
    photo.latitude !== null &&
    photo.longitude !== null &&
    distanceMeters(location, { latitude: photo.latitude, longitude: photo.longitude }) <= 100,
  ) ?? null;
}

export default function LocationSearch({
  photos,
  places = [],
  onSelect,
  onOpenArchived,
  onContribute,
  onArchive,
}: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExternalLocation[]>([]);
  const [error, setError] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const requestId = useRef(0);

  const archivedResults = useMemo(() => results.filter((result) => result.archivedPlace || result.archivedPhoto), [results]);
  const externalResults = useMemo(() => results.filter((result) => !result.archivedPlace && !result.archivedPhoto), [results]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const searchText = query.trim();
    if (!searchText) {
      setError("Enter a place name, address, landmark, or latitude/longitude.");
      return;
    }

    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const currentRequest = ++requestId.current;
    setError("");
    setResults([]);

    try {
      const coordinates = parseLatitudeLongitude(searchText);
      if (coordinates) {
        const name = `Coordinates ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
        const archivedPlace = matchArchivedPlace(coordinates, places);
        const archivedPhoto = photos.find((photo) => photo.placeId === archivedPlace?.id) ??
          matchArchivedPhoto(coordinates, photos);
        setResults([{
          ...coordinates,
          id: `coordinates-${coordinates.latitude}-${coordinates.longitude}`,
          name,
          address: "WGS 84 latitude, longitude",
          source: "coordinates",
          archivedPhoto,
          placeId: archivedPlace?.id ?? archivedPhoto?.placeId ?? null,
          archivedPlace,
        }]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const response = await fetch(`/api/location-search?q=${encodeURIComponent(searchText)}`, {
        signal: controller.signal,
      });
      const payload = await response.json() as { results?: NominatimResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? `Place search failed (HTTP ${response.status}). Try again shortly.`);
      const providerResults = payload.results ?? [];
      if (requestId.current !== currentRequest) return;
      setResults(providerResults.map((result) => {
        const latitude = Number(result.lat);
        const longitude = Number(result.lon);
        const name = result.name || result.display_name.split(",")[0] || "Unnamed location";
        const archivedPlace = matchArchivedPlace({ latitude, longitude }, places);
        const archivedPhoto = photos.find((photo) => photo.placeId === archivedPlace?.id) ??
          matchArchivedPhoto({ latitude, longitude }, photos);
        return {
          id: `nominatim-${result.place_id}`,
          latitude,
          longitude,
          name,
          address: result.display_name,
          source: "place-search" as const,
          archivedPhoto,
          placeId: archivedPlace?.id ?? archivedPhoto?.placeId ?? null,
          archivedPlace,
        };
      }));
      if (!providerResults.length) setError("No worldwide place-search results found. Try a nearby city, landmark, or fuller address.");
    } catch (searchError) {
      if (searchError instanceof DOMException && searchError.name === "AbortError") return;
      setError(searchError instanceof Error ? searchError.message : "Could not search for that location.");
    } finally {
      if (requestId.current === currentRequest) setIsSearching(false);
    }
  }

  function choose(location: ExternalLocation) {
    onSelect(location);
  }

  function renderResult(location: ExternalLocation) {
    return (
      <article className="location-result" key={location.id}>
        <button className="location-result-select" type="button" onClick={() => choose(location)}>
          <MapPin size={15} />
          <span><strong>{location.name}</strong><small>{location.address}</small></span>
          <ArrowRight size={13} />
        </button>
        <span className={`location-result-badge${location.archivedPlace || location.archivedPhoto ? " location-result-archived" : ""}`}>
          {location.archivedPlace || location.archivedPhoto ? <><Archive size={10} /> ARCHIVED IN GEOARCHIVE</> : <><ExternalLink size={10} /> EXTERNAL LOCATION</>}
        </span>
        {(location.archivedPlace || location.archivedPhoto) && location.placeId
          ? <>
            <button className="location-result-action" type="button" onClick={() => onOpenArchived(location)}>View shared place</button>
            <button className="location-result-action" type="button" onClick={() => onContribute(location)}>Add photos</button>
          </>
          : <button className="location-result-action" type="button" onClick={() => onArchive(location)}>Archive this place</button>}
      </article>
    );
  }

  return (
    <section className="location-search" aria-label="Worldwide location search">
      <form className="location-search-form" onSubmit={search}>
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Search any place or enter latitude, longitude"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search any place, address, landmark, or lat, lon…"
        />
        <button className="primary-button" type="submit" disabled={isSearching}>
          {isSearching ? <LoaderCircle className="location-search-spinner" size={14} /> : <Search size={14} />}
          {isSearching ? "Searching" : "Search"}
        </button>
      </form>
      <p className="location-search-attribution">Worldwide search via OpenStreetMap Nominatim · © OpenStreetMap contributors. Results are temporary and are not stored in GeoArchive.</p>
      {error && <p className="location-search-error" role="status">{error}</p>}
      {results.length > 0 && (
        <div className="location-search-results" aria-live="polite">
          {archivedResults.length > 0 && <section><h3><Archive size={12} /> IN GEOARCHIVE</h3>{archivedResults.map(renderResult)}</section>}
          {externalResults.length > 0 && <section><h3><ExternalLink size={12} /> EXTERNAL PLACES</h3>{externalResults.map(renderResult)}</section>}
          <p className="location-results-attribution">© OpenStreetMap contributors · Nominatim</p>
        </div>
      )}
    </section>
  );
}
