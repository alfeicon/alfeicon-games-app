-- Función para verificar si un correo existe antes de iniciar sesión.
-- Esto permite dar mensajes de error específicos ("Correo no registrado" vs "Contraseña incorrecta").

create or replace function public.check_email_exists(p_email text)
returns boolean
language plpgsql
security definer
as $$
begin
  return exists (select 1 from auth.users where email = p_email);
end;
$$;

-- Permitimos que los usuarios sin autenticar (anon) puedan ejecutarla en el Login
grant execute on function public.check_email_exists to anon;
grant execute on function public.check_email_exists to authenticated;
