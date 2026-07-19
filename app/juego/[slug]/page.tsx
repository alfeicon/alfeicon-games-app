// app/juego/[slug]/page.tsx — Server Component
// Link compartible por juego: /juego/<slug>. Genera el preview de Open Graph
// (título + imagen del juego) para que WhatsApp/Instagram/Telegram muestren una
// tarjeta rica, y abre la ficha del juego automáticamente al cargar la tienda.
import type { Metadata } from 'next';
import MobileAppStore from '../../StoreApp';
import { getCachedCatalog, getCachedNews, getCachedSettings } from '@/lib/cached-data';
import { DEFAULT_APP_SETTINGS } from '@/lib/settings';
import { findCatalogItemBySlug, type CatalogItem } from '@/lib/catalog';

// Regenera el HTML como máximo cada 5 minutos (ISR), igual que la home.
export const revalidate = 300;

async function findItemBySlug(slug: string): Promise<CatalogItem | null> {
  const catalog = await getCachedCatalog();
  const all: CatalogItem[] = [...(catalog?.productos ?? []), ...(catalog?.packs ?? [])];
  return findCatalogItemBySlug(all, slug);
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const item = await findItemBySlug(slug);
  if (!item) return {};

  const title = item.titulo;
  const description = item.esPack
    ? `Pack de ${item.juegosIncluidos.length} juegos disponible en Alfeicon Games.`
    : 'Juego digital para Nintendo Switch disponible en Alfeicon Games.';
  const images = item.img ? [{ url: item.img, alt: item.titulo }] : undefined;

  return {
    title,
    description,
    openGraph: { title, description, images, type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: item.img ? [item.img] : undefined },
  };
}

export default async function JuegoPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
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
      openSlug={slug}
    />
  );
}
