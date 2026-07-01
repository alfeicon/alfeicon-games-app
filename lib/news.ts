import { supabase } from "@/lib/supabase/client";

export type NewsItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
};

export async function fetchNewsFromSupabase(): Promise<NewsItem[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("news")
    .select("id,title,description,image_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error Supabase news:", error);
    return [];
  }

  return (data || []) as NewsItem[];
}
