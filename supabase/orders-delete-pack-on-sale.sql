-- Cuando una orden de Entregas se completa y lo vendido es un pack del
-- catalogo, el pack se elimina (igual que ya pasa al vender un pack desde
-- Ventas). La venta tambien queda registrada con item_type = 'pack' en vez
-- de 'game' para que se muestre correctamente en Ventas.
--
-- Entregas ahora guarda en `pack_ids` los ids exactos de los packs elegidos
-- desde el autocompletado, asi el trigger no depende de matchear el nombre
-- del pack por texto (fragil ante typos o titulos parecidos). Para ordenes
-- viejas sin `pack_ids` se mantiene el matching por texto como respaldo.
--
-- Ejecutar una vez en el SQL Editor de Supabase (reemplaza la version anterior
-- de este mismo script; no hace falta correr la anterior si no se corrio aun).

alter table public.orders
add column if not exists pack_ids uuid[];

CREATE OR REPLACE FUNCTION public.create_sale_on_order_completed()
RETURNS TRIGGER AS $$
DECLARE
  item_name text;
  matched_pack_id uuid;
  sold_item_type text := 'game';
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

    IF NEW.pack_ids IS NOT NULL AND array_length(NEW.pack_ids, 1) > 0 THEN
      -- Camino robusto: se sabe exactamente que packs se vendieron.
      FOR matched_pack_id IN SELECT unnest(NEW.pack_ids)
      LOOP
        sold_item_type := 'pack';
        DELETE FROM public.pack_items WHERE pack_id = matched_pack_id;
        DELETE FROM public.packs WHERE id = matched_pack_id;
      END LOOP;
    ELSE
      -- Respaldo para ordenes creadas antes de que existiera pack_ids: el
      -- nombre de la orden puede combinar varios items separados por "+"
      -- (mismo formato que usa el autocompletado de Entregas).
      FOR item_name IN SELECT trim(unnest(string_to_array(NEW.game_name, '+')))
      LOOP
        SELECT id INTO matched_pack_id
        FROM public.packs
        WHERE is_active = true AND lower(title) = lower(item_name)
        LIMIT 1;

        IF matched_pack_id IS NOT NULL THEN
          sold_item_type := 'pack';
          DELETE FROM public.pack_items WHERE pack_id = matched_pack_id;
          DELETE FROM public.packs WHERE id = matched_pack_id;
        END IF;
      END LOOP;
    END IF;

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
        sold_item_type,
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
