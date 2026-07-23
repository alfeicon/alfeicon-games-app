-- orders-client-info.sql
-- Add client_name and client_email columns to the orders table to store MercadoPago customer data.

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS client_name text,
ADD COLUMN IF NOT EXISTS client_email text;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
