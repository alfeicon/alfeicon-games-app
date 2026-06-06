import { supabase } from "@/lib/supabase/client";

export type CatalogGame = {
  id: string;
  titulo: string;
  img: string | null;
  precio: number;
  precioOriginal: number | null;
  esPack: false;
  ahorro: string | null;
};

export type CatalogPack = {
  id: string;
  titulo: string;
  img: string | null;
  precio: number;
  esPack: true;
  ahorro: string | null;
  juegosIncluidos: string[];
  esNuevo: boolean;
};

export type CatalogData = {
  productos: CatalogGame[];
  packs: CatalogPack[];
};

type GameRow = {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  is_offer: boolean;
  offer_price: number | null;
};

type PackRow = {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  is_new: boolean;
  pack_items: { title: string; sort_order: number }[] | null;
};

export async function fetchCatalogFromSupabase(): Promise<CatalogData | null> {
  if (!supabase) return null;

  const [gamesResult, packsResult] = await Promise.all([
    supabase
      .from("games")
      .select("id,title,price,image_url,is_offer,offer_price")
      .eq("is_active", true)
      .order("title", { ascending: true }),
    supabase
      .from("packs")
      .select("id,title,price,image_url,is_new,pack_items(title,sort_order)")
      .eq("is_active", true)
      .order("is_new", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (gamesResult.error || packsResult.error) {
    console.error("Error Supabase catalog:", gamesResult.error || packsResult.error);
    return null;
  }

  const productos = ((gamesResult.data || []) as GameRow[]).map((game) => {
    const precioOferta = game.is_offer && game.offer_price ? game.offer_price : null;

    return {
      id: game.id,
      titulo: game.title,
      img: game.image_url,
      precio: precioOferta || game.price,
      precioOriginal: precioOferta ? game.price : null,
      esPack: false as const,
      ahorro: precioOferta ? "OFERTA 🔥" : null,
    };
  });

  const packs = ((packsResult.data || []) as PackRow[]).map((pack) => {
    const juegosIncluidos = [...(pack.pack_items || [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => item.title);

    return {
      id: pack.id,
      titulo: pack.title,
      img: pack.image_url,
      precio: pack.price,
      esPack: true as const,
      ahorro: pack.is_new ? "¡NUEVO! 🚀" : null,
      juegosIncluidos,
      esNuevo: pack.is_new,
    };
  });

  return { productos, packs };
}
