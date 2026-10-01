"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Copy, LocateFixed, MapPin, MessageSquare, Search, Send, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import ContactLinks from "@/components/contact-links";
import LocationSearch from "@/components/location-search";
import GisToolFab from "@/components/gis-tool-fab";
import ThemeToggle from "@/components/theme-toggle";
import { categoryColors, categoryIcons } from "@/lib/photo-style";
import { createClient } from "@/lib/supabase/client";
import { categories, type Category, type PhotoRecord, type PlaceRecord } from "@/types/photo";
import type { ReviewRecord } from "@/types/review";
import type { ExternalLocation } from "@/types/location-search";

const MapCanvas = dynamic(() => import("@/components/map-canvas"), { ssr: false });

type ExploreProps = {
  photos: PhotoRecord[];
  places: PlaceRecord[];
  reviews: ReviewRecord[];
  viewerId: string | null;
  loadError: string;
};

export default function Explore({ photos, places, reviews: initialReviews, viewerId, loadError }: ExploreProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category | "All">("All");
  const [activePhotoId, setActivePhotoId] = useState<string | null>(photos[0]?.id ?? null);
  const [reviews, setReviews] = useState(initialReviews);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialReviews.filter((review) => review.userId === viewerId).map((review) => [review.placeId, review.body])),
  );
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isDeletingReview, setIsDeletingReview] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [droppedPin, setDroppedPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchLocation, setSearchLocation] = useState<ExternalLocation | null>(null);
  const [copyNotice, setCopyNotice] = useState("");
  const placeById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);

  const visiblePhotos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return photos.filter((photo) => {
      const place = photo.placeId ? placeById.get(photo.placeId) : undefined;
      const category = place?.category ?? photo.category;
      const searchText = `${place?.name ?? ""} ${place?.description ?? ""} ${place?.locationName ?? ""} ${photo.title} ${photo.description} ${photo.locationName} ${category}`.toLowerCase();
      return (categoryFilter === "All" || category === categoryFilter) &&
        (!normalized || searchText.includes(normalized));
    });
  }, [photos, placeById, categoryFilter, query]);
  const visiblePlacePhotos = useMemo(() => {
    const byPlace = new Map<string, PhotoRecord>();
    visiblePhotos.forEach((photo) => {
      if (photo.placeId && !byPlace.has(photo.placeId)) byPlace.set(photo.placeId, photo);
    });
    return [...byPlace.values()];
  }, [visiblePhotos]);
  const totalPlaceCount = places.length;
  const activePhoto = photos.find((photo) => photo.id === activePhotoId) ?? null;
  const activePlace = activePhoto ? places.find((place) => place.id === activePhoto.placeId) ?? null : null;
  const activeReviews = activePhoto
    ? reviews.filter((review) => review.placeId === activePhoto.placeId)
    : [];
  const activePopup = useMemo(() => {
    if (!activePhoto || activePhoto.latitude === null || activePhoto.longitude === null) return null;
    const category = activePlace?.category ?? activePhoto.category;
    const popupPhotos = photos.filter((photo) => photo.placeId === activePhoto.placeId);
    const popupReviews = reviews.filter((review) => review.placeId === activePhoto.placeId);
    return {
      photoId: activePhoto.id,
      imageUrl: activePhoto.imageUrl,
      category,
      categoryIcon: categoryIcons[category],
      categoryClass: categoryColors[category],
      locationName: activePlace?.locationName || activePhoto.locationName || "Location not shared",
      title: activePlace?.name ?? activePhoto.title,
      placeDescription: activePlace?.description ?? null,
      contributorNote: activePhoto.description || null,
      stats: `${popupPhotos.length} photos · ${new Set([...popupPhotos.map((photo) => photo.userId), ...popupReviews.map((review) => review.userId)]).size} contributors · ${popupReviews.length} reviews`,
      href: activePlace ? `/places/${activePlace.id}` : null,
    };
  }, [activePhoto, activePlace, photos, reviews]);
  const ownReview = viewerId
    ? activeReviews.find((review) => review.userId === viewerId) ?? null
    : null;
  const reviewDraft = activePhoto
    ? reviewDrafts[activePhoto.placeId ?? activePhoto.id] ?? ownReview?.body ?? ""
    : "";

  function selectPhoto(photoId: string) {
    setActivePhotoId(photoId);
    setReviewError("");
    setReviewNotice("");
  }

  function selectSearchLocation(location: ExternalLocation) {
    setSearchLocation(location);
    setMapCenter({ latitude: location.latitude, longitude: location.longitude });
    setDroppedPin(null);
    if (location.archivedPhoto) selectPhoto(location.archivedPhoto.id);
  }

  function archiveLocation(location: ExternalLocation) {
    const params = new URLSearchParams({
      archiveLat: String(location.latitude),
      archiveLon: String(location.longitude),
      archiveName: location.name,
    });
    const returnTo = `/?${params.toString()}`;
    router.push(viewerId
      ? returnTo
      : `/login?mode=signup&next=${encodeURIComponent(returnTo)}`);
  }

  function contributeToPlace(placeId: string) {
    const returnTo = `/?contributePlace=${encodeURIComponent(placeId)}`;
    router.push(viewerId ? returnTo : `/login?mode=signup&next=${encodeURIComponent(returnTo)}`);
  }

  function updateReviewDraft(body: string) {
    if (!activePhoto) return;
    setReviewDrafts((current) => ({ ...current, [activePhoto.placeId ?? activePhoto.id]: body }));
  }

  function locateMe() {
    setLocationStatus("");
    if (!navigator.geolocation) {
      setLocationStatus("Location services are not available in this browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationStatus("Map centered on your current location. Your location is not saved.");
        setIsLocating(false);
      },
      (error) => {
        setLocationStatus(
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. You can allow it in your browser settings."
            : "Could not determine your location. Check your device settings and try again.",
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function copyDroppedCoordinates() {
    if (!droppedPin) return;
    try {
      await navigator.clipboard.writeText(`${droppedPin.latitude.toFixed(6)}, ${droppedPin.longitude.toFixed(6)}`);
      setCopyNotice("Coordinates copied.");
    } catch (error) {
      setCopyNotice(`Could not copy coordinates: ${error instanceof Error ? error.message : "Clipboard unavailable."}`);
    }
  }

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activePhoto || !viewerId) return;

    const body = reviewDraft.trim();
    if (body.length < 3 || body.length > 1000) {
      setReviewError("Reviews must be between 3 and 1,000 characters.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setReviewError("Supabase is not configured. Your review was not saved.");
      return;
    }

    setIsSavingReview(true);
    setReviewError("");
    setReviewNotice("");
    try {
      if (!activePhoto.placeId) {
        setReviewError("This photo is not connected to a GeoArchive place yet.");
        return;
      }
      const result = ownReview
        ? await supabase
            .from("reviews")
            .update({ body, updated_at: new Date().toISOString() })
            .eq("id", ownReview.id)
            .select("id,place_id,contribution_id,photo_id,user_id,body,created_at,updated_at")
            .single()
        : await supabase
            .from("reviews")
            .insert({ place_id: activePhoto.placeId, user_id: viewerId, body })
            .select("id,place_id,contribution_id,photo_id,user_id,body,created_at,updated_at")
            .single();

      if (result.error) {
        setReviewError(`Could not save your review: ${result.error.message}`);
        return;
      }

      const savedReview: ReviewRecord = {
        id: result.data.id,
        placeId: result.data.place_id,
        photoId: result.data.photo_id,
        userId: result.data.user_id,
        body: result.data.body,
        createdAt: result.data.created_at,
        updatedAt: result.data.updated_at,
      };
      setReviews((current) => [
        savedReview,
        ...current.filter((review) => review.id !== savedReview.id),
      ]);
      updateReviewDraft(body);
      setReviewNotice(ownReview ? "Your review was updated." : "Your review was added.");
    } finally {
      setIsSavingReview(false);
    }
  }

  async function deleteReview() {
    if (!ownReview) return;
    const supabase = createClient();
    if (!supabase) {
      setReviewError("Supabase is not configured. Your review was not deleted.");
      return;
    }

    setIsDeletingReview(true);
    setReviewError("");
    setReviewNotice("");
    try {
      const { error } = await supabase.from("reviews").delete().eq("id", ownReview.id);
      if (error) {
        setReviewError(`Could not delete your review: ${error.message}`);
        return;
      }
      setReviews((current) => current.filter((review) => review.id !== ownReview.id));
      updateReviewDraft("");
      setReviewNotice("Your review was deleted.");
    } finally {
      setIsDeletingReview(false);
    }
  }

  return (
    <main className="app-shell explore-page">
      <div className="announcement-bar">
        <span>PLACES SHARED BY PEOPLE, NOT BROCHURES</span><span aria-hidden="true">✳</span>
        <span>SEE A LITTLE MORE BEFORE YOU GO</span><span aria-hidden="true">✳</span>
        <span>PLACES SHARED BY PEOPLE, NOT BROCHURES</span>
      </div>
      <header className="topbar">
        <Link className="brand" href="/explore" aria-label="GeoArchive explore">
          <span className="brand-mark"><MapPin size={18} strokeWidth={2.7} /></span>
          <span className="brand-word">geoarchive<span>.</span></span>
          <span className="brand-beta">FIELD NOTES</span>
        </Link>
        <div className="topbar-center"><span className="status-dot" /><span>COMMUNITY FIELD GUIDE</span></div>
        <div className="topbar-actions">
          <ThemeToggle />
          <Link className="pill-button" href="/login?mode=signup">Add a place <ArrowRight size={14} /></Link>
        </div>
      </header>

      <section className="explore-hero">
        <div className="explore-hero-copy">
          <p className="eyebrow"><span className="eyebrow-spark">✳</span> THE COMMUNITY FIELD GUIDE</p>
          <h1>See what’s <span>out there.</span></h1>
          <p>Real places, seen and shared by the people who stopped there. A small heads-up before you make the trip.</p>
        </div>
        <div className="explore-hero-sticker" aria-hidden="true">↗</div>
        <div className="explore-total"><strong>{totalPlaceCount}</strong><span>shared {totalPlaceCount === 1 ? "place" : "places"}</span></div>
      </section>

      <section className="explore-layout">
        <aside className="explore-list-panel">
          <div className="explore-list-heading">
            <div><p className="eyebrow"><Camera size={12} /> PUBLIC PLACE NOTES</p><h2>From the field.</h2></div>
          </div>
          <label className="search-box explore-search">
            <Search size={16} />
            <input aria-label="Search community places" placeholder="Find a place, note, or category..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="explore-filters" aria-label="Filter public places by category">
            <button className={`explore-filter${categoryFilter === "All" ? " explore-filter-active" : ""}`} type="button" onClick={() => setCategoryFilter("All")}>All places</button>
            {categories.map((category) => (
              <button className={`explore-filter${categoryFilter === category ? " explore-filter-active" : ""}`} type="button" key={category} onClick={() => setCategoryFilter(categoryFilter === category ? "All" : category)}>
                <span className={`category-symbol sticker-${categoryColors[category]}`}>{categoryIcons[category]}</span>{category}
              </button>
            ))}
          </div>
          {loadError && <p className="dashboard-notice" role="status">{loadError}</p>}
          <div className="explore-place-list">
            {visiblePlacePhotos.map((photo) => {
              const place = photo.placeId ? placeById.get(photo.placeId) : undefined;
              const photosAtPlace = photos.filter((item) => item.placeId === photo.placeId);
              const reviewsAtPlace = reviews.filter((item) => item.placeId === photo.placeId);
              const contributors = new Set([
                ...photosAtPlace.map((item) => item.userId),
                ...reviewsAtPlace.map((item) => item.userId),
              ]);
              return (
              <button className={`explore-place-card${activePhoto?.placeId === photo.placeId ? " explore-place-active" : ""}`} key={photo.placeId ?? photo.id} type="button" onClick={() => selectPhoto(photo.id)}>
                {photo.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="explore-place-thumb" src={photo.imageUrl} alt="" />
                ) : <span className="explore-place-thumb explore-place-placeholder"><Camera size={18} /></span>}
                <span className="explore-place-copy">
                  <span className="explore-place-category">{(place?.category ?? photo.category).toUpperCase()}</span>
                  <strong>{place?.name ?? photo.title}</strong>
                  <span className="explore-place-location"><MapPin size={11} />{place?.locationName || photo.locationName || "Location not shared"}</span>
                  <span className="explore-place-review-count"><MessageSquare size={11} />{reviewsAtPlace.length} reviews · {photosAtPlace.length} photos · {contributors.size} contributors</span>
                </span>
                <span className={`explore-place-mark sticker-${categoryColors[place?.category ?? photo.category]}`}>{categoryIcons[place?.category ?? photo.category]}</span>
              </button>
              );
            })}
            {visiblePhotos.length === 0 && (
              <div className="empty-state"><Search size={19} /><strong>{places.length ? "No places match that search." : "The field guide is just getting started."}</strong><span>{places.length ? "Try another phrase or category." : "When someone shares a public place, it will show up here."}</span></div>
            )}
          </div>
        </aside>

        <section className="explore-map-panel">
          <div className="explore-map-heading">
            <div><p className="eyebrow">LOOK AROUND</p><h2>Places on the map.</h2></div>
            <span className="explore-map-count">{visiblePlacePhotos.length} {visiblePlacePhotos.length === 1 ? "place" : "places"}</span>
          </div>
          <LocationSearch
            photos={photos}
            places={places}
            onSelect={selectSearchLocation}
            onOpenArchived={(location) => { if (location.placeId) router.push(`/places/${location.placeId}`); }}
            onContribute={(location) => { if (location.placeId) contributeToPlace(location.placeId); }}
            onArchive={(location) => {
              if (location.placeId) contributeToPlace(location.placeId);
              else archiveLocation(location);
            }}
          />
          <div className="map-workspace explore-map">
            <MapCanvas
              photos={visiblePlacePhotos}
              activePhoto={activePhotoId}
              popup={activePopup}
              viewCenter={mapCenter ?? userLocation}
              userLocation={userLocation}
              droppedPin={droppedPin}
              searchLocation={searchLocation}
              measurementPoints={[]}
              measurementMode={null}
              onSelectPhoto={(photo) => selectPhoto(photo.id)}
              onMapPick={(coordinates) => {
                setDroppedPin(coordinates);
                setSearchLocation(null);
                setMapCenter(coordinates);
                setCopyNotice("");
              }}
            />
            <div className="map-top-left"><div className="map-count-pill"><span className="count-pin"><MapPin size={13} fill="currentColor" /></span>{visiblePlacePhotos.filter((photo) => photo.latitude !== null).length}<span>places pinned</span></div></div>
            <div className="explore-map-controls">
              <button className="map-control" type="button" onClick={locateMe} disabled={isLocating} aria-label={isLocating ? "Finding your location" : "Center map on my location"} title="Center map on my location"><LocateFixed size={17} /></button>
            </div>
            <div className="explore-map-note"><ShieldCheck size={13} />Community notes are personal experiences, not guarantees. Conditions can change.</div>
          </div>
          <div className="explore-coordinate-readout">
            {droppedPin
              ? <><MapPin size={14} /><span>{droppedPin.latitude.toFixed(6)}°,&nbsp; {droppedPin.longitude.toFixed(6)}° <small>WGS 84</small></span><button className="coordinate-copy-button" type="button" onClick={() => void copyDroppedCoordinates()} aria-label="Copy coordinates"><Copy size={13} /> Copy</button></>
              : <><MapPin size={14} /><span>Click anywhere on the map to drop a temporary pin and inspect its coordinates.</span></>}
          </div>
          {copyNotice && <p className="explore-location-status" role="status">{copyNotice}</p>}
          {locationStatus && <p className="explore-location-status" role="status">{locationStatus}</p>}
          {activePhoto && (
            <section className="explore-reviews" aria-labelledby="reviews-heading">
              <div className="explore-reviews-heading">
                <div><p className="eyebrow"><MessageSquare size={12} /> COMMUNITY EXPERIENCES</p><h2 id="reviews-heading">Reviews for {activePlace?.name ?? activePhoto.title}</h2></div>
                <span className="explore-review-total">{activeReviews.length} {activeReviews.length === 1 ? "review" : "reviews"}</span>
              </div>
              {activeReviews.length ? (
                <div className="explore-review-list">
                  {activeReviews.map((review) => (
                    <article className="explore-review" key={review.id}>
                      <div className="explore-review-meta"><strong>{review.userId === viewerId ? "You" : review.username ? `@${review.username}` : review.displayName || "GeoArchive member"}</strong><time dateTime={review.updatedAt}>{new Date(review.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{review.updatedAt !== review.createdAt ? " · edited" : ""}</time></div>
                      <p>{review.body}</p>
                    </article>
                  ))}
                </div>
              ) : <p className="explore-no-reviews">No reviews yet. Be the first to share what you experienced here.</p>}

              {viewerId ? (
                <form className="explore-review-form" onSubmit={saveReview}>
                  <label className="field-label" htmlFor="place-review">{ownReview ? "EDIT YOUR REVIEW" : "ADD YOUR EXPERIENCE"}</label>
                  <textarea id="place-review" className="text-input text-area" minLength={3} maxLength={1000} required value={reviewDraft} onChange={(event) => updateReviewDraft(event.target.value)} placeholder="What should someone know before they visit?" />
                  {reviewError && <p className="form-error" role="alert">{reviewError}</p>}
                  {reviewNotice && <p className="review-success" role="status">{reviewNotice}</p>}
                  <div className="explore-review-actions">
                    <span>{reviewDraft.trim().length}/1000</span>
                    {ownReview && <button className="review-delete-button" type="button" onClick={deleteReview} disabled={isDeletingReview || isSavingReview}><Trash2 size={13} />{isDeletingReview ? "Deleting..." : "Delete"}</button>}
                    <button className="primary-button" type="submit" disabled={isSavingReview || isDeletingReview}><Send size={13} />{isSavingReview ? "Saving..." : ownReview ? "Update review" : "Post review"}</button>
                  </div>
                </form>
              ) : (
                <div className="explore-review-login">
                  <span>Sign in to share your experience.</span>
                  <Link className="pill-button" href="/login?mode=signup">Sign in to review <ArrowRight size={13} /></Link>
                </div>
              )}
              {activePlace && <button className="pill-button" type="button" onClick={() => contributeToPlace(activePlace.id)}>Add photos to this place <ArrowRight size={13} /></button>}
            </section>
          )}
          <div className="explore-privacy-note"><span className="sticker sticker-sun">✳</span><span><strong>Shared with care.</strong> Only places their contributor chose to make public appear here. Approximate pins are rounded for privacy.</span></div>
        </section>
      </section>
      <footer className="page-footer"><span>SEE A PLACE. SHARE WHAT YOU LEARNED. <span className="footer-star">✳</span></span><ContactLinks /><Link href="/login?mode=signup">Sign in to add places →</Link></footer>
      <GisToolFab />
    </main>
  );
}
