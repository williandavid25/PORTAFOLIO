-- Portafolio DevWilly — esquema, seguridad (RLS) y almacenamiento.
-- Vive en el mismo proyecto de Supabase que API IA: todo lleva prefijo pf_ y
-- el bucket es “portafolio”, así no toca ninguna tabla de API IA.
-- Regla central: cualquiera puede LEER lo publicado; solo el correo que está en
-- public.pf_admins puede CREAR, EDITAR o BORRAR. La base de datos lo impone,
-- aunque alguien manipule la página o llame a la API directamente.


-- ---------- Administradores ----------
create table if not exists public.pf_admins (
  email text primary key check (email = lower(email))
);
alter table public.pf_admins enable row level security;
-- Sin políticas: nadie la lee ni la cambia desde la API (solo SQL / service role).

create or replace function public.pf_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pf_admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.pf_is_admin() from public;
grant execute on function public.pf_is_admin() to anon, authenticated;

-- ---------- Ajustes del sitio (una sola fila) ----------
create table if not exists public.pf_site (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.pf_site (id) values (1) on conflict do nothing;
alter table public.pf_site enable row level security;
drop policy if exists "pf_site_read" on public.pf_site;
create policy "pf_site_read" on public.pf_site for select to anon, authenticated using (true);
drop policy if exists "pf_site_admin_write" on public.pf_site;
create policy "pf_site_admin_write" on public.pf_site for update to authenticated
  using (public.pf_is_admin()) with check (public.pf_is_admin() and id = 1);

-- ---------- Proyectos / videos ----------
create table if not exists public.pf_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 90),
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (category in ('social','commercial','corporate','music','youtube','motion')),
  description text not null default '' check (char_length(description) <= 2000),
  client text not null default '' check (char_length(client) <= 120),
  year smallint check (year between 2000 and 2100),
  video_path text check (video_path is null or video_path ~ '^projects/[0-9a-f-]{36}/[a-z0-9._-]{1,80}$'),
  video_url text check (video_url is null or video_url ~ '^https://'),
  thumb_path text check (thumb_path is null or thumb_path ~ '^projects/[0-9a-f-]{36}/[a-z0-9._-]{1,80}$'),
  aspect text not null default '16:9' check (aspect in ('16:9','9:16','1:1','4:5')),
  featured boolean not null default false,
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pf_projects_public_idx on public.pf_projects (published, sort_order, created_at desc);
alter table public.pf_projects enable row level security;
drop policy if exists "pf_projects_read" on public.pf_projects;
create policy "pf_projects_read" on public.pf_projects for select to anon, authenticated
  using (published or public.pf_is_admin());
drop policy if exists "pf_projects_admin_insert" on public.pf_projects;
create policy "pf_projects_admin_insert" on public.pf_projects for insert to authenticated with check (public.pf_is_admin());
drop policy if exists "pf_projects_admin_update" on public.pf_projects;
create policy "pf_projects_admin_update" on public.pf_projects for update to authenticated using (public.pf_is_admin()) with check (public.pf_is_admin());
drop policy if exists "pf_projects_admin_delete" on public.pf_projects;
create policy "pf_projects_admin_delete" on public.pf_projects for delete to authenticated using (public.pf_is_admin());

-- ---------- Testimonios ----------
create table if not exists public.pf_testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  role text not null default '' check (char_length(role) <= 120),
  body text not null check (char_length(body) between 1 and 800),
  stars smallint not null default 5 check (stars between 1 and 5),
  avatar_path text check (avatar_path is null or avatar_path ~ '^testimonials/[0-9a-f-]{36}/[a-z0-9._-]{1,80}$'),
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.pf_testimonials enable row level security;
drop policy if exists "pf_testimonials_read" on public.pf_testimonials;
create policy "pf_testimonials_read" on public.pf_testimonials for select to anon, authenticated
  using (published or public.pf_is_admin());
drop policy if exists "pf_testimonials_admin_all" on public.pf_testimonials;
create policy "pf_testimonials_admin_all" on public.pf_testimonials for all to authenticated
  using (public.pf_is_admin()) with check (public.pf_is_admin());

-- ---------- Mensajes del formulario de contacto ----------
-- Los inserta solo el servidor (service role) tras validar y limitar envíos.
create table if not exists public.pf_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 160),
  project_type text not null default '' check (char_length(project_type) <= 60),
  body text not null check (char_length(body) between 1 and 3000),
  ip_hash text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pf_messages_ip_idx on public.pf_messages (ip_hash, created_at desc);
alter table public.pf_messages enable row level security;
drop policy if exists "pf_messages_admin_read" on public.pf_messages;
create policy "pf_messages_admin_read" on public.pf_messages for select to authenticated using (public.pf_is_admin());
drop policy if exists "pf_messages_admin_update" on public.pf_messages;
create policy "pf_messages_admin_update" on public.pf_messages for update to authenticated using (public.pf_is_admin()) with check (public.pf_is_admin());
drop policy if exists "pf_messages_admin_delete" on public.pf_messages;
create policy "pf_messages_admin_delete" on public.pf_messages for delete to authenticated using (public.pf_is_admin());

-- ---------- Almacenamiento de fotos y videos ----------
-- 50 MB es el máximo por archivo del plan gratuito de Supabase.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portafolio', 'portafolio', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pf_media_admin_insert" on storage.objects;
create policy "pf_media_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'portafolio' and public.pf_is_admin());
drop policy if exists "pf_media_admin_update" on storage.objects;
create policy "pf_media_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'portafolio' and public.pf_is_admin()) with check (bucket_id = 'portafolio' and public.pf_is_admin());
drop policy if exists "pf_media_admin_delete" on storage.objects;
create policy "pf_media_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'portafolio' and public.pf_is_admin());
drop policy if exists "pf_media_admin_select" on storage.objects;
create policy "pf_media_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'portafolio' and public.pf_is_admin());
