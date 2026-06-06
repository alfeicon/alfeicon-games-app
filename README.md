# Alfeicon Games App

Tienda web mobile-first para Alfeicon Games, hecha con Next.js, Supabase y Vercel. El catalogo publico muestra juegos unitarios y packs, y el panel privado `/admin` permite administrar juegos desde la web.

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Supabase Auth + Database
- Vercel Analytics + Speed Insights
- Fuse.js para busqueda

## Configuracion Local

Instala dependencias:

```bash
npm install
```

Crea `.env.local` usando `.env.example` como base:

```env
NEXT_PUBLIC_SUPABASE_URL=https://fhsfloqxjvcrvrsswmmc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_publishable_key
```

No uses la secret key de Supabase en el frontend.

Ejecuta el servidor:

```bash
npm run dev
```

Abre:

- Tienda: http://localhost:3000
- Admin: http://localhost:3000/admin

## Supabase

El esquema principal esta en:

```txt
supabase/schema.sql
```

Para cargar datos desde el Google Sheet actual:

```bash
npm run supabase:seed
```

Ese comando genera:

```txt
supabase/seed-from-sheets.sql
```

Ejecuta primero `supabase/schema.sql` en Supabase SQL Editor y luego `supabase/seed-from-sheets.sql`.

Si el catalogo queda duplicado, ejecuta:

```txt
supabase/reset-catalog.sql
```

Luego vuelve a ejecutar el seed actualizado.

## Admin

El admin usa Supabase Auth. Para dar acceso:

1. Crea el usuario en Supabase Authentication.
2. Copia el `user_id`.
3. Ejecuta:

```sql
insert into public.admin_users (user_id, email)
values (
  'USER_ID_AQUI',
  'correo@ejemplo.com'
)
on conflict (user_id) do update
set email = excluded.email;
```

Desde `/admin` se pueden crear y editar juegos, cambiar precio, imagen, estado activo/oferta y ver una vista previa de la card.

## Deploy en Vercel

Antes de desplegar, configura estas variables en Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://fhsfloqxjvcrvrsswmmc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_publishable_key
```

Ruta:

```txt
Project Settings -> Environment Variables
```

Marca Production, Preview y Development si Vercel lo solicita. Luego haz redeploy.

## Comandos

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run supabase:seed
```

## Notas de Seguridad

- `.env.local` no se sube a GitHub.
- La publishable/anon key puede usarse en navegador con RLS activo.
- Nunca publiques la secret key o service role key.
- Las escrituras del admin estan protegidas con RLS y la tabla `admin_users`.
