import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import type { Database } from "@/types/database";

export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot write cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
}
