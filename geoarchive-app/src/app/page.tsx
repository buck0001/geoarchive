import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";
import { toPhotoRecord } from "@/lib/photo-record";
import { createClient } from "@/lib/supabase/server";
import type { PhotoRecord } from "@/types/photo";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ archiveLat?: string; archiveLon?: string; archiveName?: string; contributePlace?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  if (!supabase) redirect("/explore");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/explore");

  let initialArchive: {
    latitude: number | null;
    longitude: number | null;
    name: string;
    placeId?: string;
    contribute?: boolean;
  } | null = null;
  const requestedPlaceId = params.contributePlace;
  if (requestedPlaceId) {
    const { data: place, error: placeError } = await supabase
      .from("places")
      .select("id,name,latitude,longitude,location_name")
      .eq("id", requestedPlaceId)
      .maybeSingle();
    if (placeError) redirect("/explore");
    if (place) {
      initialArchive = {
        latitude: place.latitude,
        longitude: place.longitude,
        name: place.location_name || place.name,
        placeId: place.id,
        contribute: true,
      };
    }
  } else {
    const latitude = Number(params.archiveLat);
    const longitude = Number(params.archiveLon);
    if (
      params.archiveLat && params.archiveLon &&
      Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
      Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    ) {
      initialArchive = { latitude, longitude, name: params.archiveName ?? "" };
    }
  }

  const [{ data: rows, error: photosError }, { data: profile }] = await Promise.all([
    supabase
      .from("photos")
      .select("id,place_id,contribution_id,user_id,title,description,category,image_path,latitude,longitude,location_name,location_precision,visibility,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("username,display_name").eq("id", user.id).maybeSingle(),
  ]);

  let loadError = photosError?.message ?? "";
  let photos: PhotoRecord[] = [];
  if (rows) {
    const signedImageResults = await Promise.all(
      rows.map(async (row) => {
        const { data, error } = await supabase.storage
          .from("photos")
          .createSignedUrl(row.image_path, 3600);
        if (error) {
          return { photo: null, error: error.message };
        }
        return {
          photo: toPhotoRecord(row, data.signedUrl),
          error: null,
        };
      }),
    );
    const signedErrors = signedImageResults.flatMap((result) => result.error ? [result.error] : []);
    if (signedErrors.length) {
      loadError = `Could not load ${signedErrors.length} image(s): ${signedErrors[0]}`;
    }
    photos = signedImageResults.flatMap((result) => result.photo ? [result.photo] : []);
  }
  const profileUserIds = [...new Set(photos.map((photo) => photo.userId))];
  if (profileUserIds.length) {
    const { data: photoProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,username,display_name")
      .in("id", profileUserIds);
    if (profilesError) loadError = `${loadError ? `${loadError} ` : ""}Could not load contributor names: ${profilesError.message}`;
    const profileById = new Map((photoProfiles ?? []).map((profile) => [profile.id, profile]));
    photos.forEach((photo) => {
      const profile = profileById.get(photo.userId);
      photo.username = profile?.username ?? null;
      photo.displayName = profile?.display_name ?? null;
    });
  }

  return (
    <Dashboard
      initialPhotos={photos}
      userId={user.id}
      username={profile?.username ?? ""}
      displayName={profile?.display_name ?? ""}
      loadError={loadError}
      initialArchive={initialArchive}
    />
  );
}
