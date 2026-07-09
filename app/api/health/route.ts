// app/api/health/route.ts
// Chequeo de salud de la base de datos. Lo llama el cron de Vercel cada 5 min
// (ver vercel.json). Hace una consulta mínima a Supabase; si falla, te avisa
// por Telegram (reutiliza el mismo bot). Incluye anti-spam (cooldown) y aviso
// de recuperación cuando la base vuelve a responder.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Nunca cachear: cada llamada debe consultar la base en vivo.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Estado en memoria para no enviar un correo en cada chequeo mientras la base
// sigue caída. Es "best-effort": vive mientras la instancia esté caliente
// (con Vercel Fluid Compute suele mantenerse entre ejecuciones del cron). Para
// deduplicación 100% garantizada se podría mover a Upstash Redis / Edge Config.
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // máx. 1 correo cada 30 min por incidente
const alertState = { downSince: 0, lastAlertTs: 0 };

async function checkDatabase(): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, error: "Faltan variables NEXT_PUBLIC_SUPABASE_*" };

  const client = createClient(url, key, { auth: { persistSession: false } });

  try {
    // Consulta mínima y barata contra una tabla de lectura pública.
    const { error } = await client.from("app_settings").select("key").limit(1);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID; // tu ADMIN_TELEGRAM_ID

  if (!token || !chatId) {
    console.warn("[health] TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados; no se avisa.");
    return;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  if (!res.ok) {
    console.error("[health] Error enviando aviso Telegram:", res.status, await res.text());
  }
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Si no defines CRON_SECRET, el endpoint queda abierto (menos seguro). Se
  // recomienda definirlo: Vercel Cron manda automáticamente el header
  // Authorization: Bearer <CRON_SECRET>. También aceptamos ?secret= para
  // pingers externos (UptimeRobot, cron-job.org).
  if (!secret) return true;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Modo prueba: ?test=1 envía un aviso de Telegram al instante para verificar
  // que el token y el chat_id están bien configurados.
  if (new URL(request.url).searchParams.get("test") === "1") {
    await sendTelegram(
      `🔔 <b>Prueba de avisos Alfeicon</b>\n\n` +
      `Si ves este mensaje, los avisos de salud de la base de datos funcionan.\n\n` +
      `<i>${new Date().toLocaleString("es-CL")}</i>`,
    );
    return NextResponse.json({ status: "test-sent" });
  }

  const result = await checkDatabase();
  const now = Date.now();

  if (result.ok) {
    // ¿Se estaba recuperando de una caída? Avisar que volvió.
    if (alertState.downSince !== 0) {
      const downMin = Math.round((now - alertState.downSince) / 60000);
      await sendTelegram(
        `✅ <b>Alfeicon: la base de datos se recuperó</b>\n\n` +
        `Ya vuelve a responder correctamente.\n` +
        `Estuvo con problemas ~<b>${downMin} min</b>.\n\n` +
        `<i>Aviso automático · ${new Date().toLocaleString("es-CL")}</i>`,
      );
      alertState.downSince = 0;
      alertState.lastAlertTs = 0;
    }
    return NextResponse.json({ status: "ok" });
  }

  // La base está fallando.
  if (alertState.downSince === 0) alertState.downSince = now;

  if (now - alertState.lastAlertTs > ALERT_COOLDOWN_MS) {
    alertState.lastAlertTs = now;
    await sendTelegram(
      `⚠️ <b>Alfeicon: la base de datos NO responde</b>\n\n` +
      `El chequeo automático detectó una falla.\n\n` +
      `<b>Error:</b> <code>${result.error ?? "desconocido"}</code>\n\n` +
      `Revisa https://status.supabase.com y tu proyecto en https://supabase.com/dashboard\n\n` +
      `<i>Aviso automático · ${new Date().toLocaleString("es-CL")}\n` +
      `No repetiré este aviso durante los próximos 30 min.</i>`,
    );
  }

  return NextResponse.json({ status: "error", error: result.error }, { status: 503 });
}
