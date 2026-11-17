-- Portafolio de Willy — esquema, seguridad (RLS) y almacenamiento.
-- Regla central: cualquiera puede LEER lo publicado; solo el correo que está en
-- public.admin_users puede CREAR, EDITAR o BORRAR. La base de datos lo impone,
-- aunque alguien manipule la página o llame a la API directamente.

create extension if not exists pgcrypto;

-- ---------- Administradores ----------
create table if not exists public.admin_users (
  email text primary key check (email = lower(email))
);
alter table public.admin_users enable row level security;
-- Sin políticas: nadie la lee ni la cambia desde la API (solo SQL / service role).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Ajustes del sitio (una sola fila) ----------
create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict do nothing;
alter table public.site_settings enable row level security;
drop policy if exists "site_settings_read" on public.site_settings;
create policy "site_settings_read" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write" on public.site_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin() and id = 1);

-- ---------- Proyectos / videos ----------
create table if not exists public.projects (
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
create index if not exists projects_public_idx on public.projects (published, sort_order, created_at desc);
alter table public.projects enable row level security;
drop policy if exists "projects_read" on public.projects;
create policy "projects_read" on public.projects for select to anon, authenticated
  using (published or public.is_admin());
drop policy if exists "projects_admin_insert" on public.projects;
create policy "projects_admin_insert" on public.projects for insert to authenticated with check (public.is_admin());
drop policy if exists "projects_admin_update" on public.projects;
create policy "projects_admin_update" on public.projects for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "projects_admin_delete" on public.projects;
create policy "projects_admin_delete" on public.projects for delete to authenticated using (public.is_admin());

-- ---------- Testimonios ----------
create table if not exists public.testimonials (
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
alter table public.testimonials enable row level security;
drop policy if exists "testimonials_read" on public.testimonials;
create policy "testimonials_read" on public.testimonials for select to anon, authenticated
  using (published or public.is_admin());
drop policy if exists "testimonials_admin_all" on public.testimonials;
create policy "testimonials_admin_all" on public.testimonials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Mensajes del formulario de contacto ----------
-- Los inserta solo el servidor (service role) tras validar y limitar envíos.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  email text not null check (char_length(email) between 3 and 160),
  project_type text not null default '' check (char_length(project_type) <= 60),
  body text not null check (char_length(body) between 1 and 3000),
  ip_hash text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_ip_idx on public.messages (ip_hash, created_at desc);
alter table public.messages enable row level security;
drop policy if exists "messages_admin_read" on public.messages;
create policy "messages_admin_read" on public.messages for select to authenticated using (public.is_admin());
drop policy if exists "messages_admin_update" on public.messages;
create policy "messages_admin_update" on public.messages for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "messages_admin_delete" on public.messages;
create policy "messages_admin_delete" on public.messages for delete to authenticated using (public.is_admin());

-- ---------- Almacenamiento de fotos y videos ----------
-- 50 MB es el máximo por archivo del plan gratuito de Supabase.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "media_admin_insert" on storage.objects;
create policy "media_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());
drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
drop policy if exists "media_admin_select" on storage.objects;
create policy "media_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_admin());
