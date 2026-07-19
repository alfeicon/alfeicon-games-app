-- Pago automático con Mercado Pago (Checkout Pro), como alternativa a la
-- transferencia manual de siempre. Todas las columnas son nullable: las
-- órdenes manuales de siempre no las tocan y siguen funcionando igual.
--
-- payment_method: 'transferencia' | 'mercadopago' | null (null = como hoy,
--   no se sabe el método porque se completó a mano sin pasar por Mercado Pago).
-- payment_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | null.
-- mp_preference_id / mp_payment_id: ids de Mercado Pago para poder rastrear
--   el pago desde el panel de Mercado Pago si hace falta.
--
-- Ejecutar una vez en el SQL Editor de Supabase.

alter table public.orders add column if not exists payment_method text
  check (payment_method is null or payment_method in ('transferencia', 'mercadopago'));
alter table public.orders add column if not exists payment_status text
  check (payment_status is null or payment_status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded'));
alter table public.orders add column if not exists mp_preference_id text;
alter table public.orders add column if not exists mp_payment_id text;

-- El trigger de venta automática (definido en orders-delete-pack-on-sale.sql)
-- dejaba `payment_method` de la venta fijo en 'Transferencia' siempre. Ahora
-- usa 'Mercado Pago' cuando la orden se pagó por ese medio, y sigue usando
-- 'Transferencia' para cualquier otro caso (cero cambio para el flujo manual).
CREATE OR REPLACE FUNCTION public.create_sale_on_order_completed()
RETURNS TRIGGER AS $$
DECLARE
  item_name text;
  matched_pack_id uuid;
  sold_item_type text := 'game';
  total_segments integer;
  matched_packs_count integer := 0;
  sale_payment_method text;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

    IF NEW.sale_price IS NOT NULL THEN

      total_segments := COALESCE(array_length(string_to_array(NEW.game_name, '+'), 1), 0);

      IF NEW.pack_ids IS NOT NULL THEN
        FOR matched_pack_id IN SELECT unnest(NEW.pack_ids)
        LOOP
          matched_packs_count := matched_packs_count + 1;
          DELETE FROM public.pack_items WHERE pack_id = matched_pack_id;
          DELETE FROM public.packs WHERE id = matched_pack_id;
        END LOOP;
      ELSE
        FOR item_name IN SELECT trim(unnest(string_to_array(NEW.game_name, '+')))
        LOOP
          SELECT id INTO matched_pack_id
          FROM public.packs
          WHERE lower(title) = lower(item_name)
          LIMIT 1;

          IF matched_pack_id IS NOT NULL THEN
            matched_packs_count := matched_packs_count + 1;
            DELETE FROM public.pack_items WHERE pack_id = matched_pack_id;
            DELETE FROM public.packs WHERE id = matched_pack_id;
          END IF;
        END LOOP;
      END IF;

      IF matched_packs_count > 0 AND matched_packs_count >= total_segments THEN
        sold_item_type := 'pack';
      END IF;

      sale_payment_method := CASE WHEN NEW.payment_method = 'mercadopago' THEN 'Mercado Pago' ELSE 'Transferencia' END;

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
        sold_item_type,
        NEW.game_name,
        NEW.sale_price,
        COALESCE(NEW.cost_price, 0),
        sale_payment_method,
        NEW.provider,
        NEW.partner_pct,
        now()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
