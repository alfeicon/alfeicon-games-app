import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Webhook de Mercado Pago: es la única fuente confiable de "este pago existe y
// está aprobado". La vuelta del cliente por `back_urls` no sirve como prueba —
// esa URL la puede abrir cualquiera.
//
// Configurar en Mercado Pago → Tus integraciones → Webhooks:
//   URL:      https://TU-DOMINIO/api/mp-webhook
//   Evento:   Pagos (payment)
// y copiar la "clave secreta" a MP_WEBHOOK_SECRET para validar la firma.

// MP firma con: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
// Sin secreto configurado no se valida, pero se deja constancia en el log.
function signatureIsValid(req: NextRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[mp-webhook] MP_WEBHOOK_SECRET sin configurar: no se valida la firma");
    return true;
  }

  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(
    signature.split(",").map(p => p.split("=").map(s => s.trim())).filter(p => p.length === 2),
  );
  const ts = parts["ts"];
  const hash = parts["v1"];
  if (!ts || !hash) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  // timingSafeEqual explota si los largos difieren, así que se compara antes.
  const a = Buffer.from(hash);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.MP_ACCESS_TOKEN;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !supabaseUrl || !supabaseKey) {
      console.error("[mp-webhook] Faltan variables de entorno");
      return NextResponse.json({ error: "No configurado" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));
    // MP manda el id en el body o en la query, según el tipo de notificación.
    const type = body?.type || body?.topic || req.nextUrl.searchParams.get("type") || req.nextUrl.searchParams.get("topic");
    const paymentId = String(body?.data?.id || req.nextUrl.searchParams.get("data.id") || req.nextUrl.searchParams.get("id") || "");

    // Solo interesan los avisos de pago; el resto se confirma y se ignora.
    if (type !== "payment" || !paymentId) {
      return NextResponse.json({ status: "ignored" });
    }

    if (!signatureIsValid(req, paymentId)) {
      console.error("[mp-webhook] Firma inválida");
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    // Se consulta el pago a MP en vez de confiar en el cuerpo del webhook.
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mpRes.ok) {
      console.error("[mp-webhook] No se pudo consultar el pago:", await mpRes.text());
      // 500 para que Mercado Pago reintente.
      return NextResponse.json({ error: "Error consultando el pago" }, { status: 500 });
    }

    const payment = await mpRes.json();
    const shortCode = payment?.external_reference;
    if (!shortCode) {
      console.warn("[mp-webhook] Pago sin external_reference:", paymentId);
      return NextResponse.json({ status: "sin referencia" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("short_code", shortCode)
      .maybeSingle();

    if (!order) {
      console.warn("[mp-webhook] Orden no encontrada:", shortCode);
      return NextResponse.json({ status: "orden no encontrada" });
    }

    if (payment.status !== "approved") {
      const rejected = payment.status === "rejected";
      // Rechazado o pendiente: se registra, pero la orden no se destraba.
      await supabase
        .from("orders")
        .update({ payment_status: rejected ? "rejected" : "pending" })
        .eq("id", order.id);

      // Un rechazo sí requiere que sepas: el cliente quedó esperando en su
      // portal sin poder avanzar. Los "pendiente" no se avisan (son ruido:
      // MP manda varios mientras procesa).
      if (rejected && order.payment_status !== "rejected") {
        fetch(`${req.nextUrl.origin}/api/notify-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "MP_REJECTED", order }),
        }).catch(err => console.error("[mp-webhook] error notificando rechazo", err));
      }

      return NextResponse.json({ status: payment.status });
    }

    // Ya estaba aprobada: MP reintenta el mismo aviso varias veces y no
    // queremos volver a notificar ni pisar el avance del cliente.
    if (order.payment_status === "approved") {
      return NextResponse.json({ status: "ya procesado" });
    }

    await supabase
      .from("orders")
      .update({
        payment_status: "approved",
        payment_method: "mercadopago",
        sale_price: order.sale_price ?? Math.round(Number(payment.transaction_amount) || 0),
        // Sale de borrador: el pago está confirmado y ya puede instalar.
        status: order.status === "draft" ? "pending_console_code" : order.status,
      })
      .eq("id", order.id);

    fetch(`${req.nextUrl.origin}/api/notify-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "MP_APPROVED", order }),
    }).catch(err => console.error("[mp-webhook] error notificando", err));

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[mp-webhook] Error interno:", error);
    return NextResponse.json({ error: "Error procesando webhook" }, { status: 500 });
  }
}
