import StoreAppClient from './StoreAppClient';
import { getCachedCatalog, getCachedNews, getCachedSettings } from '@/lib/cached-data';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';

export const revalidate = 300;

export default async function Page() {
  const [catalog, news, settings] = await Promise.all([
    getCachedCatalog(),
    getCachedNews(),
    getCachedSettings(),
  ]);

  return (
    <StoreAppClient
      initial={{
        productos: catalog?.productos ?? [],
        packs: catalog?.packs ?? [],
        news: news ?? [],
        settings: settings ?? DEFAULT_APP_SETTINGS,
      }}
    />
  );
}
