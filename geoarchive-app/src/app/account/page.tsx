import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Camera, MapPin, MessageSquare, UserRound } from "lucide-react";
import { saveAccountEmail } from "@/app/account/actions";
import ThemeToggle from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const [{ message }, supabase] = await Promise.all([searchParams, createClient()]);
  if (!supabase) redirect("/explore");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect("/login?next=%2Faccount");

  const [
    { data: profile, error: profileError },
    { data: contact, error: contactError },
    { count: placeCount, error: placesError },
    { count: photoCount, error: photosError },
    { count: reviewCount, error: reviewsError },
  ] = await Promise.all([
    supabase.from("profiles").select("username,display_name,created_at").eq("id", user.id).maybeSingle(),
    supabase.from("account_contacts").select("email").eq("user_id", user.id).maybeSingle(),
    supabase.from("contributions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("photos").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);
  const errors = [
    profileError && `Could not load profile: ${profileError.message}`,
    contactError && `Could not load contact email: ${contactError.message}`,
    placesError && `Could not count contributions: ${placesError.message}`,
    photosError && `Could not count photos: ${photosError.message}`,
    reviewsError && `Could not count reviews: ${reviewsError.message}`,
  ].filter(Boolean);
  const username = profile?.username ?? "member";

  return (
    <main className="account-page app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="GeoArchive home">
          <span className="brand-mark"><MapPin size={18} strokeWidth={2.7} /></span>
          <span className="brand-word">geoarchive<span>.</span></span>
          <span className="brand-beta">FIELD NOTES</span>
        </Link>
        <div className="topbar-actions"><ThemeToggle /><Link className="pill-button" href="/"><ArrowLeft size={14} /> My journal</Link></div>
      </header>
      <section className="account-content">
        <p className="eyebrow"><UserRound size={13} /> ACCOUNT SETTINGS</p>
        <h1>Your profile.</h1>
        {errors.length > 0 && <p className="dashboard-notice" role="alert">{errors.join(" ")}</p>}
        {message && <p className="account-message" role="status">{message}</p>}
        <section className="account-card">
          <div className="account-identity"><span className="account-avatar">{username.slice(0, 1).toUpperCase()}</span><div><h2>@{username}</h2><p>{profile?.display_name || "GeoArchive member"}</p></div></div>
          <dl className="account-stat-grid">
            <div><dt><MapPin size={13} /> PLACES CONTRIBUTED</dt><dd>{placeCount ?? 0}</dd></div>
            <div><dt><Camera size={13} /> PHOTOS</dt><dd>{photoCount ?? 0}</dd></div>
            <div><dt><MessageSquare size={13} /> REVIEWS</dt><dd>{reviewCount ?? 0}</dd></div>
          </dl>
          <p className="account-joined">Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "GeoArchive"}</p>
        </section>

        <section className="account-card">
          <h2>Email <span>(optional)</span></h2>
          <p className="account-copy">This private address is for contact only. It is not verified and cannot be used to recover your password.</p>
          <form className="auth-form account-email-form" action={saveAccountEmail}>
            <label className="field-label" htmlFor="account-email">CONTACT EMAIL
              <input id="account-email" className="text-input" type="email" name="email" maxLength={320} defaultValue={contact?.email ?? ""} placeholder="you@example.com" />
            </label>
            <button className="primary-button" type="submit">Save email</button>
          </form>
          <p className="account-copy">{contact?.email ? "A private contact email is on file." : "Email not provided."} Password recovery for username-only accounts is not available yet.</p>
        </section>
      </section>
      <footer className="page-footer"><Link href="/">Back to your journal</Link><span>GEOARCHIVE&nbsp; © 2026</span></footer>
    </main>
  );
}
