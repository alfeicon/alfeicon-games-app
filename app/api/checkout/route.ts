import { MercadoPagoConfig, Preference } from 'mercadopago';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { title, unit_price, id, quantity = 1, code } = await req.json();

    if (!title || !unit_price || !code) {
      return NextResponse.json({ error: 'Faltan datos del producto' }, { status: 400 });
    }

    const client = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN || '',
    });

    const preference = new Preference(client);
    
    let origin = req.nextUrl.origin;
    if (origin.includes('localhost') || origin.includes('192.168.')) {
      origin = 'https://tudominio.com'; // Dummy URL for local dev bypass
    }

    const body = {
      items: [
        {
          id: String(id || Date.now()),
          title: String(title),
          quantity: Number(quantity),
          unit_price: Number(unit_price),
          currency_id: 'CLP', // Puedes cambiar esto según la moneda base
        }
      ],
      back_urls: {
        success: `${origin}/entrega/${code}?status=approved`,
        failure: `${origin}/?status=failure`,
        pending: `${origin}/?status=pending`,
      },
      auto_return: 'approved',
      // El webhook recibe el id del pago, no el de la orden: `external_reference`
      // es lo que nos deja volver a encontrarla en nuestra base.
      external_reference: String(code),
      notification_url: `${origin}/api/mp-webhook`,
    };

    const response = await preference.create({ body });

    return NextResponse.json({ id: response.id, init_point: response.init_point });
  } catch (error: any) {
    console.error('Error al crear preferencia de Mercado Pago:', error);
    return NextResponse.json({ 
      error: 'Error al procesar el pago', 
      details: error.message || error.cause || error
    }, { status: 500 });
  }
}
