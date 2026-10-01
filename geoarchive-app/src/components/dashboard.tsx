"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { area as turfArea } from "@turf/area";
import { distance as turfDistance } from "@turf/distance";
import { point as turfPoint, polygon as turfPolygon } from "@turf/helpers";
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  Compass,
  Copy,
  Crosshair,
  Expand,
  Eye,
  Filter,
  Layers2,
  LogOut,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Ruler,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { categories, type Category, type PhotoRecord } from "@/types/photo";
import { createClient } from "@/lib/supabase/client";
import ThemeToggle from "@/components/theme-toggle";
import ContactLinks from "@/components/contact-links";
import LocationSearch from "@/components/location-search";
import GisToolFab from "@/components/gis-tool-fab";
import { categoryColors, categoryIcons } from "@/lib/photo-style";
import type { ExternalLocation } from "@/types/location-search";

const MapCanvas = dynamic(() => import("@/components/map-canvas"), { ssr: false });

type Coordinates = { latitude: number; longitude: number };
type ToolMode = "browse" | "distance" | "area" | "nearby";
type DashboardProps = {
  initialPhotos: PhotoRecord[];
  userId: string;
  username: string;
  displayName: string;
  loadError: string;
  initialArchive?: { latitude: number | null; longitude: number | null; name: string; placeId?: string; contribute?: boolean } | null;
};

function distanceBetween(a: Coordinates, b: Coordinates) {
  return turfDistance(
    turfPoint([a.longitude, a.latitude]),
    turfPoint([b.longitude, b.latitude]),
    { units: "meters" },
  );
}

