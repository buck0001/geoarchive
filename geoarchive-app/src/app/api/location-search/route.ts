import { NextRequest, NextResponse } from "next/server";
import type { NominatimResult } from "@/types/location-search";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 1100;
const resultCache = new Map<string, { expiresAt: number; results: NominatimResult[] }>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

async function searchNominatim(query: string): Promise<NominatimResult[]> {
  const cached = resultCache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const previousRequest = requestQueue;
  let releaseRequest!: () => void;
  requestQueue = new Promise<void>((resolve) => { releaseRequest = resolve; });
  await previousRequest;

  try {
    const cachedAfterQueue = resultCache.get(query);
    if (cachedAfterQueue && cachedAfterQueue.expiresAt > Date.now()) return cachedAfterQueue.results;

    const remaining = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
    lastRequestAt = Date.now();

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "6",
      "accept-language": "en",
    }).toString();
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "GeoArchive/0.1 (https://github.com/buck0001)",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Place search provider returned HTTP ${response.status}. Try again shortly.`);
    const results = await response.json() as NominatimResult[];
    for (const [key, entry] of resultCache) {
      if (entry.expiresAt <= Date.now()) resultCache.delete(key);
    }
    if (resultCache.size >= 250) {
      const oldest = resultCache.keys().next().value;
      if (oldest !== undefined) resultCache.delete(oldest);
    }
    resultCache.set(query, { expiresAt: Date.now() + CACHE_TTL_MS, results });
    return results;
  } finally {
    releaseRequest();
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length > 200) {
    return NextResponse.json({ error: "Enter a search phrase up to 200 characters." }, { status: 400 });
  }

  try {
    return NextResponse.json({ results: await searchNominatim(query) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Place search is temporarily unavailable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
