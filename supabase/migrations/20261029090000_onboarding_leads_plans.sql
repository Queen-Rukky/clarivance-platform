-- Onboarding answers, the lead pipeline, outreach drafts, and plans with
-- usage limits. Same rules as before: RLS on every table, every important
-- change written to the activity log.

-- ---------------------------------------------------------------------------
-- Plans (changed only by the server, e.g. a future billing webhook)
-- ---------------------------------------------------------------------------

alter table clarivance.businesses
  add column plan text not null default 'trial' check (plan in ('trial', 'starter', 'growth', 'cancelled')),
  add column trial_ends_at timestamptz not null default (now() + interval '14 days');

-- Leads each plan may hold. Kept in SQL so the database enforces it.
create function clarivance.plan_lead_limit(p_plan text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan
    when 'trial' then 100
    when 'starter' then 1000
    when 'growth' then 10000
    else 0 end;
$$;

-- ---------------------------------------------------------------------------
-- Onboarding answers live on the business profile
-- ---------------------------------------------------------------------------

alter table clarivance.business_profiles
  add column website text not null default '' check (char_length(website) <= 300),
  add column offer text not null default '' check (char_length(offer) <= 2000),
  add column ideal_industries text not null default '' check (char_length(ideal_industries) <= 500),
  add column ideal_locations text not null default '' check (char_length(ideal_locations) <= 500),
  add column company_size text not null default '' check (char_length(company_size) <= 100),
  add column decision_maker text not null default '' check (char_length(decision_maker) <= 200),
  add column lead_sources text[] not null default '{}' check (cardinality(lead_sources) <= 20),
  add column contact_channels text[] not null default '{}' check (cardinality(contact_channels) <= 20),
  add column exclusions text not null default '' check (char_length(exclusions) <= 1000),
  add column qualification_rules text not null default '' check (char_length(qualification_rules) <= 1000),
  add column onboarding_step integer not null default 0 check (onboarding_step between 0 and 6),
  add column onboarding_completed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------

create table clarivance.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references clarivance.businesses (id) on delete cascade,
  contact_name text not null default '' check (char_length(contact_name) <= 200),
  contact_role text not null default '' check (char_length(contact_role) <= 200),
  company text not null default '' check (char_length(company) <= 200),
  website text not null default '' check (char_length(website) <= 300),
  email text not null default '' check (char_length(email) <= 200),
  phone text not null default '' check (char_length(phone) <= 50),
  industry text not null default '' check (char_length(industry) <= 120),
  location text not null default '' check (char_length(location) <= 200),
  source text not null default 'manual'
    check (source in ('manual', 'website_chat', 'whatsapp', 'referral', 'social', 'event', 'import', 'sample')),
  source_detail text not null default '' check (char_length(source_detail) <= 500),
  enquiry text not null default '' check (char_length(enquiry) <= 4000),
  status text not null default 'new'
    check (status in ('new', 'qualified', 'contacted', 'replied', 'meeting_booked', 'won', 'lost')),
  score integer check (score between 0 and 100),
  score_reason text not null default '' check (char_length(score_reason) <= 2000),
  notes text not null default '' check (char_length(notes) <= 8000),
  next_action text not null default '' check (char_length(next_action) <= 500),
  follow_up_on date,
  is_sample boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(btrim(contact_name || company || email || phone)) > 0),
  check (is_sample = (source = 'sample'))
);

create index leads_business_created_idx on clarivance.leads (business_id, created_at desc);
create index leads_business_status_idx on clarivance.leads (business_id, status);
create index leads_business_follow_up_idx on clarivance.leads (business_id, follow_up_on) where follow_up_on is not null;

