import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RequestedItem = { id?: unknown; esPack?: unknown };

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      code?: unknown;
      items?: unknown;
      payment_method?: unknown;
      discount_code?: unknown;
      garantia_juego_dias?: unknown;
      garantia_pack_dias?: unknown;
    };
    const code = String(body.code || "").trim().toUpperCase();
    const items = Array.isArray(body.items) ? body.items as RequestedItem[] : [];
    const paymentMethod = String(body.payment_method || "transferencia");
    const allowedMethods = new Set(["transferencia", "mercadopago", "global66", "prex", "binance"]);

    if (!/^[A-Z0-9-]{4,40}$/.test(code) || items.length === 0 || items.length > 30 || !allowedMethods.has(paymentMethod)) {
      return NextResponse.json({ error: "Datos de orden inválidos" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Pago no configurado" }, { status: 503 });
    const admin = createClient(url, key, { auth: { persistSession: false } });

    // Solo asociamos la orden a una cuenta si el comprador realmente inició sesión.
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    if (token) {
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    const requested = items.map(item => ({ id: String(item.id || ""), esPack: item.esPack === true }));
    if (requested.some(item => !/^[0-9a-f-]{20,}$/i.test(item.id))) {
      return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
    }

    const gameIds = requested.filter(item => !item.esPack).map(item => item.id);
    const packIds = requested.filter(item => item.esPack).map(item => item.id);
    const [{ data: games, error: gamesError }, { data: packs, error: packsError }] = await Promise.all([
      gameIds.length ? admin.from("games").select("id,title,price,is_offer,offer_price").in("id", gameIds).eq("is_active", true) : Promise.resolve({ data: [], error: null }),
      packIds.length ? admin.from("packs").select("id,title,price").in("id", packIds).eq("is_active", true) : Promise.resolve({ data: [], error: null }),
    ]);
    if (gamesError || packsError) throw gamesError || packsError;

    const gameMap = new Map((games || []).map(game => [game.id, {
      title: game.title,
      price: money(game.is_offer && game.offer_price != null ? game.offer_price : game.price),
    }]));
    const packMap = new Map((packs || []).map(pack => [pack.id, { title: pack.title, price: money(pack.price) }]));
    const canonicalItems = requested.map(item => {
      const product = item.esPack ? packMap.get(item.id) : gameMap.get(item.id);
      return product ? { ...item, ...product } : null;
    });
    if (canonicalItems.some(item => !item)) return NextResponse.json({ error: "Un producto ya no está disponible" }, { status: 409 });
    const validItems = canonicalItems as Array<{ id: string; esPack: boolean; title: string; price: number }>;
    const gamesTotal = validItems.filter(item => !item.esPack).reduce((sum, item) => sum + item.price, 0);
    const packsTotal = validItems.filter(item => item.esPack).reduce((sum, item) => sum + item.price, 0);

    let discount = 0;
    const discountCode = String(body.discount_code || "").trim().toUpperCase() || null;
    if (discountCode) {
      const { data: rows, error } = await admin.rpc("validar_codigo", {
        p_code: discountCode,
        p_total_juegos: gamesTotal,
        p_total_packs: packsTotal,
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (error || !row?.valido) return NextResponse.json({ error: "El código de descuento ya no es válido" }, { status: 409 });
      discount = money(row.descuento);
    }

    const total = Math.max(0, gamesTotal + packsTotal - discount);
    const { data: order, error: orderError } = await admin.from("orders").insert({
      short_code: code,
      game_name: validItems.map(item => item.title).join(" + ").slice(0, 250),
      pack_ids: validItems.filter(item => item.esPack).map(item => item.id),
      status: "draft",
      sale_price: total,
      discount_code: discountCode,
      discount_amount: discount,
      payment_method: paymentMethod,
      payment_status: "pending",
      user_id: userId,
    }).select("id").single();
    if (orderError || !order) throw orderError || new Error("No se pudo crear la orden");

    const garantiaJuego = Math.max(1, Math.round(Number(body.garantia_juego_dias) || 7));
    const garantiaPack = Math.max(1, Math.round(Number(body.garantia_pack_dias) || 3));
    const { error: itemsError } = await admin.from("order_items").insert(validItems.map((item, index) => ({
      order_id: order.id,
      kind: "compra",
      item_type: item.esPack ? "pack" : "game",
      item_id: item.id,
      title: item.title,
      sale_price: item.price,
      cost_price: 0,
      dias_garantia: item.esPack ? garantiaPack : garantiaJuego,
      sort_order: index,
    })));
    if (itemsError) {
      await admin.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    return NextResponse.json({ id: order.id, code, total });
  } catch (error) {
    console.error("[create-order]", error);
    return NextResponse.json({ error: "No pudimos preparar tu orden" }, { status: 500 });
  }
}
