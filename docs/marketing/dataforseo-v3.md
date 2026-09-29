# DataForSEO v3 for the /admin/seo command center

Researched 2026-09-28 against the live docs and pricing pages. Prices are USD, post the
2026-07-01 price change ([U-jul26]). Every price cites a source key; the URL list is at the end.
Anything not confirmed on a DataForSEO page is marked UNVERIFIED.

## Account-level facts

- Pay as you go. Minimum payment (top-up) is $50; no monthly subscription ([P-all]).
- The $100/month commitment for Backlinks API and LLM Mentions API was removed on 2026-07-01 ([U-jul26]).
- Same change raised Backlinks, Labs, Content Analysis, Domain Analytics, most Keywords Data and On-Page prices about 20% ([U-jul26]). The prices below are the current ones.
- Limits: 2,000 API calls/minute, 30 simultaneous requests, 100 tasks per task_post call ([D-org-post], [D-bl]).
- Standard queue: charged only at task_post; task_get is free for 30 days; tasks_ready is free, 20 calls/min, lists tasks completed in the last 3 days ([D-org-get], [D-ready]).
- Every response carries a `cost` field; that is the only authoritative per-call number (our client already books it).

## VP volumes used in the math

- Rank job: even ISO weeks 224 keywords, odd weeks 62 primary. 26 x 224 + 26 x 62 = 7,436 SERPs/yr = **620 SERPs/month**.
- Monthly refresh: 224 keywords volume + difficulty; ranked_keywords for 4 domains (vendsoft.com, upflip.com, wendor.ai, vendingpreneurs.com) at limit 1,000.
- 4.33 weeks/month; 2.17 biweekly runs/month.

## 1. Per-family endpoint table

Legend: Std = standard queue (normal priority), Pri = standard queue high priority, Live = live mode.

### SERP API

| Endpoint                                                                                  | What VP gets                                       | Cost per call                                                                                                                                                  | Verdict                               | Reason                                                                   |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| google/organic task_post, tasks_ready, task_get/advanced                                  | Weekly ranks, SERP features, AI Overview citations | Std $0.0006, Pri $0.0012, Live $0.002 per 10-result page; depth 100 = 10 pages: Std $0.006, Pri $0.012, Live $0.02; unused pages refunded [P-organic][H-depth] | Use now (move to Std)                 | Same data as live at 30% of the price; job is weekly, not interactive    |
| google/organic live/advanced (current)                                                    | Same, in ~6 s (3 to 4x longer at depth 100)        | Live $0.02 at depth 100 [H-depth]                                                                                                                              | Keep only for on-demand single checks | 3.3x the Std price                                                       |
| load_async_ai_overview param                                                              | AI Overview text + cited URLs                      | +$0.002 live, +$0.0006 Std; refunded if no async AIO [D-org-live][D-org-post]                                                                                  | Use now                               | Core AEO signal, cheap                                                   |
| stop_crawl_on_match param                                                                 | Stop paging once vendingpreneurs.com appears       | Billed per page crawled until match [D-org-post]                                                                                                               | Use later                             | Saves money but hides competitors below VP; only for supporting keywords |
| people_also_ask_click_depth                                                               | Expanded PAA answers                               | +$0.00015 per click [P-organic]                                                                                                                                | Use later                             | FAQ mining for /resources briefs                                         |
| calculate_rectangles                                                                      | Pixel rank                                         | +1 base price [P-organic]                                                                                                                                      | Skip                                  | Not needed for AEO                                                       |
| Search operators (site:, intitle:...)                                                     | Operator queries                                   | x5 per operator [P-organic]                                                                                                                                    | Skip                                  | No use case                                                              |
| google/ai_mode task_post / live                                                           | Google AI Mode answer + cited sources              | Std $0.0012, Pri $0.0024, Live $0.004 per SERP [P-aimode]                                                                                                      | Use now                               | Direct AEO visibility in Google AI Mode                                  |
| youtube/organic task_post / live                                                          | YouTube rank of VP's 646 videos per keyword        | Std $0.0006, Pri $0.0012, Live $0.002 per 20 results (block_depth); unused refunded [P-yt][D-yt-post]                                                          | Use now                               | Video rank tracking for the channel                                      |
| youtube/video_info, video_subtitles                                                       | Views/likes, transcript                            | Base price x3 [P-yt]                                                                                                                                           | Use later                             | Transcripts feed /resources; views live in YouTube Data API already      |
| youtube/video_comments                                                                    | Comments                                           | Per 20 results [P-yt]                                                                                                                                          | Skip                                  | Low SEO value                                                            |
| google/autocomplete                                                                       | Autocomplete suggestions                           | Std $0.0006, Live $0.002 per request [P-autocomplete]                                                                                                          | Use later                             | Topic ideation; Labs covers it                                           |
| google/news, images, maps, local_finder                                                   | Vertical SERPs                                     | Std $0.0006, Live $0.002 per page [P-news][P-images][P-maps]                                                                                                   | Skip                                  | VP is not local, not news                                                |
| google/jobs, events, finance*\*, dataset*\*, search_by_image, ads_search, ads_advertisers | Vertical SERPs                                     | Base SERP pricing (per [P-serp] index)                                                                                                                         | Skip                                  | No VP use case                                                           |
| bing, yahoo, baidu, naver, seznam organic                                                 | Other engines                                      | Bing Std $0.0006, Live $0.002 per page [P-bing]; others UNVERIFIED                                                                                             | Skip                                  | Google + LLMs dominate VP traffic                                        |
| serp/screenshot, serp/ai_summary                                                          | Page screenshot, LLM summary of a SERP             | UNVERIFIED                                                                                                                                                     | Skip                                  | Not needed                                                               |

