// app/api/health/route.ts
// Chequeo de salud de la base de datos.
// Diseñado para entornos Serverless (Vercel):
// 1. Ping ultraligero con reintentos para no generar falsas alarmas por micro-latencias.
// 2. Cooldown real de 30 min deduplicado vía mensaje anclado en Telegram (sin perder estado entre lambdas).
// 3. Tareas secundarias (limpieza de borradores y garantías) aisladas para no falsear el estado de salud.

import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ALERT_COOLDOWN_SEC = 30 * 60; // 30 minutos
const alertStateInMemory = { downSince: 0, lastAlertTs: 0 };

function formatLocalDate(): string {
  return new Date().toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    dateStyle: "short",
    timeStyle: "medium",
  });
}

interface PinnedAlert {
  messageId: number;
  date: number; // Unix seconds
  text: string;
}

// Consulta el mensaje anclado en el chat para saber si ya hay una alerta activa
async function getPinnedAlert(token: string, chatId: string): Promise<PinnedAlert | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pinned = data?.result?.pinned_message;
    if (
      pinned &&
      typeof pinned.text === "string" &&
      pinned.text.includes("Alfeicon: la base de datos NO responde")
    ) {
      return {
        messageId: pinned.message_id,
        date: pinned.date,
        text: pinned.text,
      };
    }
  } catch (e) {
    console.warn("[health] Error al consultar estado en Telegram:", e);
  }
  return null;
}

