-- Crear la tabla de proveedores si no existe
CREATE TABLE IF NOT EXISTS public.providers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para administradores
-- Solo usuarios autenticados pueden ver, insertar, actualizar y borrar proveedores.
CREATE POLICY "Enable read access for authenticated users"
ON public.providers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.providers FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON public.providers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
ON public.providers FOR DELETE
TO authenticated
USING (true);