### Keywords Data API

| Endpoint                                                                    | What VP gets                                                           | Cost per call                                   | Verdict       | Reason                                           |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------- | ------------- | ------------------------------------------------ |
| google_ads/search_volume (current)                                          | Volume, CPC, competition, 12 months history, up to 1,000 keywords/task | Std $0.06, Live $0.09 per task [P-gads]         | Use now (Std) | Std is 1 to 3 h; monthly job does not care       |
| google_ads/keywords_for_keywords, keywords_for_site, ad_traffic_by_keywords | Ideas, site keywords, ad traffic                                       | $0.06 Std / $0.09 Live per task [P-gads]        | Use later     | Labs suggestions are better for content planning |
| google_trends/explore                                                       | Trend curves incl. YouTube, 5 keywords/task                            | Std $0.0027, Live $0.011 per task [P-gtrends]   | Use later     | search_volume already returns 12 months          |
| dataforseo_trends explore / subregion / demography / merged                 | Proprietary trends                                                     | $0.0012 / $0.0024 / $0.006 per task [P-dtrends] | Skip          | Duplicates above                                 |
| clickstream_data bulk_search_volume / global / dataforseo_search_volume     | Clickstream volume                                                     | $0.012 + $0.00012/item; $0.18/task [P-click]    | Skip          | Google Ads volume is enough at 224 keywords      |
| bing/_ (search*volume, keywords_for*_, performance, audience_estimation)    | Bing keyword data                                                      | Std $0.06, Live $0.09 per task [P-bing-ads]     | Skip          | Bing irrelevant for VP                           |

### DataForSEO Labs (all live, ~2 s)

