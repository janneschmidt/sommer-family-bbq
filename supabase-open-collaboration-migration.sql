-- Sommer-Family-BBQ: offene Mitbringliste und gemeinsames Gästebuch
-- Einmal vollständig im Supabase SQL Editor ausführen.

begin;

-- Bestehende persönliche Bearbeitungsschlüssel werden nicht mehr benötigt.
alter table public.bbq_contributions
  alter column edit_token_hash drop not null;

drop function if exists public.add_bbq_contribution(text, text, text, text, text);
drop function if exists public.update_bbq_contribution(uuid, text, text, text, text, text);
drop function if exists public.delete_bbq_contribution(uuid, text);

create or replace function public.add_bbq_contribution(
  p_name text,
  p_item text,
  p_category text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.bbq_contributions (name, item, category, note)
  values (trim(p_name), trim(p_item), p_category, coalesce(trim(p_note), ''))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.update_bbq_contribution(
  p_id uuid,
  p_name text,
  p_item text,
  p_category text,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bbq_contributions
  set name = trim(p_name),
      item = trim(p_item),
      category = p_category,
      note = coalesce(trim(p_note), ''),
      updated_at = now()
  where id = p_id;
  return found;
end;
$$;

create or replace function public.delete_bbq_contribution(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bbq_contributions where id = p_id;
  return found;
end;
$$;

revoke all on function public.add_bbq_contribution(text, text, text, text) from public;
revoke all on function public.update_bbq_contribution(uuid, text, text, text, text) from public;
revoke all on function public.delete_bbq_contribution(uuid) from public;
grant execute on function public.add_bbq_contribution(text, text, text, text) to anon;
grant execute on function public.update_bbq_contribution(uuid, text, text, text, text) to anon;
grant execute on function public.delete_bbq_contribution(uuid) to anon;

-- Gästebuch: öffentlich schreiben, lesen und löschen; keine Editierfunktion.
create table if not exists public.bbq_comments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 50),
  message text not null check (char_length(trim(message)) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.bbq_comments enable row level security;
revoke all on table public.bbq_comments from anon, authenticated;

create or replace function public.list_bbq_comments()
returns table (
  id uuid,
  name text,
  message text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.message, c.created_at
  from public.bbq_comments c
  order by c.created_at desc;
$$;

create or replace function public.add_bbq_comment(
  p_name text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.bbq_comments (name, message)
  values (trim(p_name), trim(p_message))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.delete_bbq_comment(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bbq_comments where id = p_id;
  return found;
end;
$$;

revoke all on function public.list_bbq_comments() from public;
revoke all on function public.add_bbq_comment(text, text) from public;
revoke all on function public.delete_bbq_comment(uuid) from public;
grant execute on function public.list_bbq_comments() to anon;
grant execute on function public.add_bbq_comment(text, text) to anon;
grant execute on function public.delete_bbq_comment(uuid) to anon;

commit;
