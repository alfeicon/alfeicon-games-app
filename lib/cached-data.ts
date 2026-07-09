// lib/cached-data.ts
// Lecturas públicas cacheadas en el servidor (Data Cache de Next).
// El resultado se reutiliza entre visitas durante `revalidate` segundos, así
// Supabase se consulta ~1 vez cada 5 min en lugar de una vez por visita.
// Cada wrapper lleva un tag para poder invalidarlo con revalidateTag(...)
// desde el panel admin cuando cambien datos (ver nota al final).
import { unstable_cache } from "next/cache";
import { fetchCatalogFromSupabase } from "./catalog";
import { fetchNewsFromSupabase } from "./news";
import { fetchAppSettings } from "./settings";

const REVALIDATE_SECONDS = 300;

export const getCachedCatalog = unstable_cache(
  async () => fetchCatalogFromSupabase(),
  ["public-catalog"],
  { revalidate: REVALIDATE_SECONDS, tags: ["catalog"] },
);

export const getCachedNews = unstable_cache(
  async () => fetchNewsFromSupabase(),
  ["public-news"],
  { revalidate: REVALIDATE_SECONDS, tags: ["news"] },
);

export const getCachedSettings = unstable_cache(
  async () => fetchAppSettings(),
  ["public-settings"],
  { revalidate: REVALIDATE_SECONDS, tags: ["settings"] },
);

// Para refrescar al instante tras editar en el admin, llama en un Server Action
// o Route Handler:  revalidateTag("catalog") / "news" / "settings".
