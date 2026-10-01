import type { PlaceRow } from "@/types/database";
import type { PlaceRecord } from "@/types/photo";

export function toPlaceRecord(row: PlaceRow): PlaceRecord {
  return {
    id: row.id,
    createdBy: row.created_by,
    name: row.name,
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
    locationName: row.location_name,
    description: row.description,
    visibility: row.visibility,
    createdAt: row.created_at,
  };
}
