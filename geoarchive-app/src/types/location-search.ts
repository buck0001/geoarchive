import type { PhotoRecord } from "@/types/photo";

export type LocationCoordinate = {
  latitude: number;
  longitude: number;
};

export type ExternalLocation = LocationCoordinate & {
  id: string;
  name: string;
  address: string;
  source: "place-search" | "coordinates";
  archivedPhoto: PhotoRecord | null;
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
