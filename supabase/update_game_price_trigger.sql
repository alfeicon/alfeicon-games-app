-- Función para redondear a 990
CREATE OR REPLACE FUNCTION redondear_a_990(monto numeric)
RETURNS integer AS $$
BEGIN
  RETURN (round(monto / 1000) * 1000) - 10;
END;
$$ LANGUAGE plpgsql;

-- Función principal que se ejecuta con el trigger
CREATE OR REPLACE FUNCTION check_recurring_cost_and_update_price()
RETURNS TRIGGER AS $$
DECLARE
  v_game_id uuid;
  v_recent_costs integer[];
  v_new_cost integer;
  v_current_cost integer;
  v_eshop_price integer;
  
  v_price_marketing numeric;
  v_price_margin numeric;
  v_final_price integer;
BEGIN
  -- Solo nos importa si es un juego y es compra
  IF NEW.item_type != 'game' OR NEW.kind != 'compra' OR NEW.item_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_game_id := NEW.item_id::uuid;

  -- Obtener los últimos 5 costos de este juego
  SELECT array_agg(cost_price ORDER BY created_at DESC)
  INTO v_recent_costs
  FROM (
    SELECT cost_price, created_at
    FROM order_items
    WHERE item_id = v_game_id::text
      AND item_type = 'game'
      AND kind = 'compra'
    ORDER BY created_at DESC
    LIMIT 5
  ) sub;

  -- Verificar si tenemos exactamente 5 registros
  IF array_length(v_recent_costs, 1) = 5 THEN
    -- Verificar si los 5 costos son idénticos
    IF v_recent_costs[1] = v_recent_costs[2] AND 
       v_recent_costs[2] = v_recent_costs[3] AND 
       v_recent_costs[3] = v_recent_costs[4] AND 
       v_recent_costs[4] = v_recent_costs[5] THEN
       
       v_new_cost := v_recent_costs[1];

       -- Obtener datos actuales del juego
       SELECT cost_price, eshop_price INTO v_current_cost, v_eshop_price
       FROM games
       WHERE id = v_game_id;

       -- Si el costo cambió respecto al catálogo oficial
       IF v_current_cost IS DISTINCT FROM v_new_cost THEN
          
          -- 1. Calcular precio ideal de marketing (eShop * 0.47)
          v_price_marketing := COALESCE(v_eshop_price * 0.47, 0);

          -- 2. Calcular piso mínimo de ganancia (Costo + 9000 / 0.965)
          v_price_margin := (v_new_cost + 9000) / 0.965;

          -- 3. Elegir el mayor entre ambos
          IF v_price_margin > v_price_marketing THEN
             v_final_price := redondear_a_990(v_price_margin);
          ELSE
             v_final_price := redondear_a_990(v_price_marketing);
          END IF;
          
          -- Prevenir precios negativos si algo falla
          IF v_final_price < 990 THEN
             v_final_price := 990;
          END IF;

          -- Actualizar el catálogo
          UPDATE games 
          SET cost_price = v_new_cost,
              price = v_final_price,
              updated_at = NOW()
          WHERE id = v_game_id;
          
       END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Borrar el trigger si existe para poder recrearlo
DROP TRIGGER IF EXISTS trigger_check_recurring_cost ON order_items;

-- Crear el trigger que escucha después de cada INSERT en order_items
CREATE TRIGGER trigger_check_recurring_cost
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION check_recurring_cost_and_update_price();
