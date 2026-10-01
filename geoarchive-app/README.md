# GeoArchive

A geospatial photo journal built with Next.js, TypeScript, Leaflet, and Supabase. Its visual language follows the Slush sticker-book reference: pastel paper, bold outlines, rounded controls, and colorful accents, with a persistent light/dark theme switch.

## Run locally

Requirements: Node.js 20.9 or newer.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `.env.local` to the Supabase project URL, a publishable (or legacy anon) key, and the local site URL:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Username-only account creation uses Supabase Admin Auth on the server. Add the service-role/secret key from Project Settings → API Keys as `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. This key is server-only: never prefix it with `NEXT_PUBLIC_`, expose it to browser code, or commit it to source control.

## Supabase setup

1. Create or resume a Supabase project.
2. In the project SQL Editor, run [`supabase/migrations/20260930000000_initial_schema.sql`](./supabase/migrations/20260930000000_initial_schema.sql). It creates profile/photo tables, row-level security, the private `photos` bucket, storage policies, and the authenticated nearby-search RPC.
3. Also run [`supabase/migrations/20260930100000_public_place_reviews.sql`](./supabase/migrations/20260930100000_public_place_reviews.sql) to enable public reading of reviews and authenticated review creation, editing, and deletion.
4. For a project that already has places and contributions, run [`supabase/migrations/20261001100000_multi_user_places.sql`](./supabase/migrations/20261001100000_multi_user_places.sql) after the initial and reviews migrations.
5. Run [`supabase/migrations/20261001120000_username_optional_email_auth.sql`](./supabase/migrations/20261001120000_username_optional_email_auth.sql) after the multi-user places migration. It assigns case-insensitive unique usernames to existing profiles and creates private optional-contact-email storage.
6. Copy the project URL, publishable key, and service-role key from Project Settings → API Keys into `.env.local`. The service-role key must remain server-only.
7. In Authentication → URL Configuration, set the site URL to `http://localhost:3000`. New username accounts are created as confirmed Supabase Auth users without email delivery; existing email/password accounts remain available by email.
8. Restart `npm run dev` after changing `.env.local`.

## Current features

- Username/password registration and login with optional private contact email; existing email/password accounts can continue signing in with email.
- Private account settings with username and actual contribution counts. Contact email is optional and is not used for password recovery; username-only accounts cannot reset forgotten passwords.
- Server-validated auth session and automatic Supabase cookie refresh.
- Private photo records, private Storage objects, and per-owner row-level security.
- Public/private visibility and exact/rounded/no-location choices.
- Public Explore guide for contributor-shared photos and notes, with map, search, category filters, and an experience-is-not-a-guarantee disclaimer. Browsing does not require an account.
- Guest visitors land on Explore; a signed-in account is required to open the private journal and add places.
- Anyone can read reviews on public places; posting, editing, or deleting a review requires signing in. Each account can keep one text review per place.
- Interactive Esri World Street Map with English place labels, photo markers, search, category filters, and signed image URLs.
- Maps start centered on Africa. A person’s device location is only requested after they choose the location button or the current-location option when adding a place; it is never collected automatically.
- Click any map to drop a temporary coordinate pin and read/copy its WGS 84 coordinates. Coordinates are not saved unless separately used while adding a place.
- Search for worldwide places, addresses, landmarks, or latitude/longitude independently of the GeoArchive archive. OpenStreetMap Nominatim results are temporary; matching archived places are shown separately, and external places can be sent to the existing add-place workflow. Search is explicit-submit and rate-limited; attribution is displayed.
- The GIS Coordinate Tool is available without an account on its own `/gis` page, linked by the labeled compass button from both the public Explore page and signed-in journal. It recognizes labeled latitude/longitude, Easting/Northing, X/Y, and bulk point rows. It supports WGS 84 and UTM zones 31N/32N, requires a CRS for projected values, previews interpretations before plotting, and calculates line/boundary lengths and areas.
- Places are distinct from user contributions. The `places` table stores stable place information; each user's `contributions` record links their photos and place review to that shared place. Apply `supabase/migrations/20261001100000_multi_user_places.sql` after the existing migrations to add the shared-place schema, migrate existing photos/reviews without name-based merging, and update the RLS policies.
- Upload to Supabase Storage followed by a metadata insert, with rollback cleanup on failure.
- Delete owned records and their stored images.
- WGS84 coordinate display, distance/area tools, and an RLS-aware `nearby_photos` database function.
- Light/dark theme preference saved in this browser.
- Footer profile links to [GitHub](https://github.com/buck0001) and [X](https://x.com/zkbuck_).

## Privacy and security notes

The photos bucket is private. Signed image URLs expire after one hour. Private photo rows and objects are restricted to their owner by RLS/storage policies; public rows and their images can be read without an account. Explore displays only public photo rows. Approximate coordinates are rounded to three decimal places before storage. Community notes describe personal experiences and are not guarantees about current conditions. The app's service-role key is used only in server actions for user creation and username-to-auth identity lookup; never share it, put it in a `NEXT_PUBLIC_` variable, or commit it. Browser code uses only the publishable/anon key, with RLS as the authorization boundary.

## Checks

```powershell
npm run lint
npm run build
```
