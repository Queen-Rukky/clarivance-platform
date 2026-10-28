-- Clarivance foundation: tenants (businesses), members with roles, activity log.
-- Everything lives in its own `clarivance` schema so it never touches other apps
-- that share this Supabase project. Tenant isolation is enforced here with RLS.

create schema if not exists clarivance;

grant usage on schema clarivance to authenticated, service_role;
revoke all on schema clarivance from anon;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table clarivance.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table clarivance.business_members (
  business_id uuid not null references clarivance.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_idx on clarivance.business_members (user_id);

-- Append-only record of important actions, by a person or by an AI agent.
create table clarivance.activity_log (
  id bigint generated always as identity primary key,
  business_id uuid not null references clarivance.businesses (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_agent text,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_business_created_idx
  on clarivance.activity_log (business_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function clarivance.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger businesses_touch_updated_at
  before update on clarivance.businesses
  for each row execute function clarivance.touch_updated_at();

-- Security definer so policies can check membership without recursing into
-- business_members' own RLS.
create or replace function clarivance.has_business_role(p_business uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from clarivance.business_members m
    where m.business_id = p_business
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles));
$$;

create or replace function clarivance.is_business_member(p_business uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select clarivance.has_business_role(p_business, array['owner', 'admin', 'staff']);
$$;

-- Internal: write a log row. Not executable by clients directly.
create or replace function clarivance.write_activity(
  p_business uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into clarivance.activity_log (business_id, actor_user_id, action, entity_type, entity_id, details)
  values (p_business, (select auth.uid()), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------------
-- RPCs (the only way clients create businesses or change membership)
-- ---------------------------------------------------------------------------

create or replace function clarivance.create_business(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into clarivance.businesses (name, created_by)
  values (btrim(p_name), v_uid)
  returning id into v_id;

  insert into clarivance.business_members (business_id, user_id, role)
  values (v_id, v_uid, 'owner');

  perform clarivance.write_activity(v_id, 'business.created', 'business', v_id::text,
    jsonb_build_object('name', btrim(p_name)));

  return v_id;
end $$;

-- Adds an existing user (they must have signed up) by email.
create or replace function clarivance.add_member_by_email(p_business uuid, p_email text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not clarivance.has_business_role(p_business, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'staff') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if p_role = 'owner' and not clarivance.has_business_role(p_business, array['owner']) then
    raise exception 'only an owner can add another owner' using errcode = '42501';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'no account with that email; ask them to sign up first' using errcode = 'P0002';
  end if;

  insert into clarivance.business_members (business_id, user_id, role)
  values (p_business, v_user, p_role)
  on conflict (business_id, user_id) do nothing;
  if not found then
    raise exception 'already a member' using errcode = '23505';
  end if;

  perform clarivance.write_activity(p_business, 'member.added', 'user', v_user::text,
    jsonb_build_object('role', p_role));
  return v_user;
end $$;

create or replace function clarivance.update_member_role(p_business uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if not clarivance.has_business_role(p_business, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'admin', 'staff') then
    raise exception 'invalid role' using errcode = '22023';
  end if;

  select role into v_current from clarivance.business_members
  where business_id = p_business and user_id = p_user
  for update;
  if v_current is null then
    raise exception 'not a member' using errcode = 'P0002';
  end if;

  if (v_current = 'owner' or p_role = 'owner')
     and not clarivance.has_business_role(p_business, array['owner']) then
    raise exception 'only an owner can change owner roles' using errcode = '42501';
  end if;
  if v_current = 'owner' and p_role <> 'owner' and (
    select count(*) from clarivance.business_members
    where business_id = p_business and role = 'owner') <= 1 then
    raise exception 'a business must keep at least one owner' using errcode = '23514';
  end if;

  update clarivance.business_members set role = p_role
  where business_id = p_business and user_id = p_user;

  perform clarivance.write_activity(p_business, 'member.role_changed', 'user', p_user::text,
    jsonb_build_object('from', v_current, 'to', p_role));
end $$;

-- Owners/admins can remove others; anyone can remove themselves.
create or replace function clarivance.remove_member(p_business uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
  v_self boolean := p_user = (select auth.uid());
begin
  if not v_self and not clarivance.has_business_role(p_business, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select role into v_current from clarivance.business_members
  where business_id = p_business and user_id = p_user
  for update;
  if v_current is null then
    raise exception 'not a member' using errcode = 'P0002';
  end if;

  if v_current = 'owner' and not v_self
     and not clarivance.has_business_role(p_business, array['owner']) then
    raise exception 'only an owner can remove an owner' using errcode = '42501';
  end if;
  if v_current = 'owner' and (
    select count(*) from clarivance.business_members
    where business_id = p_business and role = 'owner') <= 1 then
    raise exception 'a business must keep at least one owner' using errcode = '23514';
  end if;

  delete from clarivance.business_members where business_id = p_business and user_id = p_user;

  perform clarivance.write_activity(p_business, 'member.removed', 'user', p_user::text,
    jsonb_build_object('role', v_current));
end $$;

-- Lets the app log a user action. The actor is always the caller.
create or replace function clarivance.log_activity(
  p_business uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not clarivance.is_business_member(p_business) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  perform clarivance.write_activity(p_business, p_action, p_entity_type, p_entity_id, p_details);
end $$;

-- Member list with emails, visible only to members of that business.
create or replace function clarivance.list_members(p_business uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not clarivance.is_business_member(p_business) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, m.role, m.created_at
    from clarivance.business_members m
    join auth.users u on u.id = m.user_id
    where m.business_id = p_business
    order by m.created_at;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table clarivance.businesses enable row level security;
alter table clarivance.business_members enable row level security;
alter table clarivance.activity_log enable row level security;

create policy "members read their businesses" on clarivance.businesses
  for select to authenticated
  using (clarivance.is_business_member(id));

create policy "owners and admins update their business" on clarivance.businesses
  for update to authenticated
  using (clarivance.has_business_role(id, array['owner', 'admin']))
  with check (clarivance.has_business_role(id, array['owner', 'admin']));

create policy "members read memberships of their businesses" on clarivance.business_members
  for select to authenticated
  using (clarivance.is_business_member(business_id));

create policy "members read their activity log" on clarivance.activity_log
  for select to authenticated
  using (clarivance.is_business_member(business_id));

-- No insert/update/delete policies on business_members or activity_log:
-- changes go through the RPCs above, and the log is append-only.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on all tables in schema clarivance from anon, authenticated;
grant select on clarivance.businesses, clarivance.business_members, clarivance.activity_log to authenticated;
grant update (name) on clarivance.businesses to authenticated;
grant all on all tables in schema clarivance to service_role;
grant usage, select on all sequences in schema clarivance to service_role;

revoke execute on all functions in schema clarivance from public, anon, authenticated;
grant execute on function
  clarivance.has_business_role(uuid, text[]),
  clarivance.is_business_member(uuid),
  clarivance.create_business(text),
  clarivance.add_member_by_email(uuid, text, text),
  clarivance.update_member_role(uuid, uuid, text),
  clarivance.remove_member(uuid, uuid),
  clarivance.log_activity(uuid, text, text, text, jsonb),
  clarivance.list_members(uuid)
to authenticated;
grant execute on all functions in schema clarivance to service_role;

-- New functions in this schema stay private unless granted explicitly.
alter default privileges in schema clarivance revoke execute on functions from public;