async function sendTelegram(
  token: string,
  chatId: string,
  text: string,
  pin: boolean = false
): Promise<number | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });

    if (!res.ok) {
      console.error("[health] Error enviando aviso Telegram:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const messageId = data?.result?.message_id;

    if (pin && messageId) {
      await fetch(`https://api.telegram.org/bot${token}/pinChatMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          disable_notification: true,
        }),
      }).catch((e) => console.warn("[health] No se pudo anclar mensaje:", e));
    }

    return messageId ?? null;
  } catch (e) {
    console.error("[health] Fallo de conexión con Telegram:", e);
    return null;
  }
}

async function clearPinnedAlert(token: string, chatId: string, messageId?: number): Promise<void> {
  try {
    if (messageId) {
      await fetch(`https://api.telegram.org/bot${token}/unpinChatMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
      });
    } else {
      await fetch(`https://api.telegram.org/bot${token}/unpinAllChatMessages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      });
    }
  } catch (e) {
    console.warn("[health] No se pudo desanclar el mensaje:", e);
  }
}

// Ping con reintentos progresivos (hasta 4 intentos con backoff de hasta 25s) para filtrar micro-mantenimientos transitorios
async function pingDatabase(client: SupabaseClient): Promise<{ ok: boolean; error?: string }> {
  const maxAttempts = 4;
  const backoffs = [3000, 6000, 8000]; // pausas progresivas en ms
  const startTime = Date.now();
  const MAX_TOTAL_BUDGET_MS = 25000; // Máximo 25s en total para no chocar con timeouts de monitores HTTP (30s)

  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_TOTAL_BUDGET_MS - 4000 && attempt > 1) {
      break;
    }

    const timeoutMs = Math.min(8000, Math.max(4000, MAX_TOTAL_BUDGET_MS - elapsed - 2000));

    try {
      const { error } = await client
        .from("app_settings")
        .select("key")
        .limit(1)
        .abortSignal(AbortSignal.timeout(timeoutMs));

      if (!error) {
        return { ok: true };
      }
      lastError = error.message;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }

    if (attempt < maxAttempts) {
      const delay = backoffs[attempt - 1] ?? 5000;
      if (Date.now() - startTime + delay < MAX_TOTAL_BUDGET_MS) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return { ok: false, error: lastError || "Tiempo de espera agotado (Timeout)" };
}

// Tareas secundarias de mantenimiento: no deben bloquear ni tirar abajo la salud del sitio
async function runMaintenanceTasks(client: SupabaseClient): Promise<void> {
  try {
    // 1. Limpieza de borradores abandonados
    const limitDate = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await client
      .from("orders")
      .delete()
      .eq("status", "draft")
      .is("payment_method", null)
      .lt("created_at", limitDate)
      .abortSignal(AbortSignal.timeout(8000));
  } catch (err) {
    console.warn("[health] Limpieza de órdenes borrador omitida:", err);
  }

  try {
    // 2. Vencer garantías
    const { data: vencidas, error: errVencer } = await client
      .rpc("vencer_garantias")
      .abortSignal(AbortSignal.timeout(8000));
    if (errVencer) console.warn("[health] RPC vencer_garantias no pudo completar:", errVencer.message);
    else if (vencidas) console.log(`[health] garantías vencidas: ${vencidas} cuenta(s) liberada(s)`);
  } catch (err) {
    console.warn("[health] Fallo en vencer_garantias:", err);
  }
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
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

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Modo prueba: ?test=1
  if (new URL(request.url).searchParams.get("test") === "1") {
    if (token && chatId) {
      await sendTelegram(
        token,
        chatId,
        `🔔 <b>Prueba de avisos Alfeicon</b>\n\n` +
        `Si ves este mensaje, los avisos de salud de la base de datos funcionan correctamente.\n\n` +
        `<i>${formatLocalDate()}</i>`
      );
    }
    return NextResponse.json({ status: "test-sent" });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ status: "error", error: "Faltan variables NEXT_PUBLIC_SUPABASE_*" }, { status: 500 });
  }

  const client = createClient(url, key, { auth: { persistSession: false } });

  // 1. Chequeo de salud prioritario con reintentos progresivos
  const health = await pingDatabase(client);
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  if (health.ok) {
    // Si la base está sana, verificamos si veníamos de una caída
    if (token && chatId) {
      const activeAlert = await getPinnedAlert(token, chatId);

      // Solo avisamos de recuperación si efectivamente había una alerta anclada visible
      if (activeAlert) {
        const startSec = activeAlert.date;
        const downMin = Math.max(1, Math.round((nowSec - startSec) / 60));

        await sendTelegram(
          token,
          chatId,
          `✅ <b>Alfeicon: la base de datos se recuperó</b>\n\n` +
          `Ya vuelve a responder correctamente.\n` +
          `Estuvo con problemas ~<b>${downMin} min</b>.\n\n` +
          `<i>Aviso automático · ${formatLocalDate()}</i>`
        );

        // Desanclar para que ninguna otra lambda repita el mensaje de recuperación
        await clearPinnedAlert(token, chatId, activeAlert.messageId);
        alertStateInMemory.downSince = 0;
        alertStateInMemory.lastAlertTs = 0;
      }
    }

    // 2. Ejecutar tareas secundarias de mantenimiento sin bloquear el resultado de salud
    await runMaintenanceTasks(client);

    return NextResponse.json({ status: "ok" });
  }

  // ── La base falló todos los intentos progresivos ──
  console.error("[health] Base de datos no responde tras reintentos progresivos:", health.error);

  if (alertStateInMemory.downSince === 0) {
    alertStateInMemory.downSince = now;
  }

  if (token && chatId) {
    const activeAlert = await getPinnedAlert(token, chatId);

    // Si ya existe una alerta activa y no han pasado 30 minutos, NO enviamos nada (anti-spam)
    const lastAlertSec = activeAlert ? activeAlert.date : Math.floor(alertStateInMemory.lastAlertTs / 1000);
    const inCooldown = lastAlertSec > 0 && (nowSec - lastAlertSec < ALERT_COOLDOWN_SEC);

    if (!inCooldown) {
      alertStateInMemory.lastAlertTs = now;
      await sendTelegram(
        token,
        chatId,
        `⚠️ <b>Alfeicon: la base de datos NO responde</b>\n\n` +
        `El chequeo automático detectó una falla tras 4 intentos con espera progresiva (~25s).\n\n` +
        `<b>Error:</b> <code>${health.error ?? "desconocido"}</code>\n\n` +
        `Revisa https://status.supabase.com y tu proyecto en https://supabase.com/dashboard\n\n` +
        `<i>Aviso automático · ${formatLocalDate()}\n` +
        `No repetiré este aviso durante los próximos 30 min.</i>`,
        true // Anclar el mensaje para deduplicar entre instancias serverless
      );
    } else {
      console.log("[health] Alerta en cooldown activo, omitiendo notificación duplicada a Telegram.");
    }
  }

  return NextResponse.json({ status: "error", error: health.error }, { status: 503 });
}
