import { NextRequest, NextResponse } from "next/server";
import { getGamesAmerica } from "nintendo-switch-eshop";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const normalizeTitle = (title: string) => {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[™®©]/gi, "") // quita símbolos de marca registrada
    .replace(/[-:]/g, " ") // reemplaza guiones y dos puntos por espacios
    .replace(/[^\w\s]/g, "") // quita otros caracteres especiales
    .replace(/\s+/g, " ") // colapsa espacios
    .trim();
};

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  const imgUrl = req.nextUrl.searchParams.get("img");
  
  if (!query) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  try {
    const queryNormalized = normalizeTitle(query);
    const cacheKey = imgUrl ? (imgUrl.match(/\/games\/switch\/[^/]+\/([^/]+)/)?.[1] || queryNormalized) : queryNormalized;

    // 1. Verificar caché
    const { data: cached } = await supabase
      .from('eshop_cache')
      .select('*')
      .eq('query_key', cacheKey)
      .single();

    if (cached) {
      const ageHours = (new Date().getTime() - new Date(cached.created_at).getTime()) / (1000 * 60 * 60);
      if (ageHours < 24) {
        return NextResponse.json({
          title: cached.title,
          priceUSD: 0,
          priceCLP_exact: cached.price_clp
        });
      }
    }

    const games = await getGamesAmerica();
    
    let matches: any[] = [];
    
    // 1. Intentar hacer match perfecto usando el slug extraído de la URL de la imagen
    let imgSlug = "";
    if (imgUrl) {
      const match = imgUrl.match(/\/games\/switch\/[^/]+\/([^/]+)/);
      if (match && match[1]) {
        imgSlug = match[1];
        matches = games.filter(g => {
          const gameSlug = g.slug || (g.url ? g.url.split('/').filter(Boolean).pop() : "");
          return gameSlug === imgSlug;
        });
      }
    }
    
    // 2. Si no hay imagen, no tiene slug válido o no encontró match, buscamos por texto
    if (matches.length === 0) {
      const queryNormalized = normalizeTitle(query);
      const searchTerms = queryNormalized.split(' ').filter(Boolean);
      
      matches = games.filter(g => {
        const title = normalizeTitle(g.title);
        return searchTerms.every(term => title.includes(term));
      });
    }

    // 3. Fallback absoluto: Si no encontró nada en Algolia pero tenemos el slug, intentar scrapear directo
    if (matches.length === 0 && imgSlug) {
      try {
        const clRes = await fetch(`https://www.nintendo.com/es-cl/store/products/${imgSlug}/`);
        if (clRes.ok) {
          const clText = await clRes.text();
          const priceMatch = clText.match(/v_price=([0-9.]+)/);
          const titleMatch = clText.match(/<title[^>]*>([^<]+)<\/title>/);
          let chilePrice = 0;
          if (priceMatch) {
            chilePrice = Math.round(parseFloat(priceMatch[1]));
          }
          if (chilePrice > 0) {
             let title = query;
             if (titleMatch) {
               title = titleMatch[1].split(' para Nintendo Switch')[0].split(' - ')[0];
             }
             return NextResponse.json({
               title,
               priceUSD: 0,
               priceCLP_exact: chilePrice
             });
          }
        }
      } catch (e) {
        console.error("Direct fallback slug fetch failed", e);
      }
    }

    if (matches.length === 0) {
      return NextResponse.json({ error: "No game found" }, { status: 404 });
    }
    
    // Sort by shortest title (usually the base game and not a DLC/Bundle)
    matches.sort((a, b) => a.title.length - b.title.length);
    const bestMatch = matches[0];

    // Intentar buscar el precio exacto en la tienda chilena usando el slug
    let chilePrice = 0;
    try {
      const slug = bestMatch.slug || (bestMatch.url ? bestMatch.url.split('/').filter(Boolean).pop() : null);
      if (slug) {
        const clRes = await fetch(`https://www.nintendo.com/es-cl/store/products/${slug}/`);
        const clText = await clRes.text();
        const priceMatch = clText.match(/v_price=([0-9.]+)/);
        if (priceMatch) {
          chilePrice = Math.round(parseFloat(priceMatch[1]));
        }
      }
    } catch (e) {
      console.error("No se pudo scrapear el precio de Chile", e);
    }

    // Guardar en caché antes de retornar
    if (chilePrice > 0) {
      await supabase.from('eshop_cache').upsert({
        query_key: cacheKey,
        title: bestMatch.title,
        price_clp: chilePrice,
        created_at: new Date().toISOString()
      }, { onConflict: 'query_key' });
    }

    return NextResponse.json({ 
      title: bestMatch.title,
      priceUSD: bestMatch.msrp || 0,
      priceCLP_exact: chilePrice
    });
    
  } catch (err: any) {
    console.error("Error fetching eshop price:", err);
    return NextResponse.json({ error: "Failed to fetch from eShop" }, { status: 500 });
  }
}
