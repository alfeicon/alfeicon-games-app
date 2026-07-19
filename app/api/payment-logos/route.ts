// app/api/payment-logos/route.ts
// Devuelve los logos de las tarjetas/medios aceptados por Mercado Pago.
// El ACCESS_TOKEN queda SOLO en el servidor; el navegador pide este JSON ya
// procesado. Resultado cacheado ~1 día (los medios casi no cambian).
import { NextResponse } from 'next/server';

export const revalidate = 86400; // 1 día

type PaymentLogo = { name: string; logo: string };

export async function GET() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return NextResponse.json([] as PaymentLogo[]);

  try {
    const res = await fetch('https://api.mercadopago.com/v1/payment_methods', {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json([] as PaymentLogo[]);

    const methods = await res.json();
    const seen = new Set<string>();
    const logos: PaymentLogo[] = (Array.isArray(methods) ? methods : [])
      // Solo tarjetas activas (crédito/débito): son las marcas reconocibles.
      .filter((m) => m?.status === 'active' && (m?.payment_type_id === 'credit_card' || m?.payment_type_id === 'debit_card'))
      .map((m) => ({ name: String(m?.name ?? ''), logo: String(m?.secure_thumbnail || m?.thumbnail || '') }))
      // Deduplica por marca: "Visa" y "Visa Débito" colapsan en una sola entrada.
      .filter((m) => {
        const brand = m.name.toLowerCase().replace(/\b(d[eé]bito|cr[eé]dito)\b/g, '').replace(/\s+/g, ' ').trim();
        if (!brand || !m.logo || seen.has(brand)) return false;
        seen.add(brand);
        return true;
      })
      .slice(0, 8);

    return NextResponse.json(logos);
  } catch {
    return NextResponse.json([] as PaymentLogo[]);
  }
}