-- One row each time a lead enters a stage, for honest conversion rates.
create table clarivance.lead_stage_history (
  id bigint generated always as identity primary key,
  business_id uuid not null references clarivance.businesses (id) on delete cascade,
  lead_id uuid not null references clarivance.leads (id) on delete cascade,
  status text not null,
  is_sample boolean not null,
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create index lead_stage_history_business_idx on clarivance.lead_stage_history (business_id, changed_at);

create trigger leads_touch_updated_at before update on clarivance.leads
  for each row execute function clarivance.touch_updated_at();

-- Stamps the creator, enforces the plan's lead limit, records stage changes
-- and logs the important events.
create function clarivance.lead_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_count integer;
begin
  new.created_by := (select auth.uid());
  if not new.is_sample then
    select plan into v_plan from clarivance.businesses where id = new.business_id;
    select count(*) into v_count from clarivance.leads where business_id = new.business_id and not is_sample;
    if v_count >= clarivance.plan_lead_limit(v_plan) then
      raise exception 'lead limit reached for your plan' using errcode = '54000';
    end if;
  end if;
  return new;
end $$;

create function clarivance.lead_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from clarivance.businesses where id = old.business_id) and not old.is_sample then
      perform clarivance.write_activity(old.business_id, 'lead.deleted', 'lead', old.id::text,
        jsonb_build_object('label', left(coalesce(nullif(old.company, ''), nullif(old.contact_name, ''), old.email), 120)));
    end if;
    return null;
  end if;

  v_label := left(coalesce(nullif(new.company, ''), nullif(new.contact_name, ''), nullif(new.email, ''), new.phone), 120);

  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into clarivance.lead_stage_history (business_id, lead_id, status, is_sample, changed_by)
    values (new.business_id, new.id, new.status, new.is_sample, (select auth.uid()));
  end if;

  if new.is_sample then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform clarivance.write_activity(new.business_id, 'lead.created', 'lead', new.id::text,
      jsonb_build_object('label', v_label, 'source', new.source));
  elsif old.status is distinct from new.status then
    perform clarivance.write_activity(new.business_id, 'lead.status_changed', 'lead', new.id::text,
      jsonb_build_object('label', v_label, 'from', old.status, 'to', new.status));
  end if;
  return null;
end $$;

create trigger leads_before_insert before insert on clarivance.leads
  for each row execute function clarivance.lead_before_insert();
create trigger leads_after_change after insert or update or delete on clarivance.leads
  for each row execute function clarivance.lead_after_change();

-- Possible duplicates of one lead: same email, phone digits, website domain
-- or company name in the same business. Runs as the caller, so RLS applies.
create function clarivance.normalize_domain(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(regexp_replace(lower(btrim(p)), '^(https?://)?(www\.)?', ''), '[/?#].*$', ''), '');
$$;

create function clarivance.lead_duplicates(p_lead uuid)
returns table (id uuid, company text, contact_name text, email text, status text, matched_on text)
language sql
stable
set search_path = ''
as $$
  select o.id, o.company, o.contact_name, o.email, o.status,
    case
      when l.email <> '' and lower(o.email) = lower(l.email) then 'email'
      when length(regexp_replace(l.phone, '\D', '', 'g')) >= 7
        and right(regexp_replace(o.phone, '\D', '', 'g'), 10) = right(regexp_replace(l.phone, '\D', '', 'g'), 10) then 'phone'
      when clarivance.normalize_domain(l.website) is not null
        and clarivance.normalize_domain(o.website) = clarivance.normalize_domain(l.website) then 'website'
      else 'company name'
    end
  from clarivance.leads l
  join clarivance.leads o on o.business_id = l.business_id and o.id <> l.id
  where l.id = p_lead
    and (
      (l.email <> '' and lower(o.email) = lower(l.email))
      or (length(regexp_replace(l.phone, '\D', '', 'g')) >= 7
        and right(regexp_replace(o.phone, '\D', '', 'g'), 10) = right(regexp_replace(l.phone, '\D', '', 'g'), 10))
      or (clarivance.normalize_domain(l.website) is not null
        and clarivance.normalize_domain(o.website) = clarivance.normalize_domain(l.website))
      or (btrim(l.company) <> '' and lower(btrim(o.company)) = lower(btrim(l.company)))
    )
  limit 20;
$$;

-- ---------------------------------------------------------------------------
-- Outreach drafts (never sent by Clarivance; the user copies and sends)
-- ---------------------------------------------------------------------------

