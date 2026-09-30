"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

export function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  browserClient ??= createBrowserClient<Database>(config.url, config.key);
  return browserClient;
}