| Endpoint                                                                                                                                                                                 | What VP gets                         | Cost per call                                | Verdict                    | Reason                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------- | -------------------------- | ------------------------------------------------ |
| bulk_keyword_difficulty (current)                                                                                                                                                        | KD for tracked keywords              | $0.012/task + $0.00012/item [P-labs]         | Use now                    | Cheap, already wired                             |
| ranked_keywords (current)                                                                                                                                                                | Every keyword a competitor ranks for | $0.012 + $0.00012/item [P-labs]              | Use now                    | Gap analysis source                              |
| keyword_suggestions                                                                                                                                                                      | Long-tail containing the seed        | $0.012 + $0.00012/item [P-labs]              | Use now                    | Briefs for the 63 /resources pieces              |
| related_keywords                                                                                                                                                                         | "Searches related to" graph          | $0.012 + $0.00012/item [P-labs]              | Use now                    | Cluster planning, same brief job                 |
| search_intent                                                                                                                                                                            | Intent label per keyword             | $0.012 + $0.00012/keyword [P-labs]           | Use now                    | Map intent to page type; pennies                 |
| historical_serps                                                                                                                                                                         | Past monthly SERP snapshots          | $0.00012 per SERP-month [P-labs]             | Use now (one-off backfill) | 12 months of history for 62 keywords for $0.09   |
| historical_rank_overview                                                                                                                                                                 | Monthly domain rank/traffic history  | $0.12/task + $0.0012 per month item [P-labs] | Use later (one-off)        | Competitor trend line; 10x Labs base price       |
| keyword*ideas, keyword_overview, keywords_for_site, keywords_for_categories, categories_for*\*                                                                                           | Keyword research variants            | $0.012 + $0.00012/item [P-labs]              | Use later                  | Overlap with suggestions                         |
| competitors_domain, serp_competitors, domain_intersection, page_intersection, relevant_pages, subdomains, domain_rank_overview, top_searches, available_history, historical_keyword_data | Competitive intel                    | $0.012 + $0.00012/item [P-labs]              | Use later                  | ranked_keywords rows let us compute gaps locally |
| bulk_traffic_estimation, historical_bulk_traffic_estimation, domain_metrics_by_categories                                                                                                | Traffic estimates                    | $0.12/task + $0.0012/domain [P-labs]         | Skip                       | 10x price, low decision value                    |
| include_clickstream_data param                                                                                                                                                           | Clickstream-adjusted metrics         | Cost x2 [P-labs]                             | Skip                       | Not worth double                                 |
| amazon/_, apple/_, google_play/\*, app keyword endpoints                                                                                                                                 | Marketplace/app research             | $0.012 + $0.00012/item [P-labs-amz]          | Skip                       | VP sells no products/apps there                  |

### Domain Analytics

| Endpoint                                                                                         | What VP gets                    | Cost per call                       | Verdict | Reason           |
| ------------------------------------------------------------------------------------------------ | ------------------------------- | ----------------------------------- | ------- | ---------------- |
| technologies/\* (domain_technologies, aggregation, by_technology, by_html_terms, summary, stats) | Competitor tech stack           | $0.012/task + $0.0012/item [P-tech] | Skip    | Not an SEO lever |
| whois/overview                                                                                   | Whois + SERP metrics per domain | $0.12/task + $0.0012/item [P-whois] | Skip    | No use case      |

### Merchant API

| Endpoint                                                        | What VP gets    | Cost per call                                                    | Verdict | Reason                      |
| --------------------------------------------------------------- | --------------- | ---------------------------------------------------------------- | ------- | --------------------------- |
| amazon/products, asin, sellers                                  | Amazon listings | Std $0.0015, Pri $0.003, Live $0.005 per product/SERP [P-amz]    | Skip    | VP is education, not retail |
| google/products, product_info, sellers, reviews, sellers/ad_url | Google Shopping | Std $0.001 per product/seller; reviews $0.00075 per 10 [P-gshop] | Skip    | Same                        |

### On-Page API

