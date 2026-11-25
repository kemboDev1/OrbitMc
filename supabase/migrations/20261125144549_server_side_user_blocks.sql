create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_id_idx
  on public.user_blocks (blocked_id, blocker_id);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can view their own blocks" on public.user_blocks;
create policy "Users can view their own blocks"
  on public.user_blocks for select to authenticated
  using ((select auth.uid()) = blocker_id);

drop policy if exists "Users can block other profiles" on public.user_blocks;
create policy "Users can block other profiles"
  on public.user_blocks for insert to authenticated
  with check ((select auth.uid()) = blocker_id and blocker_id <> blocked_id);

drop policy if exists "Users can unblock their own blocks" on public.user_blocks;
create policy "Users can unblock their own blocks"
  on public.user_blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id);

revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.reject_blocked_direct_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> new.sender_id then
    raise exception using errcode = '42501', message = 'Direct message not allowed';
  end if;
  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = new.recipient_id and b.blocked_id = new.sender_id)
       or (b.blocker_id = new.sender_id and b.blocked_id = new.recipient_id)
  ) then
    raise exception using errcode = '42501', message = 'Direct message not allowed';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_blocked_direct_message() from public, anon, authenticated;

drop trigger if exists reject_blocked_direct_message on public.direct_messages;
create trigger reject_blocked_direct_message
  before insert on public.direct_messages
  for each row execute function private.reject_blocked_direct_message();
