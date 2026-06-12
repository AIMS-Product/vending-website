# Page builder AI model benchmark

Run: 2026-06-11T02:19:10.980Z — 2 repeat(s) per model+task.

Quality scores are deterministic (0–100): schema-valid response, expected
tool usage, tool calls actually applying to the page draft, and proposal
schema/source-reference validity. Read responses/ for the raw outputs.

## Summary (mean per model)

| Model                             | Mean latency (ms) | Mean tokens/s | Mean quality | Errors |
| --------------------------------- | ----------------- | ------------- | ------------ | ------ |
| gemini:gemini-3.1-flash-lite      | 2848              | 117           | 85           | 0      |
| gemini:gemini-3.1-flash-lite#copy | 2713              | 133           | 86           | 0      |
| gemini:gemini-3.5-flash@low#copy  | 6366              | 38            | 83           | 0      |

## Per-run detail

| Model                             | Task             | Run | ms    | Out tokens | tok/s | Score | Notes                                                                 |
| --------------------------------- | ---------------- | --- | ----- | ---------- | ----- | ----- | --------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| gemini:gemini-3.1-flash-lite      | draft-blank-page | 1   | 5233  | 1074       | 205   | 75    | tools=set_seo_metadata                                                | replace_page_sections applied=2 gate=thin(thin_hero_body | duplicated_copy) words=662 bullets=6 |
| gemini:gemini-3.1-flash-lite      | draft-blank-page | 2   | 10819 | 957        | 88    | 75    | tools=set_seo_metadata                                                | replace_page_sections applied=2 gate=thin(thin_hero_body | duplicated_copy) words=662 bullets=6 |
| gemini:gemini-3.1-flash-lite      | hero-rewrite     | 1   | 1153  | 99         | 86    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=56 no-message |
| gemini:gemini-3.1-flash-lite      | hero-rewrite     | 2   | 1143  | 109        | 95    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=63 no-message |
| gemini:gemini-3.1-flash-lite      | faq-add          | 1   | 2627  | 404        | 154   | 85    | tools=add_block applied=1 gate=pass words=269 no-message              |
| gemini:gemini-3.1-flash-lite      | faq-add          | 2   | 2664  | 442        | 166   | 85    | tools=add_block applied=1 gate=pass words=306 no-message              |
| gemini:gemini-3.1-flash-lite      | seo-metadata     | 1   | 1025  | 94         | 92    | 85    | tools=set_seo_metadata applied=1 words=41 no-message                  |
| gemini:gemini-3.1-flash-lite      | seo-metadata     | 2   | 1204  | 99         | 82    | 85    | tools=set_seo_metadata applied=1 words=43 no-message                  |
| gemini:gemini-3.1-flash-lite      | vague-image-ask  | 1   | 1885  | 263        | 140   | 100   | tools=request_clarification applied=1 words=15                        |
| gemini:gemini-3.1-flash-lite      | vague-image-ask  | 2   | 727   | 42         | 58    | 85    | tools=request_clarification applied=1 words=19 no-message             |
| gemini:gemini-3.1-flash-lite#copy | draft-blank-page | 1   | 9572  | 1155       | 121   | 75    | tools=set_seo_metadata                                                | replace_page_sections applied=2 gate=thin(thin_hero_body | duplicated_copy) words=663 bullets=6 |
| gemini:gemini-3.1-flash-lite#copy | draft-blank-page | 2   | 4543  | 968        | 213   | 75    | tools=set_seo_metadata                                                | replace_page_sections applied=2 gate=thin(thin_hero_body | duplicated_copy) words=662 bullets=6 |
| gemini:gemini-3.1-flash-lite#copy | hero-rewrite     | 1   | 1146  | 125        | 109   | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=63 no-message |
| gemini:gemini-3.1-flash-lite#copy | hero-rewrite     | 2   | 1213  | 120        | 99    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=64 no-message |
| gemini:gemini-3.1-flash-lite#copy | faq-add          | 1   | 2577  | 394        | 153   | 85    | tools=add_block applied=1 gate=pass words=261 no-message              |
| gemini:gemini-3.1-flash-lite#copy | faq-add          | 2   | 2320  | 355        | 153   | 85    | tools=add_block applied=1 gate=pass words=234 no-message              |
| gemini:gemini-3.1-flash-lite#copy | seo-metadata     | 1   | 1198  | 97         | 81    | 85    | tools=set_seo_metadata applied=1 words=41 no-message                  |
| gemini:gemini-3.1-flash-lite#copy | seo-metadata     | 2   | 876   | 99         | 113   | 85    | tools=set_seo_metadata applied=1 words=42 no-message                  |
| gemini:gemini-3.1-flash-lite#copy | vague-image-ask  | 1   | 1785  | 261        | 146   | 100   | tools=request_clarification applied=1 words=15                        |
| gemini:gemini-3.1-flash-lite#copy | vague-image-ask  | 2   | 1895  | 271        | 143   | 100   | tools=request_clarification applied=1 words=15                        |
| gemini:gemini-3.5-flash@low#copy  | draft-blank-page | 1   | 12226 | 933        | 76    | 75    | tools=set_seo_metadata                                                | replace_page_sections applied=2 gate=thin(thin_hero_body | duplicated_copy) words=659 bullets=6 |
| gemini:gemini-3.5-flash@low#copy  | draft-blank-page | 2   | 14337 | 1005       | 70    | 75    | tools=set_seo_metadata                                                | replace_page_sections applied=2 gate=thin(thin_hero_body | duplicated_copy) words=660 bullets=6 |
| gemini:gemini-3.5-flash@low#copy  | hero-rewrite     | 1   | 3973  | 117        | 29    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=61 no-message |
| gemini:gemini-3.5-flash@low#copy  | hero-rewrite     | 2   | 4692  | 107        | 23    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=48 no-message |
| gemini:gemini-3.5-flash@low#copy  | faq-add          | 1   | 7089  | 345        | 49    | 85    | tools=add_block applied=1 gate=pass words=226 no-message              |
| gemini:gemini-3.5-flash@low#copy  | faq-add          | 2   | 9416  | 380        | 40    | 85    | tools=add_block applied=1 gate=pass words=248 no-message              |
| gemini:gemini-3.5-flash@low#copy  | seo-metadata     | 1   | 3319  | 88         | 27    | 85    | tools=set_seo_metadata applied=1 words=37 no-message                  |
| gemini:gemini-3.5-flash@low#copy  | seo-metadata     | 2   | 3653  | 94         | 26    | 85    | tools=set_seo_metadata applied=1 words=39 no-message                  |
| gemini:gemini-3.5-flash@low#copy  | vague-image-ask  | 1   | 2615  | 52         | 20    | 85    | tools=request_clarification applied=1 words=29 no-message             |
| gemini:gemini-3.5-flash@low#copy  | vague-image-ask  | 2   | 2335  | 48         | 21    | 85    | tools=request_clarification applied=1 words=26 no-message             |

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
