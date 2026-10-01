import type { PhotoRow } from "@/types/database";
import type { PhotoRecord } from "@/types/photo";

export function toPhotoRecord(row: PhotoRow, imageUrl: string): PhotoRecord {
  return {
    id: row.id,
    placeId: row.place_id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    imageUrl,
    imagePath: row.image_path,
    latitude: row.latitude,
    longitude: row.longitude,
    locationName: row.location_name,
    locationPrecision: row.location_precision,
    visibility: row.visibility,
    createdAt: row.created_at,
  };
}
