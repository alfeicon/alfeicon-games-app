import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ codigo: string }> };

async function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase privado no configurado");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function snapshot(code: string) {
  const supabase = await getAdmin();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("short_code", code)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) return null;

  const [{ data: items, error: itemsError }, { data: messages, error: messagesError }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id).order("sort_order", { ascending: true }),
    supabase.from("order_messages").select("*").eq("order_id", order.id).order("created_at", { ascending: true }),
  ]);
  if (itemsError) throw itemsError;
  if (messagesError) throw messagesError;
  return { order, items: items || [], messages: messages || [] };
}

async function getCode(ctx: Ctx) {
  const { codigo } = await ctx.params;
  const code = String(codigo || "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(code)) throw new Error("Código inválido");
  return code;
}

type MercadoPagoPayment = {
  id?: string | number;
  status?: string;
  external_reference?: string | null;
  transaction_amount?: number | string | null;
  payer?: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  additional_info?: {
    payer?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  } | null;
  payment_method_id?: string | null;
};

type MercadoPagoPayer = {
  first_name?: string | null;
  last_name?: string | null;
} | null | undefined;

const payerName = (payer: MercadoPagoPayer) =>
  [payer?.first_name, payer?.last_name].filter(Boolean).join(" ").trim();

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const data = await snapshot(await getCode(ctx));
    return data
      ? NextResponse.json(data)
      : NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  } catch (error) {
    console.error("[entrega-api] GET", error);
    return NextResponse.json({ error: "No se pudo cargar la entrega" }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const code = await getCode(ctx);
    const body = await request.json() as { action?: string; [key: string]: unknown };
    const supabase = await getAdmin();
    const { data: order, error: orderError } = await supabase.from("orders").select("*").eq("short_code", code).maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });

    let result;
    switch (body.action) {
      case "submit_code": {
        const consoleCode = String(body.console_code || "").toUpperCase().replace(/[^A-Z]/g, "");
        if (consoleCode.length !== 8) return NextResponse.json({ error: "Código de consola inválido" }, { status: 400 });
        const submittedAt = new Date().toISOString();
        result = await supabase.from("orders").update({ console_code: consoleCode, console_code_submitted_at: submittedAt, status: "pending_setup" }).eq("id", order.id);
        // Compatibilidad temporal: si el SQL todavía no se ejecutó, el código
        // sigue pudiendo enviarse y la fecha se agregará en el siguiente intento.
        if (result.error?.code === "42703") {
          result = await supabase.from("orders").update({ console_code: consoleCode, status: "pending_setup" }).eq("id", order.id);
        }
        break;
      }
      case "upload_receipt": {
        const receiptUrl = String(body.receipt_url || "");
        const clientName = String(body.client_name || "").trim();
        if (!receiptUrl || receiptUrl.length > 2000) return NextResponse.json({ error: "Comprobante inválido" }, { status: 400 });
        result = await supabase.from("orders").update({ receipt_url: receiptUrl, payment_status: "pending", ...(clientName ? { client_name: clientName.slice(0, 120) } : {}) }).eq("id", order.id);
        break;
      }
      case "message": {
        const message = String(body.message || "").trim();
        if (!message || message.length > 2000) return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
        result = await supabase.from("order_messages").insert({ order_id: order.id, sender: "customer", body: message });
        break;
      }
      case "read_messages": {
        const ids = Array.isArray(body.ids) ? body.ids.filter(id => typeof id === "string") : [];
        if (ids.length) result = await supabase.from("order_messages").update({ read_at: new Date().toISOString() }).in("id", ids).eq("order_id", order.id);
        break;
      }
      case "confirm_mp_payment": {
        const paymentId = String(body.payment_id || "").trim();
        const token = process.env.MP_ACCESS_TOKEN;
        if (!token) return NextResponse.json({ error: "Mercado Pago no configurado" }, { status: 503 });
        if (!/^\d+$/.test(paymentId)) return NextResponse.json({ error: "Pago inválido" }, { status: 400 });
        if (order.payment_method !== "mercadopago") return NextResponse.json({ error: "La orden no es de Mercado Pago" }, { status: 409 });

        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!mpRes.ok) {
          console.error("[entrega-api] MP confirm fetch", await mpRes.text());
          return NextResponse.json({ error: "No pudimos confirmar el pago todavía" }, { status: 502 });
        }

        const payment = await mpRes.json() as MercadoPagoPayment;
        if (String(payment.external_reference || "").toUpperCase() !== code) {
          console.warn("[entrega-api] MP pago no corresponde a la orden", { code, paymentId, external_reference: payment.external_reference });
          return NextResponse.json({ error: "El pago no corresponde a esta orden" }, { status: 409 });
        }
        if (payment.status !== "approved") {
          result = await supabase.from("orders").update({ payment_status: payment.status === "rejected" ? "rejected" : "pending" }).eq("id", order.id);
          break;
        }
        if (order.payment_status === "approved") break;

        const clientEmail = payment.payer?.email || null;
        const nombreReal = payerName(payment.payer) || payerName(payment.additional_info?.payer);
        const clientName = nombreReal || (clientEmail ? String(clientEmail).split("@")[0] : "") || null;
        const amount = Math.round(Number(payment.transaction_amount) || 0);
        const approvedPatch = {
          payment_status: "approved",
          payment_method: "mercadopago",
          sale_price: order.sale_price ?? amount,
          client_email: clientEmail,
          client_name: clientName,
          mp_payment_id: String(paymentId),
          status: order.status === "draft" ? "pending_console_code" : order.status,
        };
        result = await supabase.from("orders").update(approvedPatch).eq("id", order.id);
        if (result.error?.code === "PGRST204") {
          const { mp_payment_id: _mpPaymentId, ...patchWithoutMpId } = approvedPatch;
          result = await supabase.from("orders").update(patchWithoutMpId).eq("id", order.id);
        }

        fetch(`${new URL(request.url).origin}/api/notify-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "MP_APPROVED",
            order: { ...order, payment_status: "approved", client_email: clientEmail, client_name: clientName, mp_payment_id: String(paymentId) },
            pago: {
              monto: amount,
              pagador: nombreReal || clientEmail,
              medio: payment.payment_method_id || null,
              id: String(paymentId),
            },
          }),
        }).catch(err => console.error("[entrega-api] error notificando MP fallback", err));
        break;
      }
      case "complete_item": {
        const itemId = String(body.item_id || "");
        if (!itemId) return NextResponse.json({ error: "Ítem inválido" }, { status: 400 });
        result = await supabase.from("order_items").update({ completed_at: new Date().toISOString() }).eq("id", itemId).eq("order_id", order.id);
        break;
      }
      case "complete_order":
        result = await supabase.from("orders").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", order.id);
        break;
      case "issue":
        result = await supabase.from("orders").update({ status: "issue" }).eq("id", order.id);
        break;
      case "cancel":
        if (order.status === "completed") {
          return NextResponse.json({ error: "La orden ya fue completada" }, { status: 409 });
        }
        result = await supabase.from("orders").update({ payment_status: "cancelled" }).eq("id", order.id);
        if (!result.error) {
          fetch(`${new URL(request.url).origin}/api/notify-order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "ORDER_CANCELLED", order }),
          }).catch(err => console.error("[entrega-api] error notificando cancelación", err));
        }
        break;
      default:
        return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }
    if (result?.error) throw result.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[entrega-api] POST", error);
    return NextResponse.json({ error: "No se pudo actualizar la entrega" }, { status: 500 });
  }
}
