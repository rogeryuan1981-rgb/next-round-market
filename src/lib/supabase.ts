import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);

if (!isSupabaseConfigured) {
  throw new Error(
    "缺少 Supabase 設定，請檢查 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY。"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);
