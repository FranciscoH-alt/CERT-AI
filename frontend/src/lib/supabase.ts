/**
 * Supabase client configuration.
 * Uses the anon key for client-side auth operations.
 * Lazy-initialized to avoid errors during SSR/build when env vars aren't set.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !key) {
        // During build/SSR without env vars — return a no-op to prevent crashes
        if (typeof window === "undefined") {
          return () => ({ data: null, error: null });
        }
        throw new Error("Supabase URL and anon key are required");
      }
      _client = createClient(url, key);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_client as any)[prop as string];
  },
});
