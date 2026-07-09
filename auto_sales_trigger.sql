-- 1. Add columns to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sale_price numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cost_price numeric;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider text;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.create_sale_on_order_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el estado cambia a 'completed' y no estaba en 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Solo insertar si tiene precio de venta (para evitar crear ventas basura de pruebas antiguas)
    IF NEW.sale_price IS NOT NULL THEN
      INSERT INTO public.sales (
        item_type,
        item_title,
        price_sold,
        cost_price,
        payment_method,
        provider,
        created_at
      ) VALUES (
        'game', -- Asumimos que la mayoría de entregas son juegos o packs
        NEW.game_name,
        NEW.sale_price,
        COALESCE(NEW.cost_price, 0),
        'Transferencia', -- Predeterminado porque vienen por WhatsApp
        NEW.provider,
        now()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS trigger_create_sale_on_order_completed ON public.orders;
CREATE TRIGGER trigger_create_sale_on_order_completed
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_sale_on_order_completed();