| Endpoint                                                                                                                                          | What VP gets                                  | Cost per call                                                                       | Verdict   | Reason                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------- | --------- | ---------------------------------------------------- |
| instant_pages                                                                                                                                     | One-page audit (meta, headings, links, speed) | $0.00015/page basic; JS x9 extra; browser render x33 extra [P-onpage]               | Use now   | Audit each /resources page after publish for pennies |
| content_parsing/live                                                                                                                              | Structured text, headings, links of any URL   | Same as instant_pages, $0.00015/page [P-onpage][D-parse]                            | Use now   | Parse top-3 competitor pages for briefs              |
| task*post crawl + summary, pages, links, resources, duplicate*\*, redirect_chains, non_indexable, microdata, keyword_density, waterfall, raw_html | Full site crawl                               | $0.00015/page basic; load resources $0.00045; JS $0.0015; render $0.0051 [P-onpage] | Use later | Quarterly full crawl; ~500 pages = $0.08 basic       |
| page_screenshot                                                                                                                                   | Screenshot                                    | $0.0048/page [P-onpage]                                                             | Skip      | Not needed                                           |
| lighthouse task_post / live                                                                                                                       | Lighthouse report                             | $0.005/page, Std and Live same [P-lh]                                               | Skip      | Free PageSpeed/Vercel covers it                      |

### Content Analysis API (all live)

| Endpoint                                                                | What VP gets                                      | Cost per call                                                    | Verdict   | Reason                                             |
| ----------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- | --------- | -------------------------------------------------- |
| search                                                                  | Web citations of "vendingpreneurs" with sentiment | $0.024/request + $0.000036/row [P-ca]                            | Use later | Brand monitoring; LLM Mentions is the AEO priority |
| summary                                                                 | Aggregate citation counts, sentiment, top domains | $0.024 + rows [P-ca]                                             | Use later | Same                                               |
| sentiment_analysis, rating_distribution, phrase_trends, category_trends | Trend/sentiment slices                            | $0.024 + rows; rating_distribution +18.2% vs old [P-ca][U-jul26] | Skip      | Dashboard vanity                                   |

### Business Data API

| Endpoint                                                    | What VP gets                    | Cost per call                                                                       | Verdict                                               | Reason                                    |
| ----------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| google/my_business_info                                     | GBP profile, rating, categories | Std $0.0015, Pri $0.003, Live $0.0054 per profile [P-gmb]                           | Skip unless VP has a GBP (UNVERIFIED whether it does) | Not a local business                      |
| google/reviews, extended_reviews                            | Google reviews                  | Std $0.00075 per 10 reviews; extended $0.00075/task + $0.0015 with keyword [P-grev] | Skip (same condition)                                 | Trustpilot/testimonials live elsewhere    |
| google/my*business_updates, questions_and_answers, hotel*\* | GBP posts, Q&A, hotels          | Updates Std $0.0015 + $0.00075/10; Q&A Std $0.00075/10 [P-gmb][P-gqa]               | Skip                                                  | No use case                               |
| trustpilot/_, tripadvisor/_                                 | Third-party reviews             | See [P-bd] subpages                                                                 | Use later if VP has a Trustpilot page                 | Reputation widget                         |
| business_listings/search, categories_aggregation            | POI data                        | $0.012/task + $0.00036/item [P-bl]                                                  | Skip                                                  | Could size vending locations, but not SEO |
| social_media (pinterest etc.)                               | Social counts                   | UNVERIFIED                                                                          | Skip                                                  | Not SEO                                   |

### Backlinks API (all live; no commitment since 2026-07-01)

| Endpoint                                                                              | What VP gets                                              | Cost per call                                          | Verdict            | Reason                                        |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ | ------------------ | --------------------------------------------- |
| summary                                                                               | Backlinks, referring domains, rank, spam score per domain | $0.024/request + $0.000036/row [P-bl-api]              | Use now            | Monthly authority line for VP + 3 competitors |
| timeseries_summary, timeseries_new_lost_summary, history                              | Link growth over time                                     | Same pricing [P-bl-api]                                | Use now (new_lost) | Detect link wins/losses monthly               |
| backlinks, referring_domains, anchors, domain_pages(\_summary), referring_networks    | Raw link lists                                            | $0.024 + $0.000036/row (1,000 rows = $0.06) [P-bl-api] | Use later          | Outreach lists when link building starts      |
| competitors, domain_intersection, page_intersection                                   | Link gap                                                  | Same [P-bl-api]                                        | Use later          | Link-gap outreach, quarterly                  |
| bulk*\* (ranks, backlinks, referring_domains, spam_score, new_lost*\*, pages_summary) | Many targets per call                                     | Same [P-bl-api]                                        | Use later          | Only if tracking many domains                 |

