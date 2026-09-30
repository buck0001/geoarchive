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

The publishable/anon key is intended for browser use. Never put a Supabase secret or service-role key in a `NEXT_PUBLIC_` variable or commit it to source control.

## Supabase setup

1. Create or resume a Supabase project.
2. In the project SQL Editor, run [`supabase/migrations/20260930000000_initial_schema.sql`](./supabase/migrations/20260930000000_initial_schema.sql). It creates profile/photo tables, row-level security, the private `photos` bucket, storage policies, and the authenticated nearby-search RPC.
3. Also run [`supabase/migrations/20260930100000_public_place_reviews.sql`](./supabase/migrations/20260930100000_public_place_reviews.sql) to enable public reading of reviews and authenticated review creation, editing, and deletion.
4. Copy the project URL and publishable key from Project Settings → API Keys into `.env.local`.
5. In Authentication → URL Configuration, set the site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL. Add the production origin and callback before deploying.
6. Set the Supabase email provider confirmation flow as desired. New accounts use email/password, create a profile automatically, and return through `/auth/callback`.
7. Restart `npm run dev` after changing `.env.local`.

## Current features

- Email/password sign-up and sign-in, email confirmation callback, and sign-out.
- Server-validated auth session and automatic Supabase cookie refresh.
- Private photo records, private Storage objects, and per-owner row-level security.
- Public/private visibility and exact/rounded/no-location choices.
- Public Explore guide for contributor-shared photos and notes, with map, search, category filters, and an experience-is-not-a-guarantee disclaimer. Browsing does not require an account.
- Guest visitors land on Explore; a signed-in account is required to open the private journal and add places.
- Anyone can read reviews on public places; posting, editing, or deleting a review requires signing in. Each account can keep one text review per place.
- Interactive Esri World Street Map with English place labels, photo markers, search, category filters, and signed image URLs.
- Maps start centered on Africa. A person’s device location is only requested after they choose the location button or the current-location option when adding a place; it is never collected automatically.
- Upload to Supabase Storage followed by a metadata insert, with rollback cleanup on failure.
- Delete owned records and their stored images.
- WGS84 coordinate display, distance/area tools, and an RLS-aware `nearby_photos` database function.
- Light/dark theme preference saved in this browser.
- Footer profile links to [GitHub](https://github.com/buck0001) and [X](https://x.com/zkbuck_).

## Privacy and security notes

The photos bucket is private. Signed image URLs expire after one hour. Private photo rows and objects are restricted to their owner by RLS/storage policies; public rows and their images can be read without an account. Explore displays only public photo rows. Approximate coordinates are rounded to three decimal places before storage. Community notes describe personal experiences and are not guarantees about current conditions. Never share a service-role key; browser code uses only the publishable/anon key, with RLS as the authorization boundary.

## Checks

```powershell
npm run lint
npm run build
```
