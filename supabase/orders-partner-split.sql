-- Reparto de ganancia con el socio también en órdenes de Entregas: el % que se
-- llevaba el socio en Ventas ahora también se puede fijar en la orden, y el
-- trigger que crea la venta automática al completarla lo copia.
-- Ejecutar una vez en el SQL Editor de Supabase.

alter table public.orders
add column if not exists partner_pct integer check (partner_pct is null or (partner_pct between 0 and 100));

CREATE OR REPLACE FUNCTION public.create_sale_on_order_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    IF NEW.sale_price IS NOT NULL THEN
      INSERT INTO public.sales (
        item_type,
        item_title,
        price_sold,
        cost_price,
        payment_method,
        provider,
        partner_pct,
        created_at
      ) VALUES (
        'game',
        NEW.game_name,
        NEW.sale_price,
        COALESCE(NEW.cost_price, 0),
        'Transferencia',
        NEW.provider,
        NEW.partner_pct,
        now()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