### App Data API

| Endpoint                                                         | What VP gets   | Cost per call                                                                | Verdict | Reason        |
| ---------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------- | ------- | ------------- |
| apple/_ and google/_ app_info, reviews, searches, list, listings | App store data | Std $0.0006/result info; listings $0.1/task + $0.001/item [P-apple][P-gplay] | Skip    | VP has no app |

### AI Optimization API

| Endpoint                                                                             | What VP gets                                                             | Cost per call                                                                       | Verdict                  | Reason                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------- |
| llm_mentions/search_mentions                                                         | Prompts/answers across LLMs that mention VP or competitors, with sources | $0.1/request + $0.001/row [P-llmm]                                                  | Use now                  | The AEO share-of-voice feed                                     |
| llm_mentions/target_metrics, multi_target_metrics (+ \_lite)                         | Mention counts, AI search volume, per platform                           | $0.1 + $0.001/row [P-llmm]; lite price UNVERIFIED                                   | Use now                  | One monthly VP-vs-competitors scoreboard                        |
| llm_mentions/top_mentioned_domains, \_pages, \_brands, \_brand_categories (+ \_lite) | Which sources LLMs cite for vending topics                               | $0.1 + $0.001/row [P-llmm]                                                          | Use now (pages, monthly) | Tells us which VP pages earn citations                          |
| llm_mentions/historical, timeseries_delta, timeseries_new_lost                       | Mention trends                                                           | $0.1 + $0.001/row [P-llmm]                                                          | Use later                | Our own monthly snapshots build the trend                       |
| chat_gpt/llm_scraper, gemini/llm_scraper (task_post, live advanced/html)             | The consumer ChatGPT/Gemini answer with citations for our prompt panel   | Std $0.0012, Pri $0.0024, Live $0.004 per results page [P-llms]                     | Use now (Std)            | Closest to what users actually see; cheapest AEO probe          |
| chat_gpt, claude, gemini llm_responses (task_post, live)                             | API model answer to our prompt                                           | Live $0.0006 + LLM token cost; Std $0.0002 + $0.01 prepay, excess refunded [P-llmr] | Use now for Claude only  | Only way to probe Claude; token cost UNVERIFIED                 |
| perplexity/llm_responses/live                                                        | Sonar answer with web search                                             | Live $0.0006 + LLM token cost [P-llmr]; live only per docs index                    | Use now                  | Perplexity cites sources, good AEO probe; token cost UNVERIFIED |
| ai_keyword_data/keywords_search_volume                                               | Estimated AI-tool search volume + 12-month trend                         | $0.01/task + $0.0001/keyword [P-aikw]                                               | Use now                  | Prioritize AEO keywords; pennies                                |

## 2. Status codes ([D-errors])

| Code                         | Meaning (docs)                                                     | Retryable         | Notes                                                                                   |
| ---------------------------- | ------------------------------------------------------------------ | ----------------- | --------------------------------------------------------------------------------------- |
| 40101                        | Internal SE Server Error: the search engine errored on our request | Yes               | Retry once after a short delay (client does this)                                       |
| 40106                        | Task completed with partial results; unparsed pages not charged    | No, use the data  | Task-level code that carries a `result`. Docs example: asked 100, got 80, billed for 80 |
| 40202                        | Rate limit per minute exceeded (2,000/min)                         | Yes, with backoff | Client does NOT treat it as transient today                                             |
| 40209                        | Too many simultaneous queries (limit 30)                           | Yes, with backoff | Client does NOT treat it as transient today                                             |
| 50000                        | Internal Error: unexpected condition, "contact support"            | Yes, once         | Persisting = support ticket                                                             |
| 50301                        | 3rd Party API Service Unavailable (e.g. Google Ads API)            | Yes, with backoff | Common on keywords_data/google_ads                                                      |
| Related: 40103               | Task execution failed, resubmit                                    | Yes               | Docs say resubmit                                                                       |
| Related: 50401 / 50402       | Live task >120 s / target page >50 s                               | Yes               |                                                                                         |
| Related: 40200, 40203, 40210 | Payment required / cost limit / insufficient funds                 | No                | Budget alarm                                                                            |

