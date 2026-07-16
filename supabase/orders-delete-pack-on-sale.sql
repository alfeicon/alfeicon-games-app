-- Cuando una orden de Entregas se completa CON precio de venta cargado y lo
-- vendido es un pack del catalogo, el pack se elimina (igual que ya pasa al
-- vender un pack desde Ventas, sin importar si el pack esta activo o no). La
-- venta tambien queda registrada con item_type = 'pack' en vez de 'game' para
-- que se muestre correctamente en Ventas — pero solo cuando TODOS los items
-- de la orden eran packs; una combinacion de pack + juego se deja como
-- 'game' en vez de esconder que tambien se vendio un juego. Si no hay precio
-- de venta cargado, no se borra nada ni se registra venta todavia (misma
-- condicion que ya exigia la version anterior de este trigger).
--
-- Entregas y la tienda publica ahora guardan en `pack_ids` los ids exactos de
-- los packs elegidos (o un arreglo vacio si se sabe con certeza que no hay
-- ningun pack), asi el trigger no depende de matchear el nombre por texto
-- (fragil ante typos o titulos parecidos). El respaldo por texto solo corre
-- cuando `pack_ids` es NULL, es decir, para ordenes verdaderamente viejas
-- creadas antes de que existiera esta columna (un arreglo vacio ya cuenta
-- como "se sabe que no hay pack", no activa el respaldo).
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
  total_segments integer;
  matched_packs_count integer := 0;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN

    -- Todo lo de abajo (borrar el pack e insertar la venta) solo corre si hay
    -- precio de venta cargado. Si no, no se registra nada todavia y el pack
    -- sigue en el catalogo hasta que se complete la orden con precio.
    IF NEW.sale_price IS NOT NULL THEN

      total_segments := COALESCE(array_length(string_to_array(NEW.game_name, '+'), 1), 0);

      IF NEW.pack_ids IS NOT NULL THEN
        -- Camino robusto: se sabe con certeza que packs se vendieron (puede
        -- ser un arreglo vacio si la orden no incluye ningun pack). Se borra
        -- el pack sin importar si esta activo o no: si se referencia por id
        -- es porque de verdad se vendio (mismo criterio que usa la venta
        -- manual de packs desde Ventas).
        FOR matched_pack_id IN SELECT unnest(NEW.pack_ids)
        LOOP
          matched_packs_count := matched_packs_count + 1;
          DELETE FROM public.pack_items WHERE pack_id = matched_pack_id;
          DELETE FROM public.packs WHERE id = matched_pack_id;
        END LOOP;
      ELSE
        -- Respaldo SOLO para ordenes verdaderamente viejas (pack_ids nunca
        -- se llego a fijar, ni siquiera como arreglo vacio): el nombre de la
        -- orden puede combinar varios items separados por "+" (mismo formato
        -- que usa el autocompletado de Entregas). No se filtra por is_active
        -- para que se comporte igual que el camino robusto de arriba.
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

      -- Solo se registra la venta como "pack" si TODOS los items de la orden
      -- eran packs. Si es una combinacion de pack + juego, se deja el tipo
      -- por defecto ('game') en vez de etiquetar toda la venta como "pack"
      -- y ocultar que tambien se vendio un juego.
      IF matched_packs_count > 0 AND matched_packs_count >= total_segments THEN
        sold_item_type := 'pack';
      END IF;

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
