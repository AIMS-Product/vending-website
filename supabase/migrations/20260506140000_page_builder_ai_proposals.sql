-- SEO Page Builder Slice 9 — source-bound AI proposal records.
--
-- Proposals are stored as structured JSON. They cannot mutate drafts until an
-- admin explicitly accepts selected, schema-valid, source-supported blocks.

create table public.ai_page_proposals (
  id                            uuid primary key default gen_random_uuid(),
  page_id                       uuid not null references public.seo_pages(id),
  status                        text not null default 'proposed'
                                check (status in ('proposed', 'accepted', 'discarded')),
  model                         text not null,
  prompt_version                text not null,
  selected_source_document_ids  uuid[] not null default '{}'::uuid[],
  selected_source_excerpt_ids   uuid[] not null default '{}'::uuid[],
  selected_approved_claim_ids   uuid[] not null default '{}'::uuid[],
  proposal_json                 jsonb not null,
  warnings                      jsonb not null default '[]'::jsonb,
  accepted_block_ids            text[] not null default '{}'::text[],
  created_by                    uuid,
  accepted_by                   uuid,
  accepted_at                   timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index ai_page_proposals_page_created_idx
  on public.ai_page_proposals (page_id, created_at desc);

create index ai_page_proposals_status_idx
  on public.ai_page_proposals (status, created_at desc);

create trigger ai_page_proposals_set_updated_at
  before update on public.ai_page_proposals
  for each row execute function public.set_updated_at();

alter table public.ai_page_proposals enable row level security;

create policy ai_page_proposals_admin_all
  on public.ai_page_proposals
  for all
  to authenticated
  using (exists (select 1 from public.app_users u where u.user_id = auth.uid()))
  with check (exists (select 1 from public.app_users u where u.user_id = auth.uid()));