Findings in our code (`src/lib/dataforseo/client.ts`, not edited):

- `post()` throws on any task `status_code !== 20000`, so a 40106 partial SERP is discarded AND `onCost` never runs, so money spent is not booked against the $25 cap. Accept 40106 as success and book cost before any task-level throw.
- `isTransient()` covers 40101 and >= 50000 only; add 40103, 40202, 40209.
- UNVERIFIED: which HTTP status accompanies 40202/40209 (top-level JSON code vs HTTP 429).

## 3. Ranked build list for /admin/seo

Rank = AEO/SEO decision value per dollar. Monthly $ uses list prices at worst case (no refunds) unless stated.

| #   | Endpoint                                                                                                                                                          | Volume                                   | Math                                                                                                        | $/month | Cumulative |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| 1   | serp/google/organic task_post, depth 100, async AIO (Std)                                                                                                         | 620 SERPs                                | 620 x (10 x $0.0006 + $0.0006) = 620 x $0.0066 [H-depth][D-org-post]                                        | 4.09    | 4.09       |
| 2   | Existing monthly: google_ads/search_volume (Std) + bulk_keyword_difficulty + ranked_keywords x4                                                                   | 224 kw; 4 domains x 1,000                | $0.06 + ($0.012 + 224 x $0.00012) + 4 x ($0.012 + 1,000 x $0.00012) = 0.06 + 0.039 + 0.528 [P-gads][P-labs] | 0.63    | 4.72       |
| 3   | serp/google/ai_mode task_post (Std)                                                                                                                               | 62 primary weekly = 268                  | 268 x $0.0012 [P-aimode]                                                                                    | 0.32    | 5.04       |
| 4   | ai_optimization/llm_mentions: search_mentions weekly (VP, 100 rows) + multi_target_metrics monthly (4 targets, ~20 rows) + top_mentioned_pages monthly (100 rows) | 6.33 requests, ~553 rows                 | 6.33 x $0.1 + 553 x $0.001 [P-llmm]                                                                         | 1.19    | 6.23       |
| 5   | chat_gpt + gemini llm_scraper task_post (Std)                                                                                                                     | 25-prompt panel x 2 engines weekly = 217 | 217 x $0.0012 [P-llms]                                                                                      | 0.26    | 6.49       |
| 6   | claude + perplexity llm_responses                                                                                                                                 | 25 prompts x 2 engines biweekly = 109    | 109 x ($0.0006 + ~$0.02 token/web-search budget, UNVERIFIED) [P-llmr]                                       | 2.25    | 8.74       |
| 7   | serp/youtube/organic task_post (Std), block_depth 40                                                                                                              | 62 keywords weekly = 268                 | 268 x 2 x $0.0006 [P-yt]                                                                                    | 0.32    | 9.06       |
| 8   | ai_keyword_data/keywords_search_volume                                                                                                                            | 224 kw monthly                           | $0.01 + 224 x $0.0001 [P-aikw]                                                                              | 0.03    | 9.09       |
| 9   | labs search_intent                                                                                                                                                | 224 kw monthly                           | $0.012 + 224 x $0.00012 [P-labs]                                                                            | 0.04    | 9.13       |
| 10  | labs keyword_suggestions + related_keywords (limit 100) for new briefs                                                                                            | 15 seeds/month x 2                       | 30 x ($0.012 + 100 x $0.00012) [P-labs]                                                                     | 0.72    | 9.85       |
| 11  | on_page content_parsing (top 3 competitor URLs per brief) + instant_pages (new /resources pages)                                                                  | 45 + 15 pages                            | 60 x $0.00015 [P-onpage]                                                                                    | 0.01    | 9.86       |
| 12  | backlinks summary x4 + timeseries_new_lost_summary (VP, 12 rows)                                                                                                  | 5 requests                               | 5 x $0.024 + ~16 rows x $0.000036 [P-bl-api]                                                                | 0.12    | 9.98       |

