import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Registra una visita de la tienda. Va por el servidor y no por el navegador
// para poder descartar bots y leer el país desde las cabeceras de Vercel, sin
// guardar nada que identifique a la persona (ni IP, ni cookie, ni user-agent).

// Los crawlers inflan el contador sin ser clientes. No es una lista perfecta
// —ninguna lo es— pero saca a los sospechosos habituales.
const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|lighthouse|headless|monitor|curl|wget|python-requests|axios/i;

// Reduce el referrer a un origen legible. Se guarda solo el nombre de la red,
// nunca la URL completa: no necesitamos saber de qué publicación vino.
function sourceFrom(ref: unknown, utm: string | null): string {
  if (utm) return utm.toLowerCase().slice(0, 40);
  if (typeof ref !== "string" || !ref) return "directo";
  let host = "";
  try {
    host = new URL(ref).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "directo";
  }
  if (host.includes("instagram")) return "instagram";
  if (host.includes("facebook") || host.includes("fb.")) return "facebook";
  if (host.includes("whatsapp") || host === "l.wl.co") return "whatsapp";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("google")) return "google";
  if (host.includes("t.co") || host.includes("twitter") || host === "x.com") return "twitter";
  if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
  if (host.includes("t.me") || host.includes("telegram")) return "telegram";
  return host.slice(0, 40);
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    // 200 igual: al cliente no le importa, y así no reintenta.
    if (BOT.test(ua)) return NextResponse.json({ status: "bot" });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({ status: "no configurado" });

    const { path, item_id, item_type, ref, utm } = await req.json().catch(() => ({} as any));
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "path requerido" }, { status: 400 });
    }

    const supabase = createClient(url, key);
    const { error } = await supabase.from("page_views").insert({
      // Se recorta por si llega una ruta larguísima con parámetros.
      path: path.slice(0, 200),
      item_id: item_id || null,
      item_type: item_type === "game" || item_type === "pack" ? item_type : null,
      country: req.headers.get("x-vercel-ip-country") || null,
      source: sourceFrom(ref, typeof utm === "string" ? utm : null),
    });

    if (error) {
      // Falta correr page-views.sql: se registra y se sigue. Una analítica
      // caída no puede romper la tienda.
      console.warn("[track-view]", error.message);
      return NextResponse.json({ status: "no registrado" });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[track-view] Error interno:", error);
    return NextResponse.json({ status: "error" });
  }
}
