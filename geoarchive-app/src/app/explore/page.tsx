import type { Metadata } from "next";
import Explore from "@/components/explore";
import { toPhotoRecord } from "@/lib/photo-record";
import { toPlaceRecord } from "@/lib/place-record";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { PhotoRow, PlaceRow, ReviewRow } from "@/types/database";
import type { PhotoRecord, PlaceRecord } from "@/types/photo";
import type { ReviewRecord } from "@/types/review";

export const metadata: Metadata = {
  title: "Explore shared places — GeoArchive",
  description: "See photos and first-hand notes about places shared by the GeoArchive community.",
};

export default async function ExplorePage() {
  if (!getSupabaseConfig()) {
    return <Explore photos={[]} places={[]} reviews={[]} viewerId={null} loadError="Connect Supabase to load community places." />;
  }

  const supabase = await createClient();
  if (!supabase) return <Explore photos={[]} places={[]} reviews={[]} viewerId={null} loadError="Could not connect to Supabase." />;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const sessionError =
    authError?.name === "AuthSessionMissingError" ? null : authError;

  const rows: PhotoRow[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await supabase
      .from("photos")
      .select("id,place_id,contribution_id,user_id,title,description,category,image_path,latitude,longitude,location_name,location_precision,visibility,created_at")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .range(offset, offset + 999);
    if (page.error) return <Explore photos={[]} places={[]} reviews={[]} viewerId={user?.id ?? null} loadError={`Could not load public places: ${page.error.message}`} />;
    rows.push(...(page.data ?? []));
    if ((page.data ?? []).length < 1000) break;
  }

  const signedUrlByPath = new Map<string, string>();
  const signedUrlErrors: string[] = [];
  for (let offset = 0; offset < rows.length; offset += 100) {
    const imageBatch = rows.slice(offset, offset + 100);
    const { data, error: signedError } = await supabase.storage
      .from("photos")
      .createSignedUrls(imageBatch.map((row) => row.image_path), 3600);
    if (signedError) {
      signedUrlErrors.push(signedError.message);
      continue;
    }
    imageBatch.forEach((row, index) => {
      const signedUrl = data?.[index]?.signedUrl;
      if (signedUrl) signedUrlByPath.set(row.image_path, signedUrl);
    });
  }
  const photos: PhotoRecord[] = rows.map((row) =>
    toPhotoRecord(row, signedUrlByPath.get(row.image_path) ?? ""),
  );
  const imageFailures = rows.filter((row) => !signedUrlByPath.has(row.image_path)).length;
  const loadErrors: string[] = [];
  if (sessionError) loadErrors.push(`Could not verify your sign-in status: ${sessionError.message}`);
  if (signedUrlErrors.length) loadErrors.push(`Could not load shared images: ${signedUrlErrors[0]}`);
  else if (imageFailures) loadErrors.push(`${imageFailures} shared image(s) could not be loaded; their place notes are still available.`);

  const photoUserIds = [...new Set(photos.map((photo) => photo.userId))];
  const { data: photoProfiles, error: photoProfilesError } = photoUserIds.length
    ? await supabase.from("profiles").select("id,username,display_name").in("id", photoUserIds)
    : { data: [], error: null };
  if (photoProfilesError) loadErrors.push(`Could not load photo contributor profiles: ${photoProfilesError.message}`);
  const photoProfileById = new Map((photoProfiles ?? []).map((profile) => [profile.id, profile]));
  photos.forEach((photo) => {
    const profile = photoProfileById.get(photo.userId);
    photo.username = profile?.username ?? null;
    photo.displayName = profile?.display_name ?? null;
  });

  const placeRows: PlaceRow[] = [];
  let placesLoadError = "";
  for (let offset = 0; ; offset += 1000) {
    const page = await supabase.from("places")
      .select("id,created_by,name,category,latitude,longitude,location_name,description,visibility,created_at")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .range(offset, offset + 999);
    if (page.error) {
      placesLoadError = page.error.message;
      break;
    }
    placeRows.push(...(page.data ?? []));
    if ((page.data ?? []).length < 1000) break;
  }
  if (placesLoadError) loadErrors.push(`Could not load GeoArchive place details: ${placesLoadError}`);
  const places: PlaceRecord[] = placeRows.map(toPlaceRecord);
  const publicPlaceIds = [...new Set(rows.map((row) => row.place_id))];

  const reviewRows: ReviewRow[] = [];
  let reviewLoadError = "";
  for (let placeOffset = 0; placeOffset < publicPlaceIds.length && !reviewLoadError; placeOffset += 200) {
    const placeBatch = publicPlaceIds.slice(placeOffset, placeOffset + 200);
    for (let offset = 0; ; offset += 1000) {
      const page = await supabase
        .from("reviews")
        .select("id,place_id,contribution_id,photo_id,user_id,body,created_at,updated_at")
        .in("place_id", placeBatch)
        .order("created_at", { ascending: false })
        .range(offset, offset + 999);
      if (page.error) {
        reviewLoadError = page.error.message;
        break;
      }
      reviewRows.push(...(page.data ?? []));
      if ((page.data ?? []).length < 1000) break;
    }
  }
  if (reviewLoadError) loadErrors.push(`Could not load public reviews: ${reviewLoadError}`);

  const reviews: ReviewRecord[] = reviewRows.map((review) => ({
    id: review.id,
    placeId: review.place_id,
    photoId: review.photo_id,
    userId: review.user_id,
    body: review.body,
    createdAt: review.created_at,
    updatedAt: review.updated_at,
  }));
  const profileIds = [...new Set(reviews.map((review) => review.userId))];
  if (profileIds.length) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,username,display_name")
      .in("id", profileIds);
    if (profilesError) loadErrors.push(`Could not load contributor profiles: ${profilesError.message}`);
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    reviews.forEach((review) => {
      const profile = profileById.get(review.userId);
      review.username = profile?.username ?? null;
      review.displayName = profile?.display_name ?? null;
    });
  }

  return (
    <Explore
      photos={photos}
      places={places}
      reviews={reviews}
      viewerId={sessionError ? null : user?.id ?? null}
      loadError={loadErrors.join(" ")}
    />
  );
}
