-- New Kinlume tables only. This does not import or modify local SQLite records.
begin;
create table public.kinlume_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object')
);
create table public.kinlume_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  version integer not null default 0 check (version >= 0)
);
create table public.kinlume_rate_limits (
  bucket text not null,
  window_start bigint not null,
  requests integer not null,
  primary key (bucket, window_start)
);
-- Only the server may access these tables. Ownership is enforced by the API.
alter table public.kinlume_profiles enable row level security;
alter table public.kinlume_workspaces enable row level security;
alter table public.kinlume_rate_limits enable row level security;
revoke all on public.kinlume_profiles, public.kinlume_workspaces, public.kinlume_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.kinlume_profiles, public.kinlume_workspaces, public.kinlume_rate_limits to service_role;

create function public.kinlume_rate_limit(bucket_name text, max_requests integer, window_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare w bigint; n integer;
begin
  if length(bucket_name) > 160 or max_requests < 1 or max_requests > 1000 or window_seconds < 1 or window_seconds > 3600 then
    raise exception 'Invalid limit';
  end if;
  w := floor(extract(epoch from now()) / window_seconds)::bigint * window_seconds;
  delete from public.kinlume_rate_limits where window_start < extract(epoch from now()) - 7200;
  insert into public.kinlume_rate_limits(bucket, window_start, requests) values(bucket_name,w,1)
  on conflict(bucket,window_start) do update set requests = public.kinlume_rate_limits.requests + 1 returning requests into n;
  return n <= max_requests;
end $$;
revoke all on function public.kinlume_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.kinlume_rate_limit(text,integer,integer) to service_role;
commit;
