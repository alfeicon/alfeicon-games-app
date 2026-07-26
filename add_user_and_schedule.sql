-- Migration: Add user_id and scheduled_at to orders

-- 1. Add columns to orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- 2. Update RLS policies for orders
-- Permitir que un usuario autenticado lea sus propias órdenes
DROP POLICY IF EXISTS "Los usuarios pueden leer sus propias ordenes" ON public.orders;
CREATE POLICY "Los usuarios pueden leer sus propias ordenes" 
ON public.orders FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Permitir que un usuario autenticado actualice sus propias órdenes (ej: para programar)
DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propias ordenes" ON public.orders;
CREATE POLICY "Los usuarios pueden actualizar sus propias ordenes" 
ON public.orders FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- La política existente "Escritura pública de ordenes" para update anónimo basado en el short_code 
-- (que usa true) debería seguir funcionando para los invitados y para cuando entran a la URL mágica.
-- Igual para select.
