# Page builder AI model benchmark

Run: 2026-06-11T02:27:55.300Z — 2 repeat(s) per model+task.

Quality scores are deterministic (0–100): schema-valid response, expected
tool usage, tool calls actually applying to the page draft, and proposal
schema/source-reference validity. Read responses/ for the raw outputs.

## Summary (mean per model)

| Model                             | Mean latency (ms) | Mean tokens/s | Mean quality | Errors |
| --------------------------------- | ----------------- | ------------- | ------------ | ------ |
| gemini:gemini-3.1-flash-lite      | 2989              | 109           | 84           | 0      |
| gemini:gemini-3.1-flash-lite#copy | 2476              | 120           | 90           | 0      |
| gemini:gemini-3.5-flash@low#copy  | 6108              | 45            | 87           | 0      |

## Per-run detail

| Model                             | Task             | Run | ms    | Out tokens | tok/s | Score | Notes                                                                 |
| --------------------------------- | ---------------- | --- | ----- | ---------- | ----- | ----- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------- |
| gemini:gemini-3.1-flash-lite      | draft-blank-page | 1   | 5759  | 1226       | 213   | 60    | tools=set_seo_metadata                                                | replace_page_sections applied=2 gate=thin(thin_card_body                 | filler_phrase) words=676 no-message |
| gemini:gemini-3.1-flash-lite      | draft-blank-page | 2   | 11768 | 1075       | 91    | 100   | tools=set_seo_metadata                                                | replace_page_sections applied=2 FALLBACK gate=pass words=698 bullets=6   |
| gemini:gemini-3.1-flash-lite      | hero-rewrite     | 1   | 1074  | 122        | 114   | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=61 no-message |
| gemini:gemini-3.1-flash-lite      | hero-rewrite     | 2   | 1331  | 121        | 91    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=58 no-message |
| gemini:gemini-3.1-flash-lite      | faq-add          | 1   | 3029  | 443        | 146   | 85    | tools=add_block applied=1 gate=pass words=310 no-message              |
| gemini:gemini-3.1-flash-lite      | faq-add          | 2   | 2930  | 452        | 154   | 85    | tools=add_block applied=1 gate=pass words=305 no-message              |
| gemini:gemini-3.1-flash-lite      | seo-metadata     | 1   | 1024  | 95         | 93    | 85    | tools=set_seo_metadata applied=1 words=40 no-message                  |
| gemini:gemini-3.1-flash-lite      | seo-metadata     | 2   | 1070  | 92         | 86    | 85    | tools=set_seo_metadata applied=1 words=39 no-message                  |
| gemini:gemini-3.1-flash-lite      | vague-image-ask  | 1   | 898   | 46         | 51    | 85    | tools=request_clarification applied=1 words=14 no-message             |
| gemini:gemini-3.1-flash-lite      | vague-image-ask  | 2   | 1008  | 48         | 48    | 85    | tools=request_clarification applied=1 words=24 no-message             |
| gemini:gemini-3.1-flash-lite#copy | draft-blank-page | 1   | 10541 | 1209       | 115   | 85    | tools=set_seo_metadata                                                | replace_page_sections applied=2 gate=pass words=656 no-message           |
| gemini:gemini-3.1-flash-lite#copy | draft-blank-page | 2   | 1094  | 101        | 92    | 100   | tools=set_seo_metadata                                                | replace_page_sections applied=2 FALLBACK gate=pass words=701 bullets=6   |
| gemini:gemini-3.1-flash-lite#copy | hero-rewrite     | 1   | 1281  | 135        | 105   | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=71 no-message |
| gemini:gemini-3.1-flash-lite#copy | hero-rewrite     | 2   | 1147  | 114        | 99    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=59 no-message |
| gemini:gemini-3.1-flash-lite#copy | faq-add          | 1   | 2345  | 400        | 171   | 85    | tools=add_block applied=1 gate=pass words=262 no-message              |
| gemini:gemini-3.1-flash-lite#copy | faq-add          | 2   | 2749  | 430        | 156   | 85    | tools=add_block applied=1 gate=pass words=297 no-message              |
| gemini:gemini-3.1-flash-lite#copy | seo-metadata     | 1   | 1036  | 91         | 88    | 85    | tools=set_seo_metadata applied=1 words=40 no-message                  |
| gemini:gemini-3.1-flash-lite#copy | seo-metadata     | 2   | 1007  | 93         | 92    | 85    | tools=set_seo_metadata applied=1 words=40 no-message                  |
| gemini:gemini-3.1-flash-lite#copy | vague-image-ask  | 1   | 1795  | 255        | 142   | 100   | tools=request_clarification applied=1 FALLBACK words=15               |
| gemini:gemini-3.1-flash-lite#copy | vague-image-ask  | 2   | 1769  | 250        | 141   | 100   | tools=request_clarification applied=1 FALLBACK words=15               |
| gemini:gemini-3.5-flash@low#copy  | draft-blank-page | 1   | 13402 | 1135       | 85    | 100   | tools=set_seo_metadata                                                | replace_page_sections applied=2 FALLBACK gate=pass words=696 bullets=6   |
| gemini:gemini-3.5-flash@low#copy  | draft-blank-page | 2   | 13719 | 1231       | 90    | 85    | tools=set_seo_metadata                                                | replace_page_sections applied=2 gate=pass words=658 bullets=4 no-message |
| gemini:gemini-3.5-flash@low#copy  | hero-rewrite     | 1   | 4431  | 104        | 23    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=48 no-message |
| gemini:gemini-3.5-flash@low#copy  | hero-rewrite     | 2   | 4743  | 108        | 23    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=51 no-message |
| gemini:gemini-3.5-flash@low#copy  | faq-add          | 1   | 6236  | 347        | 56    | 85    | tools=add_block applied=1 gate=pass words=224 no-message              |
| gemini:gemini-3.5-flash@low#copy  | faq-add          | 2   | 6001  | 359        | 60    | 85    | tools=add_block applied=1 gate=pass words=229 no-message              |
| gemini:gemini-3.5-flash@low#copy  | seo-metadata     | 1   | 5367  | 195        | 36    | 85    | tools=set_seo_metadata                                                | edit_block_1_block_hero applied=2 words=84 no-message                    |
| gemini:gemini-3.5-flash@low#copy  | seo-metadata     | 2   | 2607  | 90         | 35    | 85    | tools=set_seo_metadata applied=1 words=38 no-message                  |
| gemini:gemini-3.5-flash@low#copy  | vague-image-ask  | 1   | 2687  | 41         | 15    | 85    | tools=request_clarification applied=1 words=20 no-message             |
| gemini:gemini-3.5-flash@low#copy  | vague-image-ask  | 2   | 1885  | 52         | 28    | 85    | tools=request_clarification applied=1 words=26 no-message             |

## Gemini flash models available to this key

- gemini-2.5-flash
- gemini-2.0-flash
- gemini-2.0-flash-001
- gemini-2.0-flash-lite-001
- gemini-2.0-flash-lite
- gemini-2.5-flash-preview-tts
- gemini-flash-latest
- gemini-flash-lite-latest
- gemini-2.5-flash-lite
- gemini-2.5-flash-image
- gemini-3-flash-preview
- gemini-3.1-flash-lite-preview
- gemini-3.1-flash-lite
- gemini-3.1-flash-image-preview
- gemini-3.1-flash-image
- gemini-3.5-flash
- gemini-3.1-flash-tts-preview
