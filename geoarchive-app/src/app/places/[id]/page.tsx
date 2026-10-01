import { notFound } from "next/navigation";
import PlaceDetail from "@/components/place-detail";
import { toPhotoRecord } from "@/lib/photo-record";
import { toPlaceRecord } from "@/lib/place-record";
import { createClient } from "@/lib/supabase/server";
import type { PhotoRow, ReviewRow } from "@/types/database";
import type { PhotoRecord } from "@/types/photo";
import type { ReviewRecord } from "@/types/review";

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: placeRow, error: placeError } = await supabase
    .from("places")
    .select("id,created_by,name,category,latitude,longitude,location_name,description,visibility,created_at")
    .eq("id", id)
    .maybeSingle();
  if (placeError || !placeRow || (placeRow.visibility !== "public" && placeRow.created_by !== user?.id)) notFound();

  const photoRows: PhotoRow[] = [];
  let loadError = "";
  for (let offset = 0; ; offset += 1000) {
    const page = await supabase.from("photos")
      .select("id,place_id,contribution_id,user_id,title,description,category,image_path,latitude,longitude,location_name,location_precision,visibility,created_at")
      .eq("place_id", id)
      .order("created_at", { ascending: false })
      .range(offset, offset + 999);
    if (page.error) {
      loadError = `Could not load this place's photos: ${page.error.message}`;
      break;
    }
    photoRows.push(...(page.data ?? []));
    if ((page.data ?? []).length < 1000) break;
  }
  const reviewRows: ReviewRow[] = [];
  if (!loadError) {
    for (let offset = 0; ; offset += 1000) {
      const page = await supabase.from("reviews")
        .select("id,place_id,contribution_id,photo_id,user_id,body,created_at,updated_at")
        .eq("place_id", id)
        .order("created_at", { ascending: false })
        .range(offset, offset + 999);
      if (page.error) {
        loadError = `Could not load this place's reviews: ${page.error.message}`;
        break;
      }
      reviewRows.push(...(page.data ?? []));
      if ((page.data ?? []).length < 1000) break;
    }
  }

  const signedUrlByPath = new Map<string, string>();
  for (let offset = 0; offset < photoRows.length; offset += 100) {
    const imageBatch = photoRows.slice(offset, offset + 100);
    const { data, error: signedUrlError } = await supabase.storage.from("photos")
      .createSignedUrls(imageBatch.map((photo) => photo.image_path), 3600);
    if (signedUrlError) {
      loadError = `${loadError ? `${loadError} ` : ""}Could not load some photos: ${signedUrlError.message}`;
      continue;
    }
    imageBatch.forEach((photo, index) => {
      const signedUrl = data?.[index]?.signedUrl;
      if (signedUrl) signedUrlByPath.set(photo.image_path, signedUrl);
    });
  }
  const photos: PhotoRecord[] = photoRows.map((photo) =>
    toPhotoRecord(photo, signedUrlByPath.get(photo.image_path) ?? ""),
  );
  const imageFailures = photoRows.filter((photo) => !signedUrlByPath.has(photo.image_path)).length;
  if (imageFailures) loadError = `${loadError ? `${loadError} ` : ""}${imageFailures} photo image(s) could not be opened.`;
  const reviews: ReviewRecord[] = reviewRows.map((review) => ({
    id: review.id,
    placeId: review.place_id,
    photoId: review.photo_id,
    userId: review.user_id,
    body: review.body,
    createdAt: review.created_at,
    updatedAt: review.updated_at,
  }));

  const authorIds = [...new Set([
    ...photos.map((photo) => photo.userId),
    ...reviews.map((review) => review.userId),
    ...(placeRow.created_by ? [placeRow.created_by] : []),
  ])];
  const place = toPlaceRecord(placeRow);
  if (authorIds.length) {
    const { data: profiles, error: profileError } = await supabase.from("profiles")
      .select("id,username,display_name").in("id", authorIds);
    if (profileError) loadError = `${loadError ? `${loadError} ` : ""}Could not load contributor profiles: ${profileError.message}`;
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    photos.forEach((photo) => {
      const profile = profileById.get(photo.userId);
      photo.username = profile?.username ?? null;
      photo.displayName = profile?.display_name ?? null;
    });
    reviews.forEach((review) => {
      const profile = profileById.get(review.userId);
      review.username = profile?.username ?? null;
      review.displayName = profile?.display_name ?? null;
    });
    const creator = place.createdBy ? profileById.get(place.createdBy) : null;
    place.creatorUsername = creator?.username ?? null;
    place.creatorDisplayName = creator?.display_name ?? null;
  }

  return (
    <PlaceDetail
      place={place}
      photos={photos}
      reviews={reviews}
      viewerId={user?.id ?? null}
      loadError={loadError}
    />
  );
}
