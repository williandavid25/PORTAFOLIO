"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from "./public";

let client: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient | null {
  const url = PUBLIC_SUPABASE_URL;
  const key = PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  client ??= createBrowserClient(url, key);
  return client;
}
