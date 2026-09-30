import type { Metadata } from "next";
import Explore from "@/components/explore";
import { toPhotoRecord } from "@/lib/photo-record";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { ReviewRow } from "@/types/database";
import type { PhotoRecord } from "@/types/photo";
import type { ReviewRecord } from "@/types/review";

export const metadata: Metadata = {
  title: "Explore shared places — GeoArchive",
  description: "See photos and first-hand notes about places shared by the GeoArchive community.",
};

export default async function ExplorePage() {
  if (!getSupabaseConfig()) {
    return <Explore photos={[]} reviews={[]} viewerId={null} loadError="Connect Supabase to load community places." />;
  }

  const supabase = await createClient();
  if (!supabase) return <Explore photos={[]} reviews={[]} viewerId={null} loadError="Could not connect to Supabase." />;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  const sessionError =
    authError?.name === "AuthSessionMissingError" ? null : authError;

  const { data: rows, error } = await supabase
    .from("photos")
    .select("id,user_id,title,description,category,image_path,latitude,longitude,location_name,location_precision,visibility,created_at")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return <Explore photos={[]} reviews={[]} viewerId={user?.id ?? null} loadError={`Could not load public places: ${error.message}`} />;
  if (!rows) return <Explore photos={[]} reviews={[]} viewerId={user?.id ?? null} loadError="No public place data was returned." />;

  const { data: signedUrls, error: signedUrlError } = rows.length
    ? await supabase.storage.from("photos").createSignedUrls(
        rows.map((row) => row.image_path),
        3600,
      )
    : { data: [], error: null };
  const photos: PhotoRecord[] = rows.map((row, index) =>
    toPhotoRecord(row, signedUrlError ? "" : signedUrls?.[index]?.signedUrl ?? ""),
  );
  const imageFailures = signedUrlError
    ? rows.length
    : (signedUrls ?? []).filter((image) => !image.signedUrl).length;
  const loadErrors: string[] = [];
  if (sessionError) loadErrors.push(`Could not verify your sign-in status: ${sessionError.message}`);
  if (signedUrlError) loadErrors.push(`Could not load shared images: ${signedUrlError.message}`);
  else if (imageFailures) loadErrors.push(`${imageFailures} shared image(s) could not be loaded; their place notes are still available.`);

  let reviewRows: ReviewRow[] = [];
  if (rows.length) {
    const { data, error: reviewsError } = await supabase
      .from("reviews")
      .select("id,photo_id,user_id,body,created_at,updated_at")
      .in("photo_id", rows.map((row) => row.id))
      .order("created_at", { ascending: false })
      .limit(1000);
    if (reviewsError) loadErrors.push(`Could not load public reviews: ${reviewsError.message}`);
    else reviewRows = data ?? [];
  }

  const reviews: ReviewRecord[] = reviewRows.map((review) => ({
    id: review.id,
    photoId: review.photo_id,
    userId: review.user_id,
    body: review.body,
    createdAt: review.created_at,
    updatedAt: review.updated_at,
  }));

  return (
    <Explore
      photos={photos}
      reviews={reviews}
      viewerId={sessionError ? null : user?.id ?? null}
      loadError={loadErrors.join(" ")}
    />
  );
}