create table clarivance.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references clarivance.businesses (id) on delete cascade,
  lead_id uuid not null references clarivance.leads (id) on delete cascade,
  channel text not null check (channel in ('email', 'social', 'whatsapp')),
  subject text not null default '' check (char_length(subject) <= 200),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  generated_by text not null default 'template' check (generated_by in ('template', 'ai', 'user')),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index outreach_drafts_lead_idx on clarivance.outreach_drafts (lead_id, created_at desc);

create trigger outreach_drafts_touch_updated_at before update on clarivance.outreach_drafts
  for each row execute function clarivance.touch_updated_at();

create function clarivance.draft_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform clarivance.write_activity(new.business_id, 'draft.created', 'lead', new.lead_id::text,
      jsonb_build_object('channel', new.channel, 'generated_by', new.generated_by));
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'approved' then
    perform clarivance.write_activity(new.business_id, 'draft.approved', 'lead', new.lead_id::text,
      jsonb_build_object('channel', new.channel));
  end if;
  return null;
end $$;

create trigger outreach_drafts_after_change after insert or update on clarivance.outreach_drafts
  for each row execute function clarivance.draft_after_change();

-- ---------------------------------------------------------------------------
-- Sample data and deleting a business
-- ---------------------------------------------------------------------------

-- Loads clearly marked sample leads so a new user can try the pipeline.
-- They are fictional, use reserved example.com addresses, never count
-- toward plan limits, and can be removed in one step.
create function clarivance.load_sample_leads(p_business uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not clarivance.has_business_role(p_business, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from clarivance.leads where business_id = p_business and is_sample) then
    raise exception 'sample leads are already loaded' using errcode = '23505';
  end if;

  insert into clarivance.leads (business_id, contact_name, contact_role, company, website, email, phone, industry,
    location, source, source_detail, enquiry, status, score, score_reason, next_action, follow_up_on, is_sample)
  values
    (p_business, 'Sample: Ada Bello', 'Practice manager', 'Sample Dental Clinic', 'https://dental.example.com', 'ada@dental.example.com', '', 'Healthcare', 'Lagos', 'sample', 'Fictional sample record', 'Asked about setting up WhatsApp replies for 2 branches.', 'qualified', 78, 'Sample score: has a clear need, a budget holder and a timeline.', 'Send a short proposal', current_date + 1, true),
    (p_business, 'Sample: Tunde Okafor', 'Founder', 'Sample Realty', 'https://realty.example.com', 'tunde@realty.example.com', '', 'Real estate', 'Abuja', 'sample', 'Fictional sample record', 'Wants faster replies to property enquiries.', 'contacted', 64, 'Sample score: strong need, budget not confirmed.', 'Follow up on pricing question', current_date, true),
    (p_business, 'Sample: Grace Eze', 'Head of admissions', 'Sample Tutorial Centre', 'https://tutors.example.com', 'grace@tutors.example.com', '', 'Education', 'Port Harcourt', 'sample', 'Fictional sample record', 'Asked for a demo for the admissions team.', 'meeting_booked', 85, 'Sample score: demo booked with the decision maker.', 'Prepare demo', current_date + 3, true),
    (p_business, 'Sample: Musa Ibrahim', 'Owner', 'Sample Events Co', 'https://events.example.com', 'musa@events.example.com', '', 'Events', 'Kano', 'sample', 'Fictional sample record', 'General question about prices.', 'new', null, '', 'Qualify the enquiry', null, true),
    (p_business, 'Sample: Chioma Nwosu', 'Director', 'Sample Beauty Studio', 'https://beauty.example.com', 'chioma@beauty.example.com', '', 'Beauty', 'Lagos', 'sample', 'Fictional sample record', 'Signed up after a trial.', 'won', 90, 'Sample score: converted.', '', null, true),
    (p_business, 'Sample: Ken Adeyemi', 'Manager', 'Sample Logistics', 'https://logistics.example.com', 'ken@logistics.example.com', '', 'Logistics', 'Ibadan', 'sample', 'Fictional sample record', 'Not ready this year.', 'lost', 30, 'Sample score: no budget this year.', '', null, true);
  get diagnostics v_count = row_count;

  perform clarivance.write_activity(p_business, 'sample.loaded', 'lead', null, jsonb_build_object('count', v_count));
  return v_count;
end $$;

create function clarivance.remove_sample_leads(p_business uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not clarivance.has_business_role(p_business, array['owner', 'admin']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from clarivance.leads where business_id = p_business and is_sample;
  get diagnostics v_count = row_count;
  perform clarivance.write_activity(p_business, 'sample.removed', 'lead', null, jsonb_build_object('count', v_count));
  return v_count;
end $$;

-- Permanently deletes a business and everything in it. Owner only, and the
-- exact name must be typed to confirm.
create function clarivance.delete_business(p_business uuid, p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if not clarivance.has_business_role(p_business, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select name into v_name from clarivance.businesses where id = p_business;
  if v_name is distinct from btrim(p_confirm_name) then
    raise exception 'the name you typed does not match' using errcode = '22023';
  end if;
  delete from clarivance.businesses where id = p_business;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table clarivance.leads enable row level security;
alter table clarivance.lead_stage_history enable row level security;
alter table clarivance.outreach_drafts enable row level security;

-- Everyone on the team works leads; only owners and admins delete them.
create policy "members read leads" on clarivance.leads
  for select to authenticated using (clarivance.is_business_member(business_id));
create policy "members add leads" on clarivance.leads
  for insert to authenticated with check (clarivance.is_business_member(business_id) and not is_sample);
create policy "members update leads" on clarivance.leads
  for update to authenticated
  using (clarivance.is_business_member(business_id))
  with check (clarivance.is_business_member(business_id));
create policy "owners and admins delete leads" on clarivance.leads
  for delete to authenticated using (clarivance.has_business_role(business_id, array['owner', 'admin']));

create policy "members read stage history" on clarivance.lead_stage_history
  for select to authenticated using (clarivance.is_business_member(business_id));

create policy "members read drafts" on clarivance.outreach_drafts
  for select to authenticated using (clarivance.is_business_member(business_id));
create policy "members add drafts" on clarivance.outreach_drafts
  for insert to authenticated with check (
    clarivance.is_business_member(business_id)
    and exists (select 1 from clarivance.leads l where l.id = lead_id and l.business_id = outreach_drafts.business_id));
create policy "members update drafts" on clarivance.outreach_drafts
  for update to authenticated
  using (clarivance.is_business_member(business_id))
  with check (clarivance.is_business_member(business_id));
create policy "members delete drafts" on clarivance.outreach_drafts
  for delete to authenticated using (clarivance.is_business_member(business_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on clarivance.leads, clarivance.lead_stage_history, clarivance.outreach_drafts from anon, authenticated;
-- created_by and is_sample are set by the database, not the client.
grant select, delete on clarivance.leads to authenticated;
grant insert (business_id, contact_name, contact_role, company, website, email, phone, industry, location, source,
  source_detail, enquiry, status, score, score_reason, notes, next_action, follow_up_on)
  on clarivance.leads to authenticated;
grant update (contact_name, contact_role, company, website, email, phone, industry, location, source_detail,
  enquiry, status, score, score_reason, notes, next_action, follow_up_on)
  on clarivance.leads to authenticated;
grant select on clarivance.lead_stage_history to authenticated;
grant select, delete on clarivance.outreach_drafts to authenticated;
grant insert (business_id, lead_id, channel, subject, body, generated_by, status) on clarivance.outreach_drafts to authenticated;
grant update (subject, body, status) on clarivance.outreach_drafts to authenticated;
grant all on clarivance.leads, clarivance.lead_stage_history, clarivance.outreach_drafts to service_role;
grant usage, select on all sequences in schema clarivance to service_role;

-- The browser may read the plan but never change it.
revoke update on clarivance.businesses from authenticated;
grant update (name) on clarivance.businesses to authenticated;

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
  clarivance.approved_knowledge(uuid),
  clarivance.plan_lead_limit(text),
  clarivance.normalize_domain(text),
  clarivance.lead_duplicates(uuid),
  clarivance.load_sample_leads(uuid),
  clarivance.remove_sample_leads(uuid),
  clarivance.delete_business(uuid, text)
to authenticated;
grant execute on all functions in schema clarivance to service_role;
