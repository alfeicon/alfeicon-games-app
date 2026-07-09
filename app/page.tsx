// app/page.tsx — Server Component
// Trae catálogo, noticias y settings en el servidor y los sirve cacheados.
// El HTML llega con los datos ya listos: sin cascada de fetch en el navegador
// y una sola consulta a Supabase cada ~5 min (Data Cache), no una por visita.
import MobileAppStore from './StoreApp';
import { getCachedCatalog, getCachedNews, getCachedSettings } from '@/lib/cached-data';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';

// Regenera el HTML de la página como máximo cada 5 minutos (ISR).
export const revalidate = 300;

export default async function Page() {
  const [catalog, news, settings] = await Promise.all([
    getCachedCatalog(),
    getCachedNews(),
    getCachedSettings(),
  ]);

  return (
    <MobileAppStore
      initial={{
        productos: catalog?.productos ?? [],
        packs: catalog?.packs ?? [],
        news: news ?? [],
        settings: settings ?? DEFAULT_APP_SETTINGS,
      }}
    />
  );
}
