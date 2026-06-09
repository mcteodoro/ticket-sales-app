import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseKey, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/types";

export function createClient() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseKey();

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
