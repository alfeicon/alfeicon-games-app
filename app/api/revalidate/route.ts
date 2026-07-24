import { createClient } from "@supabase/supabase-js";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Invalida el caché de la tienda para que un cambio del panel se vea al
// instante en vez de esperar los 5 minutos del ISR.
//
// Hay DOS cachés encima de los datos públicos y hay que tocar los dos:
//   1. El Data Cache de `unstable_cache` (lib/cached-data.ts), con los tags
//      "catalog" / "news" / "settings".
//   2. El HTML ya generado de las rutas que los consumen (`export const
//      revalidate = 300` en / y /juego/[slug]).
// Invalidar solo el primero deja servido el HTML viejo hasta que expire.

const TAGS_VALIDOS = ["catalog", "news", "settings"] as const;
type Tag = (typeof TAGS_VALIDOS)[number];

// Rutas que renderizan catálogo, noticias o settings en el servidor.
const RUTAS = ["/", "/juego/[slug]"];

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 });
  }

  // Solo con una sesión válida del panel. El token viaja en el header y se
  // verifica contra Supabase: no sirve inventárselo. Sin esto, cualquiera
  // podría vaciar el caché a repetición y dejarnos consultando Supabase en
  // cada visita.
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const pedidos: unknown = body?.tags;
  const tags: Tag[] = Array.isArray(pedidos)
    ? TAGS_VALIDOS.filter(t => pedidos.includes(t))
    : [...TAGS_VALIDOS];
  // Una lista vacía o con basura invalida todo: es preferible refrescar de más
  // que dejar la tienda mostrando un precio viejo.
  const aplicar = tags.length > 0 ? tags : [...TAGS_VALIDOS];

  // El segundo argumento es obligatorio desde Next 16: "max" reproduce el
  // comportamiento clásico de purgar la entrada completa. (`updateTag`, la otra
  // opción, solo funciona dentro de un Server Action, no en un route handler.)
  aplicar.forEach(tag => revalidateTag(tag, "max"));
  RUTAS.forEach(ruta => revalidatePath(ruta, "page"));

  return NextResponse.json({ ok: true, tags: aplicar });
}