One-off backfills (first month only):

- labs historical_serps: 62 keywords x 12 months = 744 x $0.00012 = $0.09 [P-labs].
- labs historical_rank_overview: 4 domains x ($0.12 + 12 x $0.0012) = $0.54 [P-labs].
- labs keyword_suggestions + related_keywords for all 63 planned pieces: 126 x $0.024 = $3.02 [P-labs].
- First month total: $9.98 + $3.65 = **$13.63**.

Verdict on the cap:

- Steady state **~$10/month**, first month ~$14. Fits $25 with ~$15 headroom. **Keep the $25 cap.**
- Headroom covers the biggest unknown (row 6 LLM token cost could be 2 to 3x the estimate) and ad-hoc live checks.
- If the rank job stays on live: row 1 becomes 620 x ($0.02 + $0.002) = $13.64, steady state ~$19.5. Still fits, little margin.
- Observed live cost is ~$0.013/call (API `cost` field), below the $0.022 list because short SERPs and missing AIOs are refunded ([H-depth], [D-org-live]). Expect Std at about 0.6 x $0.0066 = ~$0.004/call, so row 1 is likely ~$2.40.

Not in the list (Use later): content_analysis summary ($0.12/month weekly), google_trends Std ($0.12/month for 45 tasks), full On-Page crawl quarterly (~$0.08), backlinks link-gap lists (~$0.06 per 1,000 rows).

## 4. Moving the weekly rank job to the standard queue

Cost:

- Live today: list $0.022/SERP, observed ~$0.013. 620 SERPs = $13.64 list / ~$8.06 observed per month.
- Std: list $0.0066/SERP (10 pages x $0.0006 + AIO $0.0006) [H-depth][D-org-post]. 620 SERPs = $4.09 list / ~$2.40 expected. **Saves $4 to $9.50/month (70%).**
- Priority queue ($0.0126/SERP with AIO) is not worth it for a weekly job.

Latency:

- Std turnaround 5 min average, target 45 min, "extended processing may occur" [P-organic]. Live is ~6 s per page, 3 to 4x longer at depth 100 [H-depth].
- The Monday job does not need same-minute data; results sit free for 30 days [D-org-get].

Shape (smallest change):

- Monday cron: task_post in batches of 100 (224 keywords = 3 calls), `tag` = keyword id, `depth: 100`, `load_async_ai_overview: true`.
- Collector cron every 15 min for 3 hours: tasks_ready (lists 3 days, 1,000 per call, 20 calls/min) then task_get/advanced per id; write snapshots; stop when all ids collected. Skip pingback_url for now (needs a public endpoint + auth; add if polling gets noisy).
- Book `cost` from the task_post response (charged at post, not at get) [D-org-post].
- Accept 40106 at task_get as usable partial data.
- Keep a live fallback only for the admin "check now" button.
- Same queue pattern works for ai_mode, youtube/organic, llm_scraper, and google_ads/search_volume (Std 1 to 3 h, $0.06 vs $0.09) [P-gads].

## UNVERIFIED

- Token pass-through cost of llm_responses for Claude and Perplexity (depends on model and web search; response field `money_spent` reports it) [P-llmr].
- Prices of llm_mentions \*\_lite endpoints, serp/screenshot, serp/ai_summary, social_media, Yahoo/Baidu/Naver/Seznam organic.
- Whether Vendingpreneurs has a Google Business Profile or Trustpilot page (decides Business Data verdicts).
- HTTP status paired with 40202/40209.
- Pricing conflict: the 2025-09 update announced 25% off pages 2+ ([U-depth]); the FAQ updated 2026-07-02 shows flat 10 x base ([H-depth]). This doc uses the flat (higher) figure. The `cost` field settles it on the first Std run.

## Sources

