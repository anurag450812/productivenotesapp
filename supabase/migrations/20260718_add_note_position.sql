-- Migration: Add position column to notes for drag-and-drop reordering
-- Run this in the Supabase SQL Editor (Dashboard > SQL).

alter table public.notes
  add column if not exists position double precision not null default 0;

-- Backfill existing notes with sequential positions ordered by created_at
update public.notes
set position = sub.row_num
from (
  select id, row_number() over (order by created_at asc) as row_num
  from public.notes
) sub
where public.notes.id = sub.id;
