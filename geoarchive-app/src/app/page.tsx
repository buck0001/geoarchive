import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";
import { toPhotoRecord } from "@/lib/photo-record";
import { createClient } from "@/lib/supabase/server";
import type { PhotoRecord } from "@/types/photo";

export default async function Home() {
  const supabase = await createClient();
  if (!supabase) redirect("/explore");

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/explore");

  const [{ data: rows, error: photosError }, { data: profile }] = await Promise.all([
    supabase
      .from("photos")
      .select("id,user_id,title,description,category,image_path,latitude,longitude,location_name,location_precision,visibility,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
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

  return (
    <Dashboard
      initialPhotos={photos}
      userId={user.id}
      userEmail={user.email ?? ""}
      displayName={profile?.display_name ?? ""}
      loadError={loadError}
    />
  );
}
