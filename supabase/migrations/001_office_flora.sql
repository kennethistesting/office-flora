create extension if not exists pgcrypto;

create table if not exists public.flora_entries (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  captured_at date not null,
  status text not null default 'draft' check (status in ('draft','published')),
  photo_path text not null,
  photo_url text not null,
  illustration_path text,
  illustration_url text,
  flower_name text,
  common_name text,
  scientific_name text,
  confidence integer check (confidence between 0 and 100),
  arrangement_style text,
  notes text,
  design_notes text,
  dominant_colors jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  identification_candidates jsonb not null default '[]'::jsonb,
  needs_review boolean not null default false
);

alter table public.flora_entries enable row level security;

-- The public website can only read entries that have explicitly been published.
create policy "Public can read published flora"
on public.flora_entries for select
to anon, authenticated
using (status = 'published');

-- All writes are intentionally omitted from browser-facing RLS policies.
-- Publishing is done by the trusted sync script using the Supabase service role key.

insert into storage.buckets (id, name, public)
values ('flora-photos', 'flora-photos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('flora-illustrations', 'flora-illustrations', true)
on conflict (id) do update set public = true;

-- Public read-only archive assets. Uploads happen server-side via the publisher script.
create policy "Public can read flora photos"
on storage.objects for select
to public
using (bucket_id in ('flora-photos', 'flora-illustrations'));
