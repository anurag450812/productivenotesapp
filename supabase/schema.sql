-- ============================================================
--  Productive Notes — Supabase schema
--  Run this in the Supabase SQL Editor (Dashboard > SQL).
-- ============================================================

-- ---------- NOTES ----------
create table if not exists public.notes (
  id                text primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  title             text not null default '',
  lines             jsonb not null default '[]'::jsonb,
  color             text not null default 'default',
  pinned            boolean not null default false,
  archived          boolean not null default false,
  trashed           boolean not null default false,
  trashed_at        timestamptz,
  is_reminder_note  boolean not null default false,
  collapsed         boolean not null default false,
  show_checkboxes   boolean not null default true,
  list_mode         boolean not null default false,
  image_url         text,
  position          double precision not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes(user_id);

-- ---------- REMINDERS ----------
create table if not exists public.reminders (
  id           text primary key,
  note_id      text not null references public.notes(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null default '',
  due_at       timestamptz not null,
  repeat_type  text not null default 'none',
  repeat_dow   int,
  repeat_dom   int,
  done         boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists reminders_user_idx on public.reminders(user_id);
create index if not exists reminders_note_idx on public.reminders(note_id);

-- ---------- updated_at trigger ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

drop trigger if exists reminders_touch on public.reminders;
create trigger reminders_touch before update on public.reminders
  for each row execute function public.touch_updated_at();

-- ---------- ROW LEVEL SECURITY ----------
alter table public.notes enable row level security;
alter table public.reminders enable row level security;

drop policy if exists "notes owner all" on public.notes;
create policy "notes owner all" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reminders owner all" on public.reminders;
create policy "reminders owner all" on public.reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- REALTIME ----------
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.reminders;

-- ---------- IMAGE STORAGE ----------
insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do nothing;

drop policy if exists "images owner write" on storage.objects;
create policy "images owner write" on storage.objects
  for insert with check (bucket_id = 'note-images' and auth.uid() = (storage.foldername(name))[1]::uuid);

drop policy if exists "images public read" on storage.objects;
create policy "images public read" on storage.objects
  for select using (bucket_id = 'note-images');

drop policy if exists "images owner delete" on storage.objects;
create policy "images owner delete" on storage.objects
  for delete using (bucket_id = 'note-images' and auth.uid() = (storage.foldername(name))[1]::uuid);
