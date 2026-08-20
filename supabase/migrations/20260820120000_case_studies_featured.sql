-- Case studies: featured story flag.
--
-- Drives the featured hero above the index grid. A column rather than a
-- hardcoded slug so Kody can swap the featured member from /admin/case-studies
-- without a deploy.
--
-- The admin editor issues a plain UPDATE, so the trigger below un-features the
-- previous story on the way in. Without it the unique index would reject the
-- second story anyone tried to feature.

alter table public.case_studies
  add column if not exists featured boolean not null default false;

-- The invariant: at most one featured story at a time.
create unique index if not exists case_studies_one_featured
  on public.case_studies (featured)
  where featured;

create or replace function public.case_studies_single_featured()
returns trigger
language plpgsql
as $$
begin
  -- Only rows being set to featured reach here (see the trigger WHEN clause),
  -- and this UPDATE sets featured = false, so it cannot recurse.
  update public.case_studies
     set featured = false
   where featured and id <> new.id;
  return new;
end;
$$;

drop trigger if exists case_studies_single_featured on public.case_studies;
create trigger case_studies_single_featured
  before insert or update of featured on public.case_studies
  for each row
  when (new.featured)
  execute function public.case_studies_single_featured();
