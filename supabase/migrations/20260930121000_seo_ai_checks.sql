-- AI and YouTube visibility, one row per engine per query per check day:
-- Google AI Mode, ChatGPT, YouTube search (weekly) and DataForSEO's LLM
-- Mentions index (monthly). Written by seo-ai-sync.ts (connector
-- dataforseo-ai). Service-role only (RLS on, no policies).

create table if not exists public.seo_ai_checks (
  day             date    not null,
  engine          text    not null,  -- ai_mode | chatgpt | youtube | mention:<platform>
  query           text    not null,
  cites_site      boolean not null default false,
  cites_youtube   boolean not null default false,
  mentions_vp     boolean not null default false,
  -- YouTube only: rank of the first VP video (null = not in the top 40).
  vp_position     integer,
  -- Hosts the answer cited, in order, so competitor share can be counted.
  cited_hosts     text[]  not null default '{}',
  synced_at       timestamptz not null default now(),
  primary key (day, engine, query)
);

alter table public.seo_ai_checks enable row level security;

comment on table public.seo_ai_checks is
  'AI answer and YouTube visibility per engine/query/day (AI Mode, ChatGPT, YouTube, LLM Mentions). Written by seo-ai-sync.ts, connector dataforseo-ai. Service-role only.';