export default function Dashboard({ initialPhotos, userId, username, displayName, loadError, initialArchive = null }: DashboardProps) {
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoRecord[]>(initialPhotos);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(initialPhotos[0]?.id ?? null);
  const [categoryFilter, setCategoryFilter] = useState<Category | "All">("All");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(Boolean(initialArchive));
  const [selectedPlaceId, setSelectedPlaceId] = useState(initialArchive?.placeId ?? null);
  const [titleDraft, setTitleDraft] = useState(initialArchive?.contribute ? "" : initialArchive?.name ?? "");
  const [locationNameDraft, setLocationNameDraft] = useState(initialArchive?.name ?? "");
  const [locationMode, setLocationMode] = useState<"none" | "current" | "manual">(
    initialArchive && initialArchive.latitude !== null && initialArchive.longitude !== null ? "manual" : "none",
  );
  const [pickingLocation, setPickingLocation] = useState(false);
  const [manualLocation, setManualLocation] = useState<Coordinates | null>(
    initialArchive && initialArchive.latitude !== null && initialArchive.longitude !== null
      ? { latitude: initialArchive.latitude, longitude: initialArchive.longitude }
      : null,
  );
  const [geolocationError, setGeolocationError] = useState("");
  const [toolMode, setToolMode] = useState<ToolMode>("browse");
  const [measurePoints, setMeasurePoints] = useState<Coordinates[]>([]);
  const [nearbyCenter, setNearbyCenter] = useState<Coordinates | null>(null);
  const [nearbyPhotoIds, setNearbyPhotoIds] = useState<string[] | null>(null);
  const [radius, setRadius] = useState(1000);
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(
    initialArchive && initialArchive.latitude !== null && initialArchive.longitude !== null
      ? { latitude: initialArchive.latitude, longitude: initialArchive.longitude }
      : null,
  );
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [droppedPin, setDroppedPin] = useState<Coordinates | null>(null);
  const [searchLocation, setSearchLocation] = useState<ExternalLocation | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [coordinatesCopied, setCoordinatesCopied] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState(loadError);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialArchive) router.replace("/", { scroll: false });
  }, [initialArchive, router]);

  const visiblePhotos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return photos.filter((photo) => {
      const matchesCategory = categoryFilter === "All" || photo.category === categoryFilter;
      const matchesQuery =
        !normalized ||
        `${photo.title} ${photo.description} ${photo.locationName} ${photo.category}`
          .toLowerCase()
          .includes(normalized);
      const matchesNearby =
        toolMode !== "nearby" ||
        nearbyCenter === null ||
        nearbyPhotoIds?.includes(photo.id) === true;
      return matchesCategory && matchesQuery && matchesNearby;
    });
  }, [photos, categoryFilter, query, toolMode, nearbyCenter, nearbyPhotoIds]);

  const activePhoto = photos.find((photo) => photo.id === activePhotoId) ?? null;
  const areaSquareMeters = measurePoints.length > 2
    ? turfArea(turfPolygon([[
        ...measurePoints.map((point) => [point.longitude, point.latitude] as [number, number]),
        [measurePoints[0].longitude, measurePoints[0].latitude],
      ]]))
    : 0;
  const lineMeters = measurePoints.reduce(
    (total, point, index) =>
      index === 0 ? total : total + distanceBetween(measurePoints[index - 1], point),
    0,
  );

  function setTool(mode: ToolMode) {
    setToolMode(mode);
    setMeasurePoints([]);
    if (mode === "nearby") {
      setNearbyCenter(null);
      setNearbyPhotoIds(null);
    }
  }

  async function searchNearby(point: Coordinates, searchRadius: number) {
    const supabase = createClient();
    if (!supabase) {
      setNotice("Supabase is not configured.");
      return;
    }
    const { data, error } = await supabase.rpc("nearby_photos", {
      center_latitude: point.latitude,
      center_longitude: point.longitude,
      radius_meters: searchRadius,
    });
    if (error) {
      setNotice(`Nearby search failed: ${error.message}`);
      return;
    }
    setNearbyPhotoIds(data.map((photo) => photo.id));
    setNotice("");
  }

  function changeNearbyRadius(delta: number) {
    const nextRadius = Math.min(10000, Math.max(250, radius + delta));
    setRadius(nextRadius);
    if (nearbyCenter) void searchNearby(nearbyCenter, nextRadius);
  }

  function handleMapPick(point: Coordinates) {
    setCoordinates(point);
    setCoordinatesCopied(false);
    setDroppedPin(point);
    if (pickingLocation) {
      setManualLocation(point);
      setLocationMode("manual");
      setPickingLocation(false);
      setModalOpen(true);
    }
    if (modalOpen && locationMode === "manual") setManualLocation(point);
    if (toolMode === "distance" || toolMode === "area") {
      setMeasurePoints((existing) => [...existing, point]);
    }
    if (toolMode === "nearby") {
      setNearbyCenter(point);
      void searchNearby(point, radius);
    }
  }

  function selectSearchLocation(location: ExternalLocation) {
    setSearchLocation(location);
    setMapCenter({ latitude: location.latitude, longitude: location.longitude });
    setActivePhotoId(location.archivedPhoto?.id ?? null);
    setCoordinates({ latitude: location.latitude, longitude: location.longitude });
    setDroppedPin(null);
  }

  function startArchive(location: { latitude: number; longitude: number; name: string; placeId?: string }) {
    setSearchLocation(null);
    setMapCenter({ latitude: location.latitude, longitude: location.longitude });
    setManualLocation({ latitude: location.latitude, longitude: location.longitude });
    setLocationMode("manual");
    setTitleDraft(location.placeId ? "" : location.name.slice(0, 100));
    setLocationNameDraft(location.name);
    setSelectedPlaceId(location.placeId ?? null);
    setFormError("");
    setModalOpen(true);
  }

  function locateCurrentLocation() {
    setGeolocationError("");
    if (!navigator.geolocation) {
      setGeolocationError("Location is unavailable in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { latitude: coords.latitude, longitude: coords.longitude };
        setManualLocation(point);
        setCoordinates(point);
        setCoordinatesCopied(false);
        setDroppedPin(point);
        setMapCenter(point);
        setUserLocation(point);
      },
      (error) => setGeolocationError(
        error.code === error.PERMISSION_DENIED
          ? "Location access was denied. Allow it in your browser settings to use your current location."
          : "Could not determine your location. Check your device settings and try again.",
      ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function locateMapPosition() {
    if (!navigator.geolocation) {
      setNotice("Location services are not available in this browser.");
      return;
    }
    setNotice("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { latitude: coords.latitude, longitude: coords.longitude };
        setCoordinates(point);
        setCoordinatesCopied(false);
        setDroppedPin(point);
        setMapCenter(point);
        setUserLocation(point);
      },
      (error) => setNotice(
        error.code === error.PERMISSION_DENIED
          ? "Location access was denied. Allow it in your browser settings to center the map."
          : "Could not determine your location. Check your device settings and try again.",
      ),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function copyCoordinates() {
    if (!coordinates) return;
    try {
      await navigator.clipboard.writeText(
        `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`,
      );
      setCoordinatesCopied(true);
    } catch (error) {
      setNotice(`Could not copy coordinates: ${error instanceof Error ? error.message : "Clipboard unavailable."}`);
    }
  }

  async function savePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setFormError("");
    const form = new FormData(formElement);
    const file = form.get("image");
    const title = String(form.get("title") ?? "").trim();
    const submittedLocationName = String(form.get("locationName") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const category = String(form.get("category") ?? "Other") as Category;
    const visibility = String(form.get("visibility") ?? "private") as "private" | "public";
    const requestedPrecision = String(form.get("locationPrecision") ?? "exact") as
      | "exact"
      | "approximate"
      | "none";
    const locationPrecision = locationMode === "none" ? "none" : requestedPrecision;

    if (!(file instanceof File) || file.size === 0) {
      setFormError("Choose a photo to add to your archive.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setFormError("Choose a JPG, PNG, WEBP, or AVIF image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFormError("Choose an image under 10 MB.");
      return;
    }
    if (!title) {
      setFormError("Add a title for this place.");
      return;
    }
    if (locationPrecision !== "none" && locationMode === "current" && !manualLocation) {
      setFormError("Wait for your current location, or choose not to attach one.");
      return;
    }
    if (locationPrecision !== "none" && locationMode === "manual" && !manualLocation) {
      setFormError("Choose a point on the map, or choose not to attach a location.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setFormError("Supabase is not configured. Add the project URL and anon key to .env.local.");
      return;
    }

    const point = locationPrecision === "none" ? null : manualLocation;
    const latitude = point
      ? locationPrecision === "approximate" ? Number(point.latitude.toFixed(3)) : point.latitude
      : null;
    const longitude = point
      ? locationPrecision === "approximate" ? Number(point.longitude.toFixed(3)) : point.longitude
      : null;
    const extensionByType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
    };
    const imagePath = `${userId}/${crypto.randomUUID()}.${extensionByType[file.type]}`;
    let uploadedPath: string | null = null;
    let insertedId: string | null = null;
    let createdPlaceId: string | null = null;
    setIsSaving(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(imagePath, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
      uploadedPath = imagePath;

      let placeId = selectedPlaceId;
      if (!placeId) {
        const placeResult = await supabase.from("places").insert({
          created_by: userId,
          name: (submittedLocationName || title).slice(0, 200),
          category,
          latitude,
          longitude,
          location_name: point ? submittedLocationName || `${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}` : "",
          description: "",
          visibility,
        }).select("id").single();
        if (placeResult.error) throw new Error(`Place could not be created: ${placeResult.error.message}`);
        placeId = placeResult.data.id;
        createdPlaceId = placeId;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("photos")
        .insert({
          place_id: placeId,
          user_id: userId,
          title,
          description,
          category,
          image_path: imagePath,
          latitude,
          longitude,
          location_name: point ? submittedLocationName || `${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}` : "",
          location_precision: locationPrecision,
          visibility,
        })
        .select("id,created_at")
        .single();
      if (insertError) throw new Error(`Photo record could not be saved: ${insertError.message}`);
      insertedId = inserted.id;

      const { data: signedImage, error: signedImageError } = await supabase.storage
        .from("photos")
        .createSignedUrl(imagePath, 3600);
      if (signedImageError) throw new Error(`Photo saved, but its image could not be opened: ${signedImageError.message}`);

      const nextPhoto: PhotoRecord = {
        id: inserted.id,
        placeId,
        userId,
        title,
        description,
        category,
        imageUrl: signedImage.signedUrl,
        imagePath,
        latitude,
        longitude,
        locationName: point ? submittedLocationName || `${latitude?.toFixed(4)}, ${longitude?.toFixed(4)}` : "",
        locationPrecision,
        visibility,
        createdAt: inserted.created_at,
      };
      setPhotos((existing) => [nextPhoto, ...existing]);
      setActivePhotoId(nextPhoto.id);
      setSelectedPlaceId(null);
      setModalOpen(false);
      setLocationMode("none");
      setManualLocation(null);
      formElement.reset();
      setNotice("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The photo could not be saved.";
      const cleanupMessages: string[] = [];
      if (insertedId) {
        const { error: deleteError } = await supabase.from("photos").delete().eq("id", insertedId);
        if (deleteError) cleanupMessages.push(`Photo cleanup failed: ${deleteError.message}`);
      }
      if (createdPlaceId) {
        const { error: placeDeleteError } = await supabase.from("places").delete().eq("id", createdPlaceId);
        if (placeDeleteError) cleanupMessages.push(`Place cleanup failed: ${placeDeleteError.message}`);
      }
      if (uploadedPath) {
        const { error: removeError } = await supabase.storage.from("photos").remove([uploadedPath]);
        if (removeError) cleanupMessages.push(`Image cleanup failed: ${removeError.message}`);
      }
      setFormError([message, ...cleanupMessages].join(" "));
    } finally {
      setIsSaving(false);
    }
  }

  async function deletePhoto(photo: PhotoRecord) {
    const supabase = createClient();
    if (!supabase) {
      setNotice("Supabase is not configured.");
      return;
    }
    const { error: recordError } = await supabase.from("photos").delete().eq("id", photo.id);
    if (recordError) {
      setNotice(`Could not delete this place: ${recordError.message}`);
      return;
    }
    setPhotos((existing) => existing.filter((item) => item.id !== photo.id));
    setActivePhotoId(null);
    const { error: imageError } = await supabase.storage.from("photos").remove([photo.imagePath]);
    setNotice(imageError ? `Place deleted, but its image could not be removed: ${imageError.message}` : "");
  }

  async function signOut() {
    const supabase = createClient();
    if (!supabase) {
      setNotice("Supabase is not configured.");
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      setNotice(`Could not sign out: ${error.message}`);
      return;
    }
    router.replace("/explore");
  }

  return (
    <main className="app-shell">
      <div className="announcement-bar">
        <span>YOUR WORLD, IN YOUR WORDS</span>
        <span aria-hidden="true">✳</span>
        <span>EVERY PLACE HAS A STORY</span>
        <span aria-hidden="true">✳</span>
        <span>YOUR WORLD, IN YOUR WORDS</span>
        <span aria-hidden="true">✳</span>
        <span>EVERY PLACE HAS A STORY</span>
      </div>

      <header className="topbar">
        <Link className="brand" href="/" aria-label="GeoArchive home">
          <span className="brand-mark"><MapPin size={18} strokeWidth={2.7} /></span>
          <span className="brand-word">geoarchive<span>.</span></span>
          <span className="brand-beta">FIELD NOTES</span>
        </Link>
        <div className="topbar-center">
          <span className="status-dot" />
          <span>YOUR WORLD, YOUR WAY</span>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <Link className="pill-button explore-nav-link" href="/explore"><Compass size={14} /><span>Explore</span></Link>
          <button className="icon-button" type="button" aria-label="Help">
            <CircleHelp size={18} />
          </button>
          <Link className="avatar-button account-avatar-link" href="/account" aria-label={`Account settings for ${username ? `@${username}` : "your account"}`} title="Account settings">
            {(username || displayName || "U").slice(0, 1).toUpperCase()}
          </Link>
          <button className="icon-button" type="button" aria-label="Sign out" title="Sign out" onClick={signOut}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <section className="dashboard-section">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-spark">✳</span> YOUR FIELD JOURNAL</p>
              <h1>Places<br />to <span>keep.</span></h1>
            </div>
            <span className="sticker sticker-sun" aria-hidden="true">✳</span>
          </div>
          <p className="sidebar-intro">A little archive for all the places that made you stop and look.</p>

          <button className="primary-button add-place-button" type="button" onClick={() => {
            setFormError("");
            setLocationMode("none");
            setManualLocation(null);
            setPickingLocation(false);
            setTitleDraft("");
            setLocationNameDraft("");
            setSelectedPlaceId(null);
            setModalOpen(true);
          }}>
            <Plus size={17} strokeWidth={2.5} /> Add a place <ArrowRight size={16} />
          </button>

          <div className="search-box">
            <Search size={16} />
            <input
              aria-label="Search your archive"
              placeholder="Find a place..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="search-shortcut">⌘ K</span>
          </div>

          <div className="filter-heading">
            <span><Filter size={13} /> COLLECTION</span>
            <button type="button" aria-label="Filter settings"><SlidersHorizontal size={15} /></button>
          </div>
          <div className="category-list">
            <button
              className={`category-row${categoryFilter === "All" ? " category-active" : ""}`}
              type="button"
              onClick={() => setCategoryFilter("All")}
            >
              <span className="category-symbol all-symbol"><Layers2 size={14} /></span>
              <span>All places</span>
              <span className="category-count">{photos.length}</span>
            </button>
            {categories.map((category) => (
              <button
                className={`category-row${categoryFilter === category ? " category-active" : ""}`}
                key={category}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === category ? "All" : category)}
              >
                <span className={`category-symbol sticker-${categoryColors[category]}`}>
                  {categoryIcons[category]}
                </span>
                <span>{category}</span>
                <span className="category-count">
                  {photos.filter((photo) => photo.category === category).length}
                </span>
              </button>
            ))}
          </div>

          <div className="sidebar-card">
            <div className="sidebar-card-icon"><Compass size={18} /></div>
            <p className="sidebar-card-title">A world of your own.</p>
            <p className="sidebar-card-copy">Your location is always yours to choose. No coordinates? No problem.</p>
            <span className="sidebar-card-tag"><Eye size={11} /> PRIVATE BY DEFAULT</span>
          </div>

          <div className="sidebar-footer">
            <span className="footer-avatar">A</span>
            <Link className="footer-user" href="/account"><strong>@{username || "member"}</strong><small>Account settings</small></Link>
            <button type="button" aria-label="Sign out" onClick={signOut}><ChevronDown size={16} /></button>
          </div>
        </aside>

        <section className="map-panel">
          <div className="map-heading">
            <div>
              <div className="map-breadcrumb"><span>MY ARCHIVE</span><ArrowRight size={12} /><strong>THE MAP</strong></div>
              <h2>Everywhere <span>I’ve been.</span></h2>
            </div>
            <div className="map-heading-actions">
              <button className="pill-button" type="button" onClick={() => setTool("nearby")}>
                <Crosshair size={15} /> Nearby
              </button>
              <button className="pill-button" type="button" onClick={() => setTool("browse")}>
                <Expand size={14} /> <span>Explore map</span>
              </button>
            </div>
          </div>
          {notice && <p className="dashboard-notice" role="status">{notice}</p>}

          <LocationSearch
            photos={photos}
            onSelect={selectSearchLocation}
            onOpenArchived={(location) => {
              if (location.placeId) router.push(`/places/${location.placeId}`);
            }}
            onContribute={(location) => {
              if (location.placeId) startArchive({ ...location, placeId: location.placeId });
            }}
            onArchive={(location) => startArchive({ ...location, placeId: location.placeId ?? undefined })}
          />

          <div className="map-workspace">
            <MapCanvas
              photos={visiblePhotos}
              activePhoto={activePhotoId}
              viewCenter={mapCenter}
              searchLocation={searchLocation}
              userLocation={userLocation}
              droppedPin={droppedPin}
              measurementPoints={measurePoints}
              measurementMode={toolMode === "distance" || toolMode === "area" ? toolMode : null}
              onSelectPhoto={(photo) => setActivePhotoId(photo.id)}
              onMapPick={handleMapPick}
              onCoordinatesChange={setCoordinates}
            />

            <div className="map-top-left">
              <div className="map-count-pill"><span className="count-pin"><MapPin size={13} fill="currentColor" /></span>
                {visiblePhotos.length} <span>{visiblePhotos.length === 1 ? "place" : "places"} on this map</span>
              </div>
              {toolMode !== "browse" && (
                <button className="map-tool-hint" type="button" onClick={() => setTool("browse")}>
                  <span><Ruler size={14} /> {toolMode === "distance" ? "Click the map to measure distance" : toolMode === "area" ? "Click to draw an area" : "Click to find nearby places"}</span>
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="map-top-right">
              <button className="map-control" type="button" onClick={locateMapPosition} aria-label="Go to current location"><LocateFixed size={17} /></button>
              <button className="map-control" type="button" aria-label="Map layers"><Layers2 size={17} /></button>
            </div>

            {activePhoto && (
              <div className="place-card">
                <button className="place-card-close" type="button" aria-label="Close place card" onClick={() => setActivePhotoId(null)}><X size={15} /></button>
                <div className="place-image-wrap">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activePhoto.imageUrl} alt="" className="place-image" />
                  <span className={`place-category sticker-${categoryColors[activePhoto.category]}`}>
                    {categoryIcons[activePhoto.category]}&nbsp; {activePhoto.category}
                  </span>
                </div>
                <div className="place-card-body">
                  <p className="place-location"><MapPin size={12} /> {activePhoto.locationName || "No location attached"}</p>
                  <h3>{activePhoto.title}</h3>
                  <p className="place-description">{activePhoto.description}</p>
                  <div className="place-card-bottom">
                    <span>{new Date(activePhoto.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {activePhoto.visibility}</span>
                    {activePhoto.userId === userId && (
                      <button className="text-button" type="button" onClick={() => void deletePhoto(activePhoto)}>Remove <ArrowUpRight size={13} /></button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(toolMode === "distance" || toolMode === "area") && (
              <div className="measure-summary">
                <div className="measure-summary-icon"><Ruler size={15} /></div>
                <div><small>{toolMode === "distance" ? "TOTAL DISTANCE" : "AREA ENCLOSED"}</small>
                  <strong>{toolMode === "distance"
                    ? lineMeters < 1000 ? `${lineMeters.toFixed(0)} m` : `${(lineMeters / 1000).toFixed(2)} km`
                    : measurePoints.length > 2
                      ? areaSquareMeters > 1_000_000 ? `${(areaSquareMeters / 1_000_000).toFixed(2)} km²` : `${(areaSquareMeters / 10_000).toFixed(1)} ha`
                      : "Add 3 points"}</strong></div>
                <button type="button" onClick={() => setMeasurePoints([])} aria-label="Clear measurement"><X size={14} /></button>
              </div>
            )}

            <div className="map-bottom-left">
              <div className="coordinate-readout"><span className="coordinate-dot" /> {coordinates ? <>{coordinates.latitude.toFixed(6)}°,&nbsp; {coordinates.longitude.toFixed(6)}° <span className="coordinate-crs">WGS84</span><button className="coordinate-copy-button" type="button" onClick={() => void copyCoordinates()} aria-label="Copy map coordinates"><Copy size={12} />{coordinatesCopied ? "Copied" : "Copy"}</button></> : "Click anywhere on the map to inspect coordinates"}</div>
            </div>
            <div className="map-bottom-right">
              <button className={`map-tool${toolMode === "distance" ? " map-tool-active" : ""}`} type="button" onClick={() => setTool(toolMode === "distance" ? "browse" : "distance")} aria-label="Measure distance"><Ruler size={16} /></button>
              <button className={`map-tool${toolMode === "area" ? " map-tool-active" : ""}`} type="button" onClick={() => setTool(toolMode === "area" ? "browse" : "area")} aria-label="Measure area"><Expand size={16} /></button>
              <span className="map-tool-divider" />
              <button className="map-tool" type="button" onClick={() => changeNearbyRadius(-250)} aria-label="Reduce nearby radius"><Minus size={15} /></button>
              <button className="map-tool" type="button" onClick={() => changeNearbyRadius(250)} aria-label="Increase nearby radius"><Plus size={15} /></button>
            </div>
          </div>

          <div className="map-footer">
            <div className="archive-stats"><span className="stats-icon"><Camera size={15} /></span><strong>{photos.length}</strong> {photos.length === 1 ? "memory" : "memories"} collected <span className="stats-divider">·</span> <span>{photos.filter((photo) => photo.latitude !== null).length} pinned to the map</span></div>
            <div className="map-footer-right"><span><span className="legend-dot" /> YOUR PLACES</span><span className="footer-scale"><i /> 500 m</span></div>
          </div>
        </section>
      </section>

      <section className="memory-strip">
        <div className="strip-heading">
          <div><p className="eyebrow"><Sparkles size={12} /> THE LITTLE THINGS</p><h2>Recently <span>collected.</span></h2></div>
          <button className="pill-button" type="button" onClick={() => { setCategoryFilter("All"); setQuery(""); }}>See all places <ArrowRight size={14} /></button>
        </div>
        <div className="memory-grid">
          {visiblePhotos.slice(0, 4).map((photo, index) => (
            <button className="memory-card" key={photo.id} type="button" onClick={() => {
              setActivePhotoId(photo.id);
              document.querySelector(".map-workspace")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}>
              <div className="memory-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.imageUrl} alt="" />
                <span className={`memory-sticker sticker-${categoryColors[photo.category]}`}>{categoryIcons[photo.category]}</span>
                {index === 0 && <span className="memory-new"><Check size={11} /> JUST ADDED</span>}
              </div>
              <div className="memory-meta"><span>{photo.category.toUpperCase()}</span><span>{new Date(`${photo.createdAt}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></div>
              <h3>{photo.title}</h3>
              <p><MapPin size={12} /> {photo.locationName || "No location"}</p>
            </button>
          ))}
          {visiblePhotos.length === 0 && <div className="empty-state"><Camera size={20} /><strong>No places found just yet.</strong><span>Try another search or add a new memory.</span></div>}
        </div>
      </section>

      <footer className="page-footer"><span>MADE FOR THE PLACES THAT STAY WITH YOU <span className="footer-star">✳</span></span><ContactLinks /><span>GEOARCHIVE&nbsp; © 2026</span></footer>
      <GisToolFab />

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setModalOpen(false);
        }}>
          <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-heading">
            <div className="modal-heading">
              <div><p className="eyebrow"><Camera size={13} /> A NEW MEMORY</p><h2 id="upload-heading">Pin a place.</h2></div>
              <button className="icon-button" type="button" onClick={() => setModalOpen(false)} aria-label="Close upload form"><X size={18} /></button>
            </div>
            <p className="modal-copy">Give this moment a little context. Your location is always optional.</p>
            <form onSubmit={savePhoto}>
              <button className="image-drop" type="button" onClick={() => imageInputRef.current?.click()}>
                <span className="upload-circle"><Upload size={19} /></span>
                <strong>Add a photograph</strong>
                <small>JPG, PNG or WEBP · under 1.5 MB</small>
                <input ref={imageInputRef} name="image" type="file" accept="image/*" onChange={(event) => {
                  const label = event.target.files?.[0]?.name;
                  const target = event.currentTarget.parentElement?.querySelector(".image-drop strong");
                  if (label && target) target.textContent = label;
                }} />
              </button>
              <label className="field-label">{selectedPlaceId ? "PHOTO TITLE OR NOTE" : "WHAT SHOULD WE CALL IT?"}
                <input className="text-input" name="title" placeholder={selectedPlaceId ? "What does this photo show?" : "e.g. The road home"} maxLength={100} required value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} />
              </label>
              <div className="form-row">
                <label className="field-label">A LITTLE NOTE
                  <textarea className="text-input text-area" name="description" placeholder="What caught your eye?" maxLength={500} rows={2} />
                </label>
                <label className="field-label">KIND OF PLACE
                  <select className="text-input select-input" name="category">
                    {categories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
              </div>
              <fieldset className="location-fieldset">
                <legend className="field-label">ADD A LOCATION? <span>Totally your call.</span></legend>
                <div className="location-options">
                  <button className={`location-option${locationMode === "none" ? " location-option-active" : ""}`} type="button" onClick={() => setLocationMode("none")}><span className="location-radio" /> No location</button>
                  <button className={`location-option${locationMode === "current" ? " location-option-active" : ""}`} type="button" onClick={() => { setLocationMode("current"); locateCurrentLocation(); }}><LocateFixed size={14} /> Current location</button>
                  <button className={`location-option${locationMode === "manual" ? " location-option-active" : ""}`} type="button" onClick={() => setLocationMode("manual")}><MapPin size={14} /> Pick on map</button>
                </div>
                {locationMode === "manual" && (
                  <>
                  <label className="field-label">PLACE NAME OR ADDRESS
                    <input className="text-input" name="locationName" maxLength={200} placeholder="Optional place name" value={locationNameDraft} onChange={(event) => setLocationNameDraft(event.target.value)} />
                  </label>
                  <button className="location-hint" type="button" onClick={() => {
                    if (!manualLocation) {
                      setPickingLocation(true);
                      setModalOpen(false);
                    }
                    setTool("browse");
                  }}>
                    {manualLocation ? <><Check size={13} /> {manualLocation.latitude.toFixed(4)}, {manualLocation.longitude.toFixed(4)} selected</> : <>Tap anywhere on the map to drop a pin <ArrowRight size={13} /></>}
                  </button>
                  </>
                )}
                {geolocationError && <p className="form-error">{geolocationError}</p>}
                {locationMode !== "none" && (
                  <div className="form-row privacy-row">
                    <label className="field-label">LOCATION DETAIL
                      <select className="text-input select-input" name="locationPrecision" defaultValue="exact">
                        <option value="exact">Exact coordinates</option>
                        <option value="approximate">Approximate (rounded)</option>
                      </select>
                    </label>
                    <label className="field-label">WHO CAN SEE THIS?
                      <select className="text-input select-input" name="visibility" defaultValue={selectedPlaceId ? "public" : "private"}>
                        <option value="private">Only me</option>
                        <option value="public">Public</option>
                      </select>
                    </label>
                  </div>
                )}
                {locationMode === "none" && (
                  <label className="field-label visibility-only">WHO CAN SEE THIS?
                    <select className="text-input select-input" name="visibility" defaultValue={selectedPlaceId ? "public" : "private"}>
                      <option value="private">Only me</option>
                      <option value="public">Public</option>
                    </select>
                  </label>
                )}
              </fieldset>
              {formError && <p className="form-error">{formError}</p>}
              <div className="modal-actions"><button className="pill-button" type="button" onClick={() => setModalOpen(false)}>Not now</button><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save to my places"} <ArrowRight size={15} /></button></div>
              <p className="storage-note"><Eye size={12} /> Private by default. Public places can be seen by anyone.</p>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
