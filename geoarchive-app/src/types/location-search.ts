import type { PhotoRecord, PlaceRecord } from "@/types/photo";

export type LocationCoordinate = {
  latitude: number;
  longitude: number;
};

export type ExternalLocation = LocationCoordinate & {
  id: string;
  placeId: string | null;
  name: string;
  address: string;
  source: "place-search" | "coordinates";
  archivedPhoto: PhotoRecord | null;
  archivedPlace: PlaceRecord | null;
};

export type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  type: string;
  addresstype?: string;
};
