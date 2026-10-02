"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Camera, MapPin, MessageSquare, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { categoryColors } from "@/lib/photo-style";
import CategoryIcon from "@/components/category-icon";
import type { PhotoRecord, PlaceRecord } from "@/types/photo";
import type { ReviewRecord } from "@/types/review";

type PlaceDetailProps = {
  place: PlaceRecord;
  photos: PhotoRecord[];
  reviews: ReviewRecord[];
  viewerId: string | null;
  loadError?: string;
};

export default function PlaceDetail({ place, photos, reviews: initialReviews, viewerId, loadError = "" }: PlaceDetailProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [draft, setDraft] = useState(initialReviews.find((review) => review.userId === viewerId)?.body ?? "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const ownReview = reviews.find((review) => review.userId === viewerId) ?? null;
  const contributors = new Set([
    ...photos.map((photo) => photo.userId),
    ...reviews.map((review) => review.userId),
  ]);
  const addPhotoPath = `/?contributePlace=${encodeURIComponent(place.id)}`;
  const contributeHref = viewerId ? addPhotoPath : `/login?mode=signup&next=${encodeURIComponent(addPhotoPath)}`;

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewerId) return;
    const body = draft.trim();
    if (body.length < 3 || body.length > 1000) {
      setError("Reviews must be between 3 and 1,000 characters.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. Your review was not saved.");
      return;
    }
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const result = ownReview
        ? await supabase.from("reviews")
            .update({ body, updated_at: new Date().toISOString() })
            .eq("id", ownReview.id)
            .select("id,place_id,contribution_id,photo_id,user_id,body,created_at,updated_at")
            .single()
        : await supabase.from("reviews")
            .insert({ place_id: place.id, user_id: viewerId, body })
            .select("id,place_id,contribution_id,photo_id,user_id,body,created_at,updated_at")
            .single();
      if (result.error) {
        setError(`Could not save your review: ${result.error.message}`);
        return;
      }
      const saved: ReviewRecord = {
        id: result.data.id,
        placeId: result.data.place_id,
        photoId: result.data.photo_id,
        userId: result.data.user_id,
        body: result.data.body,
        createdAt: result.data.created_at,
        updatedAt: result.data.updated_at,
        username: ownReview?.username ?? null,
        displayName: ownReview?.displayName ?? null,
      };
      setReviews((current) => [saved, ...current.filter((review) => review.id !== saved.id)]);
      setNotice(ownReview ? "Your review was updated." : "Your review was added.");
    } catch (saveError) {
      setError(`Could not save your review: ${saveError instanceof Error ? saveError.message : "Unexpected error."}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteReview() {
    if (!ownReview) return;
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. Your review was not deleted.");
      return;
    }
    setIsDeleting(true);
    setError("");
    setNotice("");
    try {
      const { error: deleteError } = await supabase.from("reviews").delete().eq("id", ownReview.id);
      if (deleteError) {
        setError(`Could not delete your review: ${deleteError.message}`);
        return;
      }
      setReviews((current) => current.filter((review) => review.id !== ownReview.id));
      setDraft("");
      setNotice("Your review was deleted.");
    } catch (deleteError) {
      setError(`Could not delete your review: ${deleteError instanceof Error ? deleteError.message : "Unexpected error."}`);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="place-detail-page app-shell">
      <header className="topbar">
        <Link className="brand" href="/explore" aria-label="GeoArchive Explore">
          <span className="brand-mark"><MapPin size={18} strokeWidth={2.7} /></span>
          <span className="brand-word">geoarchive<span>.</span></span>
          <span className="brand-beta">FIELD NOTES</span>
        </Link>
        <div className="topbar-actions">
          <Link className="pill-button" href="/explore"><ArrowLeft size={14} /> Explore</Link>
          <Link className="primary-button" href={contributeHref}><Camera size={14} /> Add photos</Link>
        </div>
      </header>

      <section className="place-detail-content">
        {loadError && <p className="dashboard-notice" role="status">{loadError}</p>}
        <div className="place-detail-hero">
          {photos[0]?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[0].imageUrl} alt={`Recent community photo of ${place.name}`} />
          ) : <div className="place-detail-placeholder"><Camera size={28} /></div>}
          <div className="place-detail-title">
            <span className={`place-category sticker-${categoryColors[place.category]}`}><CategoryIcon category={place.category} size={11} /> {place.category}</span>
            <h1>{place.name}</h1>
            {place.locationName && <p><MapPin size={14} /> {place.locationName}</p>}
            {place.description && <p className="place-detail-description">{place.description}</p>}
            {place.creatorUsername && <p>Added by @{place.creatorUsername}</p>}
            <div className="place-detail-stats">
              <span><Camera size={14} /> {photos.length} {photos.length === 1 ? "photo" : "photos"}</span>
              <span><MessageSquare size={14} /> {reviews.length} {reviews.length === 1 ? "review" : "reviews"}</span>
              <span>{contributors.size} {contributors.size === 1 ? "contributor" : "contributors"}</span>
            </div>
            <p className="place-no-rating">GeoArchive keeps reviews as individual experiences and does not calculate a star rating.</p>
          </div>
        </div>

        <section className="place-detail-section" aria-labelledby="place-photos-heading">
          <div className="place-detail-section-heading">
            <div><p className="eyebrow"><Camera size={12} /> COMMUNITY GALLERY</p><h2 id="place-photos-heading">Photos from the field</h2></div>
            <Link className="pill-button" href={contributeHref}>Add your photo <ArrowRight size={13} /></Link>
          </div>
          {photos.length ? (
            <div className="place-photo-gallery">
              {photos.map((photo) => (
                <article className="place-photo-item" key={photo.id}>
                  {photo.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.imageUrl} alt={photo.title} loading="lazy" />
                  ) : <div className="place-photo-placeholder"><Camera size={20} /></div>}
                  <div><strong>{photo.title}</strong>{photo.description && <p className="place-photo-caption">{photo.description}</p>}<span>{photo.username ? `@${photo.username}` : photo.displayName || "GeoArchive contributor"}</span><time dateTime={photo.createdAt}>{new Date(photo.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</time></div>
                </article>
              ))}
            </div>
          ) : <p className="place-detail-empty">No public photos have been added to this place yet.</p>}
        </section>

        <section className="place-detail-section" aria-labelledby="place-reviews-heading">
          <div className="place-detail-section-heading">
            <div><p className="eyebrow"><MessageSquare size={12} /> COMMUNITY EXPERIENCES</p><h2 id="place-reviews-heading">Reviews</h2></div>
            <span>{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</span>
          </div>
          {reviews.length ? (
            <div className="place-detail-reviews">
              {reviews.map((review) => (
                <article className="place-detail-review" key={review.id}>
                  <div><strong>{review.username ? `@${review.username}` : review.displayName || "GeoArchive member"}</strong><time dateTime={review.updatedAt}>{new Date(review.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}{review.updatedAt !== review.createdAt ? " · edited" : ""}</time></div>
                  <p>{review.body}</p>
                </article>
              ))}
            </div>
          ) : <p className="place-detail-empty">No reviews yet. Share what you experienced here.</p>}
          {viewerId ? (
            <form className="explore-review-form" onSubmit={saveReview}>
              <label className="field-label" htmlFor="place-detail-review">{ownReview ? "EDIT YOUR REVIEW" : "ADD YOUR EXPERIENCE"}</label>
              <textarea id="place-detail-review" className="text-input text-area" minLength={3} maxLength={1000} required value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="What should someone know before they visit?" />
              {error && <p className="form-error" role="alert">{error}</p>}
              {notice && <p className="review-success" role="status">{notice}</p>}
              <div className="explore-review-actions"><span>{draft.trim().length}/1000</span>{ownReview && <button className="review-delete-button" type="button" onClick={deleteReview} disabled={isSaving || isDeleting}>{isDeleting ? "Deleting..." : "Delete review"}</button>}<button className="primary-button" type="submit" disabled={isSaving || isDeleting}><Send size={13} />{isSaving ? "Saving..." : ownReview ? "Update review" : "Post review"}</button></div>
            </form>
          ) : (
            <div className="explore-review-login"><span>Sign in to share your experience.</span><Link className="pill-button" href={`/login?mode=signup&next=${encodeURIComponent(`/places/${place.id}`)}`}>Sign in to review <ArrowRight size={13} /></Link></div>
          )}
        </section>
      </section>
      <footer className="page-footer"><Link href="/explore">Back to the community map</Link><span>GEOARCHIVE&nbsp; © 2026</span></footer>
    </main>
  );
}
