-- Campaign tracking links: one per campaign, stores click counter + confirmed contacts
create table if not exists campaign_tracking_links (
  id                 uuid primary key default gen_random_uuid(),
  token              text unique not null
                       default left(replace(gen_random_uuid()::text, '-', ''), 8),
  campaign_id        text not null,
  campaign_name      text,
  platform           text not null,                         -- 'meta' | 'google'
  company_id         uuid references companies(id) on delete set null,
  whatsapp_url       text not null,                         -- wa.me/... redirect target
  link_clicks        integer not null default 0,            -- auto-incremented on each click
  last_click_at      timestamptz,
  confirmed_contacts integer not null default 0,            -- manually entered by the agency
  notes              text,
  created_at         timestamptz default now(),
  auth_user_id       uuid default auth.uid()
);

alter table campaign_tracking_links enable row level security;

create policy "users_manage_own_tracking_links" on campaign_tracking_links
  for all using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Atomic click increment — called by the public track edge function via service role
create or replace function increment_campaign_click(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
begin
  update campaign_tracking_links
  set
    link_clicks   = link_clicks + 1,
    last_click_at = now()
  where token = p_token
  returning whatsapp_url into v_url;
  return v_url;
end;
$$;
