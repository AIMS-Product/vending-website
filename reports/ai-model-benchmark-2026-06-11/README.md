# Page builder AI model benchmark

Run: 2026-06-11T02:41:00.219Z — 3 repeat(s) per model+task.

Quality scores are deterministic (0–100): schema-valid response, expected
tool usage, tool calls actually applying to the page draft, and proposal
schema/source-reference validity. Read responses/ for the raw outputs.

## Summary (mean per model)

| Model                             | Mean latency (ms) | Mean tokens/s | Mean quality | Errors |
| --------------------------------- | ----------------- | ------------- | ------------ | ------ |
| gemini:gemini-3.1-flash-lite      | 3401              | 110           | 84           | 0      |
| gemini:gemini-3.1-flash-lite#copy | 4216              | 120           | 86           | 0      |
| gemini:gemini-3.5-flash@low#copy  | 7444              | 43            | 86           | 0      |

## Per-run detail

| Model                             | Task             | Run | ms    | Out tokens | tok/s | Score | Notes                                                                               |
| --------------------------------- | ---------------- | --- | ----- | ---------- | ----- | ----- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| gemini:gemini-3.1-flash-lite      | draft-blank-page | 1   | 11058 | 1198       | 108   | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 gate=pass words=661 no-message                    |
| gemini:gemini-3.1-flash-lite      | draft-blank-page | 2   | 9971  | 2503       | 251   | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 repaired gate=pass words=665 bullets=4 no-message |
| gemini:gemini-3.1-flash-lite      | draft-blank-page | 3   | 12384 | 1078       | 87    | 100   | tools=set_seo_metadata                                                              | replace_page_sections applied=2 FALLBACK gate=pass words=702 bullets=6            |
| gemini:gemini-3.1-flash-lite      | hero-rewrite     | 1   | 1276  | 125        | 98    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=65 no-message               |
| gemini:gemini-3.1-flash-lite      | hero-rewrite     | 2   | 1172  | 120        | 102   | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=58 no-message               |
| gemini:gemini-3.1-flash-lite      | hero-rewrite     | 3   | 1313  | 115        | 88    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=59 no-message               |
| gemini:gemini-3.1-flash-lite      | faq-add          | 1   | 2784  | 473        | 170   | 85    | tools=add_block applied=1 gate=pass words=335 no-message                            |
| gemini:gemini-3.1-flash-lite      | faq-add          | 2   | 2470  | 390        | 158   | 85    | tools=add_block applied=1 gate=pass words=254 no-message                            |
| gemini:gemini-3.1-flash-lite      | faq-add          | 3   | 2601  | 427        | 164   | 85    | tools=add_block applied=1 gate=pass words=293 no-message                            |
| gemini:gemini-3.1-flash-lite      | seo-metadata     | 1   | 985   | 96         | 97    | 85    | tools=set_seo_metadata applied=1 words=43 no-message                                |
| gemini:gemini-3.1-flash-lite      | seo-metadata     | 2   | 950   | 93         | 98    | 85    | tools=set_seo_metadata applied=1 words=41 no-message                                |
| gemini:gemini-3.1-flash-lite      | seo-metadata     | 3   | 920   | 93         | 101   | 85    | tools=set_seo_metadata applied=1 words=40 no-message                                |
| gemini:gemini-3.1-flash-lite      | vague-image-ask  | 1   | 1078  | 51         | 47    | 85    | tools=request_clarification applied=1 words=28 no-message                           |
| gemini:gemini-3.1-flash-lite      | vague-image-ask  | 2   | 1070  | 50         | 47    | 85    | tools=request_clarification applied=1 words=27 no-message                           |
| gemini:gemini-3.1-flash-lite      | vague-image-ask  | 3   | 981   | 27         | 28    | 50    | tools=request_clarification applied=0 failed=1 no-clarification words=10 no-message |
| gemini:gemini-3.1-flash-lite#copy | draft-blank-page | 1   | 15187 | 2360       | 155   | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 repaired gate=pass words=686 bullets=5 no-message |
| gemini:gemini-3.1-flash-lite#copy | draft-blank-page | 2   | 16617 | 1401       | 84    | 60    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 gate=thin(filler_phrase) words=731 no-message     |
| gemini:gemini-3.1-flash-lite#copy | draft-blank-page | 3   | 11064 | 1235       | 112   | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 gate=pass words=664 bullets=4 no-message          |
| gemini:gemini-3.1-flash-lite#copy | hero-rewrite     | 1   | 1300  | 114        | 88    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=54 no-message               |
| gemini:gemini-3.1-flash-lite#copy | hero-rewrite     | 2   | 1302  | 120        | 92    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=64 no-message               |
| gemini:gemini-3.1-flash-lite#copy | hero-rewrite     | 3   | 1157  | 115        | 99    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=50 no-message               |
| gemini:gemini-3.1-flash-lite#copy | faq-add          | 1   | 2636  | 439        | 167   | 85    | tools=add_block applied=1 gate=pass words=298 no-message                            |
| gemini:gemini-3.1-flash-lite#copy | faq-add          | 2   | 2205  | 359        | 163   | 85    | tools=add_block applied=1 gate=pass words=224 no-message                            |
| gemini:gemini-3.1-flash-lite#copy | faq-add          | 3   | 3174  | 474        | 149   | 85    | tools=add_block applied=1 gate=pass words=320 no-message                            |
| gemini:gemini-3.1-flash-lite#copy | seo-metadata     | 1   | 1000  | 97         | 97    | 85    | tools=set_seo_metadata applied=1 words=45 no-message                                |
| gemini:gemini-3.1-flash-lite#copy | seo-metadata     | 2   | 1032  | 97         | 94    | 85    | tools=set_seo_metadata applied=1 words=42 no-message                                |
| gemini:gemini-3.1-flash-lite#copy | seo-metadata     | 3   | 1027  | 91         | 89    | 85    | tools=set_seo_metadata applied=1 words=41 no-message                                |
| gemini:gemini-3.1-flash-lite#copy | vague-image-ask  | 1   | 1908  | 264        | 138   | 100   | tools=request_clarification applied=1 FALLBACK words=15                             |
| gemini:gemini-3.1-flash-lite#copy | vague-image-ask  | 2   | 1766  | 239        | 135   | 100   | tools=request_clarification applied=1 FALLBACK words=15                             |
| gemini:gemini-3.1-flash-lite#copy | vague-image-ask  | 3   | 1871  | 272        | 145   | 100   | tools=request_clarification applied=1 FALLBACK words=15                             |
| gemini:gemini-3.5-flash@low#copy  | draft-blank-page | 1   | 30029 | 2323       | 77    | 100   | tools=set_seo_metadata                                                              | replace_page_sections applied=2 FALLBACK gate=pass words=697 bullets=6            |
| gemini:gemini-3.5-flash@low#copy  | draft-blank-page | 2   | 14266 | 1083       | 76    | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 gate=pass words=541 bullets=3 no-message          |
| gemini:gemini-3.5-flash@low#copy  | draft-blank-page | 3   | 16278 | 1207       | 74    | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 gate=pass words=664 bullets=4 no-message          |
| gemini:gemini-3.5-flash@low#copy  | hero-rewrite     | 1   | 4081  | 114        | 28    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=54 no-message               |
| gemini:gemini-3.5-flash@low#copy  | hero-rewrite     | 2   | 3516  | 107        | 30    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=50 no-message               |
| gemini:gemini-3.5-flash@low#copy  | hero-rewrite     | 3   | 5210  | 115        | 22    | 85    | tools=edit_block_1_block_hero applied=1 gate=pass words=55 no-message               |
| gemini:gemini-3.5-flash@low#copy  | faq-add          | 1   | 7151  | 353        | 49    | 85    | tools=add_block applied=1 gate=pass words=233 no-message                            |
| gemini:gemini-3.5-flash@low#copy  | faq-add          | 2   | 6449  | 335        | 52    | 85    | tools=add_block applied=1 gate=pass words=211 no-message                            |
| gemini:gemini-3.5-flash@low#copy  | faq-add          | 3   | 6032  | 382        | 63    | 85    | tools=add_block applied=1 gate=pass words=246 no-message                            |
| gemini:gemini-3.5-flash@low#copy  | seo-metadata     | 1   | 2939  | 91         | 31    | 85    | tools=set_seo_metadata applied=1 words=37 no-message                                |
| gemini:gemini-3.5-flash@low#copy  | seo-metadata     | 2   | 2609  | 100        | 38    | 85    | tools=set_seo_metadata applied=1 words=33 no-message                                |
| gemini:gemini-3.5-flash@low#copy  | seo-metadata     | 3   | 4820  | 192        | 40    | 85    | tools=set_seo_metadata                                                              | edit_block_1_block_hero applied=2 words=81 no-message                             |
| gemini:gemini-3.5-flash@low#copy  | vague-image-ask  | 1   | 2600  | 71         | 27    | 85    | tools=request_clarification applied=1 words=37 no-message                           |
| gemini:gemini-3.5-flash@low#copy  | vague-image-ask  | 2   | 3203  | 60         | 19    | 85    | tools=request_clarification applied=1 words=33 no-message                           |
| gemini:gemini-3.5-flash@low#copy  | vague-image-ask  | 3   | 2483  | 63         | 25    | 85    | tools=request_clarification applied=1 words=26 no-message                           |

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