- [P-all] https://dataforseo.com/pricing
- [U-jul26] https://dataforseo.com/update/pricing-update-in-dataforseo-apis
- [U-depth] https://dataforseo.com/update/lower-cost-for-google-organic-serp-api
- [H-depth] https://dataforseo.com/help-center/serp-api-pricing-depth-update-faq
- [P-serp] https://dataforseo.com/pricing/serp
- [P-organic] https://dataforseo.com/pricing/google-serp/google-organic-serp-api
- [P-aimode] https://dataforseo.com/pricing/google-serp/google-ai-mode-serp-api
- [P-yt] https://dataforseo.com/pricing/serp/youtube-serp-api
- [P-autocomplete] https://dataforseo.com/pricing/google-serp/google-autocomplete-serp-api
- [P-news] https://dataforseo.com/pricing/google-serp/google-news-serp-api
- [P-images] https://dataforseo.com/pricing/google-serp/google-images-serp-api
- [P-maps] https://dataforseo.com/pricing/google-serp/google-maps-serp-api
- [P-bing] https://dataforseo.com/pricing/serp/bing-organic-serp-api
- [P-gads] https://dataforseo.com/pricing/keywords-data/google-ads
- [P-gtrends] https://dataforseo.com/pricing/keywords-data/google-trends
- [P-dtrends] https://dataforseo.com/pricing/keywords-data/dataforseo-trends-api-pricing
- [P-click] https://dataforseo.com/pricing/keywords-data/clickstream-api-pricing
- [P-bing-ads] https://dataforseo.com/pricing/keywords-data/bing-ads
- [P-labs] https://dataforseo.com/pricing/dataforseo-labs/dataforseo-google-api
- [P-labs-amz] https://dataforseo.com/pricing/dataforseo-labs/dataforseo-amazon-api
- [P-tech] https://dataforseo.com/pricing/domain-analytics-api/domain-technologies-api
- [P-whois] https://dataforseo.com/pricing/domain-analytics-api/domain-analytics-whois-api
- [P-amz] https://dataforseo.com/pricing/merchant/amazon-api
- [P-gshop] https://dataforseo.com/pricing/merchant/google-shopping-api
- [P-onpage] https://dataforseo.com/pricing/on-page/onpage-api
- [P-lh] https://dataforseo.com/pricing/on-page/lighthouse-api
- [P-ca] https://dataforseo.com/pricing/content-analysis-api/content-analysis
- [P-bd] https://dataforseo.com/pricing/business-data
- [P-gmb] https://dataforseo.com/pricing/business-data/business-data-api
- [P-grev] https://dataforseo.com/pricing/business-data/google-reviews-api
- [P-gqa] https://dataforseo.com/pricing/business-data/google-questions-and-answers-api-pricing
- [P-bl] https://dataforseo.com/pricing/business-data/business-listings-api
- [P-bl-api] https://dataforseo.com/pricing/backlinks/backlinks
- [P-apple] https://dataforseo.com/pricing/app-data/app-store
- [P-gplay] https://dataforseo.com/pricing/app-data/google-play
- [P-llmm] https://dataforseo.com/pricing/ai-optimization/llm-mentions
- [P-llmr] https://dataforseo.com/pricing/ai-optimization/llm-responses
- [P-llms] https://dataforseo.com/pricing/ai-optimization/llm-scraper
- [P-aikw] https://dataforseo.com/pricing/ai-optimization/ai-keyword-search-volume
- [D-errors] https://docs.dataforseo.com/v3/appendix/errors/
- [D-org-post] https://docs.dataforseo.com/v3/serp/google/organic/task_post/
- [D-org-live] https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/
- [D-org-get] https://docs.dataforseo.com/v3/serp/google/organic/task_get/advanced/
- [D-ready] https://docs.dataforseo.com/v3/serp/google/organic/tasks_ready/
- [D-yt-post] https://docs.dataforseo.com/v3/serp/youtube/organic/task_post/
- [D-parse] https://docs.dataforseo.com/v3/on_page/content_parsing/live/
- [D-bl] https://docs.dataforseo.com/v3/backlinks/overview/
