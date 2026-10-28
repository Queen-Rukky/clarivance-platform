-- Team invites by email, and the approved knowledge base the AI agent will
-- answer from: business profile, services with prices, and FAQs.

-- ---------------------------------------------------------------------------
-- Invites
-- ---------------------------------------------------------------------------

create table clarivance.invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references clarivance.businesses (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '_%@_%'),
  role text not null check (role in ('owner', 'admin', 'staff')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, email)
);

create index invites_email_idx on clarivance.invites (email);

alter table clarivance.invites enable row level security;

create policy "owners and admins read invites" on clarivance.invites
  for select to authenticated
  using (clarivance.has_business_role(business_id, array['owner', 'admin']));

-- Adds an existing user right away, or saves an invite that is accepted
-- automatically when someone signs in with that email. Returns 'added' or 'invited'.
drop function clarivance.add_member_by_email(uuid, text, text);

create function clarivance.add_member_by_email(p_business uuid, p_email text, p_role text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
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

  select u.id into v_user from auth.users u where lower(u.email) = v_email;

  if v_user is null then
    insert into clarivance.invites (business_id, email, role, invited_by)
    values (p_business, v_email, p_role, (select auth.uid()))
    on conflict (business_id, email) do update set role = excluded.role;
    perform clarivance.write_activity(p_business, 'member.invited', 'invite', v_email,
      jsonb_build_object('role', p_role));
    return 'invited';
  end if;

  insert into clarivance.business_members (business_id, user_id, role)
  values (p_business, v_user, p_role)
  on conflict (business_id, user_id) do nothing;
  if not found then
    raise exception 'already a member' using errcode = '23505';
  end if;

  perform clarivance.write_activity(p_business, 'member.added', 'user', v_user::text,
    jsonb_build_object('role', p_role));
  return 'added';
end $$;

-- Called after sign-in: turns any invites for the caller's email into memberships.
create function clarivance.accept_my_invites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_count integer := 0;
  r record;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select lower(u.email) into v_email from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then
    return 0;
  end if;

  for r in delete from clarivance.invites where email = v_email returning business_id, role loop
    insert into clarivance.business_members (business_id, user_id, role)
    values (r.business_id, v_uid, r.role)
    on conflict (business_id, user_id) do nothing;
    if found then
      v_count := v_count + 1;
      perform clarivance.write_activity(r.business_id, 'member.joined', 'user', v_uid::text,
        jsonb_build_object('role', r.role));
    end if;
  end loop;

  return v_count;
end $$;

create function clarivance.cancel_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv clarivance.invites;
begin
  select * into v_inv from clarivance.invites where id = p_invite;
  if v_inv.id is null or not clarivance.has_business_role(v_inv.business_id, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from clarivance.invites where id = p_invite;
  perform clarivance.write_activity(v_inv.business_id, 'member.invite_cancelled', 'invite', v_inv.email, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------------

create table clarivance.business_profiles (
  business_id uuid primary key references clarivance.businesses (id) on delete cascade,
  about text not null default '' check (char_length(about) <= 4000),
  location text not null default '' check (char_length(location) <= 300),
  contact_email text not null default '' check (char_length(contact_email) <= 200),
  contact_phone text not null default '' check (char_length(contact_phone) <= 50),
  opening_hours text not null default '' check (char_length(opening_hours) <= 500),
  tone text not null default '' check (char_length(tone) <= 500),
  updated_at timestamptz not null default now()
);

create table clarivance.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references clarivance.businesses (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  -- fixed: exactly price_min; from: price_min or more; range: price_min to price_max;
  -- ask_owner: the agent must never quote a price.
  price_type text not null default 'ask_owner' check (price_type in ('fixed', 'from', 'range', 'ask_owner')),
  price_min numeric(12, 2) check (price_min >= 0),
  price_max numeric(12, 2) check (price_max >= 0),
  currency text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (price_type = 'ask_owner' and price_min is null and price_max is null)
    or (price_type in ('fixed', 'from') and price_min is not null and price_max is null)
    or (price_type = 'range' and price_min is not null and price_max is not null and price_min <= price_max)
  )
);

create index services_business_idx on clarivance.services (business_id, name);

create table clarivance.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references clarivance.businesses (id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 3 and 300),
  answer text not null check (char_length(btrim(answer)) between 1 and 4000),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_items_business_idx on clarivance.knowledge_items (business_id, created_at);

create trigger business_profiles_touch_updated_at before update on clarivance.business_profiles
  for each row execute function clarivance.touch_updated_at();
create trigger services_touch_updated_at before update on clarivance.services
  for each row execute function clarivance.touch_updated_at();
create trigger knowledge_items_touch_updated_at before update on clarivance.knowledge_items
  for each row execute function clarivance.touch_updated_at();

-- Log every knowledge-base change, including approvals.
create function clarivance.log_knowledge_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_business uuid := (v_row ->> 'business_id')::uuid;
  v_kind text := case tg_table_name
    when 'services' then 'service'
    when 'knowledge_items' then 'knowledge'
    else 'profile' end;
  v_action text := v_kind || case tg_op when 'INSERT' then '.created' when 'UPDATE' then '.updated' else '.deleted' end;
  v_label text := coalesce(v_row ->> 'name', v_row ->> 'question');
begin
  -- Rows removed because their business was deleted have nowhere to log to.
  if tg_op = 'DELETE' and not exists (select 1 from clarivance.businesses where id = v_business) then
    return null;
  end if;
  if tg_op = 'UPDATE' and (v_old ->> 'status') is distinct from (v_row ->> 'status') then
    v_action := v_kind || case when v_row ->> 'status' = 'approved' then '.approved' else '.unapproved' end;
  end if;

  perform clarivance.write_activity(
    v_business, v_action, v_kind,
    coalesce(v_row ->> 'id', v_business::text),
    case when v_label is null then '{}'::jsonb else jsonb_build_object('label', left(v_label, 120)) end);
  return null;
end $$;

create trigger services_log after insert or update or delete on clarivance.services
  for each row execute function clarivance.log_knowledge_change();
create trigger knowledge_items_log after insert or update or delete on clarivance.knowledge_items
  for each row execute function clarivance.log_knowledge_change();
create trigger business_profiles_log after insert or update on clarivance.business_profiles
  for each row execute function clarivance.log_knowledge_change();

alter table clarivance.business_profiles enable row level security;
alter table clarivance.services enable row level security;
alter table clarivance.knowledge_items enable row level security;

create policy "members read profile" on clarivance.business_profiles
  for select to authenticated using (clarivance.is_business_member(business_id));
create policy "owners and admins insert profile" on clarivance.business_profiles
  for insert to authenticated with check (clarivance.has_business_role(business_id, array['owner', 'admin']));
create policy "owners and admins update profile" on clarivance.business_profiles
  for update to authenticated
  using (clarivance.has_business_role(business_id, array['owner', 'admin']))
  with check (clarivance.has_business_role(business_id, array['owner', 'admin']));

create policy "members read services" on clarivance.services
  for select to authenticated using (clarivance.is_business_member(business_id));
create policy "owners and admins insert services" on clarivance.services
  for insert to authenticated with check (clarivance.has_business_role(business_id, array['owner', 'admin']));
create policy "owners and admins update services" on clarivance.services
  for update to authenticated
  using (clarivance.has_business_role(business_id, array['owner', 'admin']))
  with check (clarivance.has_business_role(business_id, array['owner', 'admin']));
create policy "owners and admins delete services" on clarivance.services
  for delete to authenticated using (clarivance.has_business_role(business_id, array['owner', 'admin']));

create policy "members read knowledge" on clarivance.knowledge_items
  for select to authenticated using (clarivance.is_business_member(business_id));
create policy "owners and admins insert knowledge" on clarivance.knowledge_items
  for insert to authenticated with check (clarivance.has_business_role(business_id, array['owner', 'admin']));
create policy "owners and admins update knowledge" on clarivance.knowledge_items
  for update to authenticated
  using (clarivance.has_business_role(business_id, array['owner', 'admin']))
  with check (clarivance.has_business_role(business_id, array['owner', 'admin']));
create policy "owners and admins delete knowledge" on clarivance.knowledge_items
  for delete to authenticated using (clarivance.has_business_role(business_id, array['owner', 'admin']));

-- Everything the agent is allowed to say, in one call. Only approved rows.
create function clarivance.approved_knowledge(p_business uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not clarivance.is_business_member(p_business) and (select auth.role()) <> 'service_role' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'business', (select jsonb_build_object('name', b.name) from clarivance.businesses b where b.id = p_business),
    'profile', (select to_jsonb(p) - 'business_id' - 'updated_at' from clarivance.business_profiles p where p.business_id = p_business),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', s.name, 'description', s.description, 'price_type', s.price_type,
        'price_min', s.price_min, 'price_max', s.price_max, 'currency', s.currency) order by s.name)
      from clarivance.services s where s.business_id = p_business and s.status = 'approved'), '[]'::jsonb),
    'faqs', coalesce((
      select jsonb_agg(jsonb_build_object('question', k.question, 'answer', k.answer) order by k.created_at)
      from clarivance.knowledge_items k where k.business_id = p_business and k.status = 'approved'), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on clarivance.invites, clarivance.business_profiles, clarivance.services, clarivance.knowledge_items
  from anon, authenticated;
grant select on clarivance.invites to authenticated;
grant select, insert, update on clarivance.business_profiles to authenticated;
grant select, insert, update, delete on clarivance.services, clarivance.knowledge_items to authenticated;
grant all on clarivance.invites, clarivance.business_profiles, clarivance.services, clarivance.knowledge_items
  to service_role;

revoke execute on all functions in schema clarivance from public, anon, authenticated;
grant execute on function
  clarivance.has_business_role(uuid, text[]),
  clarivance.is_business_member(uuid),
  clarivance.create_business(text),
  clarivance.add_member_by_email(uuid, text, text),
  clarivance.update_member_role(uuid, uuid, text),
  clarivance.remove_member(uuid, uuid),
  clarivance.log_activity(uuid, text, text, text, jsonb),
  clarivance.list_members(uuid),
  clarivance.accept_my_invites(),
  clarivance.cancel_invite(uuid),
  clarivance.approved_knowledge(uuid)
to authenticated;
grant execute on all functions in schema clarivance to service_role;
