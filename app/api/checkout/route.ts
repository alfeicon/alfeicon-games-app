import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type OrderItem = { item_type: 'game' | 'pack'; item_id: string | null };

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (typeof code !== 'string' || !/^[A-Z0-9-]{4,40}$/i.test(code)) {
      return NextResponse.json({ error: 'Código de orden inválido' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!supabaseUrl || !serviceRoleKey || !mpToken) {
      console.error('[checkout] Faltan variables privadas de pago');
      return NextResponse.json({ error: 'Pago no configurado' }, { status: 503 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id,short_code,game_name,discount_code,payment_method,payment_status')
      .eq('short_code', code)
      .eq('payment_method', 'mercadopago')
      .eq('payment_status', 'pending')
      .maybeSingle();

    if (orderError || !order) {
      console.error('[checkout] Orden no encontrada:', orderError?.message || code);
      return NextResponse.json({ error: 'La orden no está disponible para pagar' }, { status: 404 });
    }

    const { data: orderItems, error: itemsError } = await admin
      .from('order_items')
      .select('item_type,item_id')
      .eq('order_id', order.id)
      .order('sort_order', { ascending: true });
    if (itemsError || !orderItems?.length) {
      console.error('[checkout] Orden sin productos:', itemsError?.message || order.id);
      return NextResponse.json({ error: 'La orden no tiene productos válidos' }, { status: 409 });
    }

    const typedItems = orderItems as OrderItem[];
    const gameIds = typedItems.filter(i => i.item_type === 'game' && i.item_id).map(i => i.item_id as string);
    const packIds = typedItems.filter(i => i.item_type === 'pack' && i.item_id).map(i => i.item_id as string);
    const [{ data: games, error: gamesError }, { data: packs, error: packsError }] = await Promise.all([
      gameIds.length ? admin.from('games').select('id,price,is_offer,offer_price').in('id', gameIds) : Promise.resolve({ data: [], error: null }),
      packIds.length ? admin.from('packs').select('id,price').in('id', packIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (gamesError || packsError) {
      console.error('[checkout] No se pudieron consultar precios:', gamesError?.message || packsError?.message);
      return NextResponse.json({ error: 'No se pudo verificar el precio' }, { status: 503 });
    }

    const gameMap = new Map((games || []).map(game => [game.id, money(game.is_offer && game.offer_price != null ? game.offer_price : game.price)]));
    const packMap = new Map((packs || []).map(pack => [pack.id, money(pack.price)]));
    let gamesTotal = 0;
    let packsTotal = 0;
    for (const item of typedItems) {
      if (!item.item_id) return NextResponse.json({ error: 'Producto inválido en la orden' }, { status: 409 });
      const price = item.item_type === 'pack' ? packMap.get(item.item_id) : gameMap.get(item.item_id);
      if (price == null) return NextResponse.json({ error: 'Un producto ya no está disponible' }, { status: 409 });
      if (item.item_type === 'pack') packsTotal += price;
      else gamesTotal += price;
    }

    let discount = 0;
    if (order.discount_code) {
      const { data: rows, error: discountError } = await admin.rpc('validar_codigo', {
        p_code: order.discount_code,
        p_total_juegos: gamesTotal,
        p_total_packs: packsTotal,
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (discountError || !row?.valido) {
        return NextResponse.json({ error: 'El código de descuento ya no es válido' }, { status: 409 });
      }
      discount = money(row.descuento);
    }

    const total = Math.max(0, gamesTotal + packsTotal - discount);
    const title = String(order.game_name || 'Compra Alfeicon Games').slice(0, 250);
    const { error: syncError } = await admin
      .from('orders')
      .update({ sale_price: total, discount_amount: discount })
      .eq('id', order.id);
    if (syncError) {
      console.error('[checkout] No se pudo sincronizar el total:', syncError.message);
      return NextResponse.json({ error: 'No se pudo preparar el pago' }, { status: 503 });
    }

    const client = new MercadoPagoConfig({ accessToken: mpToken });
    const preference = new Preference(client);
    let origin = req.nextUrl.origin;
    if (origin.includes('localhost') || origin.includes('192.168.')) {
      origin = 'https://alfeicon-games.vercel.app';
    }

    const body = {
      items: [{ id: String(order.id), title, quantity: 1, unit_price: total, currency_id: 'CLP' }],
      back_urls: {
        success: `${origin}/entrega/${order.short_code}?status=approved`,
        failure: `${origin}/?status=failure`,
        pending: `${origin}/?status=pending`,
      },
      auto_return: 'approved',
      external_reference: String(order.short_code),
      notification_url: `${origin}/api/mp-webhook`,
    };

    const response = await preference.create({ body });
    if (response.id) {
      await admin.from('orders').update({ mp_preference_id: String(response.id) }).eq('id', order.id);
    }
    return NextResponse.json({ id: response.id, init_point: response.init_point });
  } catch (error: unknown) {
    console.error('Error al crear preferencia de Mercado Pago:', error);
    return NextResponse.json({
      error: 'Error al procesar el pago',
      details: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}
