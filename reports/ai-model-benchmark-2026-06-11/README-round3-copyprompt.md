# Page builder AI model benchmark

Run: 2026-06-11T01:52:03.543Z — 2 repeat(s) per model+task.

Quality scores are deterministic (0–100): schema-valid response, expected
tool usage, tool calls actually applying to the page draft, and proposal
schema/source-reference validity. Read responses/ for the raw outputs.

## Summary (mean per model)

| Model                                  | Mean latency (ms) | Mean tokens/s | Mean quality | Errors |
| -------------------------------------- | ----------------- | ------------- | ------------ | ------ |
| gemini:gemini-3.1-flash-lite           | 1851              | 127           | 87           | 0      |
| gemini:gemini-3.1-flash-lite#copy      | 1990              | 128           | 85           | 0      |
| gemini:gemini-2.5-flash@low            | 4543              | 47            | 87           | 0      |
| gemini:gemini-2.5-flash@low#copy       | 4638              | 26            | 83           | 0      |
| gemini:gemini-3.5-flash@low            | 6194              | 41            | 88           | 0      |
| gemini:gemini-3.5-flash@low#copy       | 5250              | 50            | 85           | 0      |
| gemini:gemini-3-flash-preview@low      | 4466              | 61            | 88           | 0      |
| gemini:gemini-3-flash-preview@low#copy | 4257              | 64            | 87           | 0      |

## Per-run detail

| Model                                  | Task             | Run | ms    | Out tokens | tok/s | Score | Notes                                                                               |
| -------------------------------------- | ---------------- | --- | ----- | ---------- | ----- | ----- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------ |
| gemini:gemini-3.1-flash-lite           | draft-blank-page | 1   | 4555  | 973        | 214   | 100   | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=653 bullets=6            |
| gemini:gemini-3.1-flash-lite           | draft-blank-page | 2   | 4449  | 1003       | 225   | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=476 no-message           |
| gemini:gemini-3.1-flash-lite           | hero-rewrite     | 1   | 1066  | 95         | 89    | 85    | tools=edit_block_1_block_hero applied=1 words=37 no-message                         |
| gemini:gemini-3.1-flash-lite           | hero-rewrite     | 2   | 956   | 95         | 99    | 85    | tools=edit_block_1_block_hero applied=1 words=39 no-message                         |
| gemini:gemini-3.1-flash-lite           | faq-add          | 1   | 1829  | 299        | 163   | 85    | tools=add_block applied=1 words=179 no-message                                      |
| gemini:gemini-3.1-flash-lite           | faq-add          | 2   | 2012  | 323        | 161   | 85    | tools=add_block applied=1 words=200 no-message                                      |
| gemini:gemini-3.1-flash-lite           | seo-metadata     | 1   | 1100  | 100        | 91    | 85    | tools=set_seo_metadata applied=1 words=43 no-message                                |
| gemini:gemini-3.1-flash-lite           | seo-metadata     | 2   | 971   | 102        | 105   | 85    | tools=set_seo_metadata applied=1 words=44 no-message                                |
| gemini:gemini-3.1-flash-lite           | vague-image-ask  | 1   | 733   | 44         | 60    | 85    | tools=request_clarification applied=1 words=18 no-message                           |
| gemini:gemini-3.1-flash-lite           | vague-image-ask  | 2   | 834   | 48         | 58    | 85    | tools=request_clarification applied=1 words=22 no-message                           |
| gemini:gemini-3.1-flash-lite#copy      | draft-blank-page | 1   | 5070  | 1139       | 225   | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=597 bullets=4 no-message |
| gemini:gemini-3.1-flash-lite#copy      | draft-blank-page | 2   | 4968  | 1092       | 220   | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=564 no-message           |
| gemini:gemini-3.1-flash-lite#copy      | hero-rewrite     | 1   | 1090  | 117        | 107   | 85    | tools=edit_block_1_block_hero applied=1 words=59 no-message                         |
| gemini:gemini-3.1-flash-lite#copy      | hero-rewrite     | 2   | 1072  | 112        | 104   | 85    | tools=edit_block_1_block_hero applied=1 words=46 no-message                         |
| gemini:gemini-3.1-flash-lite#copy      | faq-add          | 1   | 2070  | 317        | 153   | 85    | tools=add_block applied=1 words=193 no-message                                      |
| gemini:gemini-3.1-flash-lite#copy      | faq-add          | 2   | 1945  | 296        | 152   | 85    | tools=add_block applied=1 words=174 no-message                                      |
| gemini:gemini-3.1-flash-lite#copy      | seo-metadata     | 1   | 991   | 94         | 95    | 85    | tools=set_seo_metadata applied=1 words=41 no-message                                |
| gemini:gemini-3.1-flash-lite#copy      | seo-metadata     | 2   | 969   | 94         | 97    | 85    | tools=set_seo_metadata applied=1 words=42 no-message                                |
| gemini:gemini-3.1-flash-lite#copy      | vague-image-ask  | 1   | 851   | 48         | 56    | 85    | tools=request_clarification applied=1 words=25 no-message                           |
| gemini:gemini-3.1-flash-lite#copy      | vague-image-ask  | 2   | 875   | 60         | 69    | 85    | tools=request_clarification applied=1 words=30 no-message                           |
| gemini:gemini-2.5-flash@low            | draft-blank-page | 1   | 9437  | 971        | 103   | 100   | tools=set_seo_metadata                                                              | replace_page_sections                                          | set_seo_metadata applied=3 words=553 |
| gemini:gemini-2.5-flash@low            | draft-blank-page | 2   | 13135 | 1006       | 77    | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=544 no-message           |
| gemini:gemini-2.5-flash@low            | hero-rewrite     | 1   | 2800  | 86         | 31    | 85    | tools=edit_block_1_block_hero applied=1 words=35 no-message                         |
| gemini:gemini-2.5-flash@low            | hero-rewrite     | 2   | 3329  | 76         | 23    | 85    | tools=edit_block_1_block_hero applied=1 words=27 no-message                         |
| gemini:gemini-2.5-flash@low            | faq-add          | 1   | 4165  | 291        | 70    | 85    | tools=add_block applied=1 words=191 no-message                                      |
| gemini:gemini-2.5-flash@low            | faq-add          | 2   | 4010  | 313        | 78    | 85    | tools=add_block applied=1 words=222 no-message                                      |
| gemini:gemini-2.5-flash@low            | seo-metadata     | 1   | 2511  | 59         | 23    | 85    | tools=set_seo_metadata applied=1 words=30 no-message                                |
| gemini:gemini-2.5-flash@low            | seo-metadata     | 2   | 2487  | 56         | 23    | 85    | tools=set_seo_metadata applied=1 words=30 no-message                                |
| gemini:gemini-2.5-flash@low            | vague-image-ask  | 1   | 1635  | 43         | 26    | 85    | tools=request_clarification applied=1 words=25 no-message                           |
| gemini:gemini-2.5-flash@low            | vague-image-ask  | 2   | 1921  | 38         | 20    | 85    | tools=request_clarification applied=1 words=18 no-message                           |
| gemini:gemini-2.5-flash@low#copy       | draft-blank-page | 1   | 8338  | 0          | —     | 100   | tools=replace_page_sections applied=1 words=619 bullets=6                           |
| gemini:gemini-2.5-flash@low#copy       | draft-blank-page | 2   | 10169 | 761        | 75    | 100   | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=654 bullets=6            |
| gemini:gemini-2.5-flash@low#copy       | hero-rewrite     | 1   | 5535  | 99         | 18    | 85    | tools=edit_block_1_block_hero applied=1 words=49 no-message                         |
| gemini:gemini-2.5-flash@low#copy       | hero-rewrite     | 2   | 3524  | 103        | 29    | 85    | tools=edit_block_1_block_hero applied=1 words=53 no-message                         |
| gemini:gemini-2.5-flash@low#copy       | faq-add          | 1   | 6020  | 105        | 17    | 85    | tools=request_clarification                                                         | add_block applied=1 failed=1 words=94                          |
| gemini:gemini-2.5-flash@low#copy       | faq-add          | 2   | 2641  | 56         | 21    | 100   | tools=request_clarification                                                         | add_block applied=2 words=86                                   |
| gemini:gemini-2.5-flash@low#copy       | seo-metadata     | 1   | 2939  | 58         | 20    | 85    | tools=set_seo_metadata applied=1 words=31 no-message                                |
| gemini:gemini-2.5-flash@low#copy       | seo-metadata     | 2   | 2297  | 56         | 24    | 85    | tools=set_seo_metadata applied=1 words=28 no-message                                |
| gemini:gemini-2.5-flash@low#copy       | vague-image-ask  | 1   | 2491  | 39         | 16    | 50    | tools=request_clarification applied=0 failed=1 no-clarification words=21 no-message |
| gemini:gemini-2.5-flash@low#copy       | vague-image-ask  | 2   | 2428  | 40         | 16    | 50    | tools=request_clarification applied=0 failed=1 no-clarification words=20 no-message |
| gemini:gemini-3.5-flash@low            | draft-blank-page | 1   | 11146 | 1057       | 95    | 100   | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=662 bullets=6            |
| gemini:gemini-3.5-flash@low            | draft-blank-page | 2   | 19516 | 1072       | 55    | 100   | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=658 bullets=6            |
| gemini:gemini-3.5-flash@low            | hero-rewrite     | 1   | 3465  | 114        | 33    | 85    | tools=edit_block_1_block_hero applied=1 words=51 no-message                         |
| gemini:gemini-3.5-flash@low            | hero-rewrite     | 2   | 5250  | 100        | 19    | 85    | tools=edit_block_1_block_hero applied=1 words=42 no-message                         |
| gemini:gemini-3.5-flash@low            | faq-add          | 1   | 5215  | 273        | 52    | 85    | tools=add_block applied=1 words=158 no-message                                      |
| gemini:gemini-3.5-flash@low            | faq-add          | 2   | 6071  | 343        | 56    | 85    | tools=add_block applied=1 words=220 no-message                                      |
| gemini:gemini-3.5-flash@low            | seo-metadata     | 1   | 3800  | 93         | 24    | 85    | tools=set_seo_metadata applied=1 words=38 no-message                                |
| gemini:gemini-3.5-flash@low            | seo-metadata     | 2   | 2791  | 95         | 34    | 85    | tools=set_seo_metadata applied=1 words=37 no-message                                |
| gemini:gemini-3.5-flash@low            | vague-image-ask  | 1   | 2542  | 51         | 20    | 85    | tools=request_clarification applied=1 words=28 no-message                           |
| gemini:gemini-3.5-flash@low            | vague-image-ask  | 2   | 2140  | 55         | 26    | 85    | tools=request_clarification applied=1 words=29 no-message                           |
| gemini:gemini-3.5-flash@low#copy       | draft-blank-page | 1   | 11968 | 1107       | 92    | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=523 bullets=4 no-message |
| gemini:gemini-3.5-flash@low#copy       | draft-blank-page | 2   | 15936 | 1104       | 69    | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=561 bullets=4 no-message |
| gemini:gemini-3.5-flash@low#copy       | hero-rewrite     | 1   | 2776  | 101        | 36    | 85    | tools=edit_block_1_block_hero applied=1 words=42 no-message                         |
| gemini:gemini-3.5-flash@low#copy       | hero-rewrite     | 2   | 2468  | 104        | 42    | 85    | tools=edit_block_1_block_hero applied=1 words=48 no-message                         |
| gemini:gemini-3.5-flash@low#copy       | faq-add          | 1   | 3759  | 304        | 81    | 85    | tools=add_block applied=1 words=188 no-message                                      |
| gemini:gemini-3.5-flash@low#copy       | faq-add          | 2   | 5537  | 351        | 63    | 85    | tools=add_block applied=1 words=232 no-message                                      |
| gemini:gemini-3.5-flash@low#copy       | seo-metadata     | 1   | 2021  | 92         | 46    | 85    | tools=set_seo_metadata applied=1 words=39 no-message                                |
| gemini:gemini-3.5-flash@low#copy       | seo-metadata     | 2   | 2818  | 95         | 34    | 85    | tools=set_seo_metadata applied=1 words=39 no-message                                |
| gemini:gemini-3.5-flash@low#copy       | vague-image-ask  | 1   | 2435  | 41         | 17    | 85    | tools=request_clarification applied=1 words=20 no-message                           |
| gemini:gemini-3.5-flash@low#copy       | vague-image-ask  | 2   | 2777  | 62         | 22    | 85    | tools=request_clarification applied=1 words=25 no-message                           |
| gemini:gemini-3-flash-preview@low      | draft-blank-page | 1   | 9288  | 1085       | 117   | 100   | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=653 bullets=6            |
| gemini:gemini-3-flash-preview@low      | draft-blank-page | 2   | 15664 | 1039       | 66    | 100   | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=653 bullets=6            |
| gemini:gemini-3-flash-preview@low      | hero-rewrite     | 1   | 2073  | 92         | 44    | 85    | tools=edit_block_1_block_hero applied=1 words=44 no-message                         |
| gemini:gemini-3-flash-preview@low      | hero-rewrite     | 2   | 2158  | 101        | 47    | 85    | tools=edit_block_1_block_hero applied=1 words=50 no-message                         |
| gemini:gemini-3-flash-preview@low      | faq-add          | 1   | 3655  | 359        | 98    | 85    | tools=add_block applied=1 words=225 no-message                                      |
| gemini:gemini-3-flash-preview@low      | faq-add          | 2   | 3772  | 367        | 97    | 85    | tools=add_block applied=1 words=240 no-message                                      |
| gemini:gemini-3-flash-preview@low      | seo-metadata     | 1   | 2188  | 96         | 44    | 85    | tools=set_seo_metadata applied=1 words=39 no-message                                |
| gemini:gemini-3-flash-preview@low      | seo-metadata     | 2   | 1941  | 91         | 47    | 85    | tools=set_seo_metadata applied=1 words=38 no-message                                |
| gemini:gemini-3-flash-preview@low      | vague-image-ask  | 1   | 1854  | 50         | 27    | 85    | tools=request_clarification applied=1 words=26 no-message                           |
| gemini:gemini-3-flash-preview@low      | vague-image-ask  | 2   | 2063  | 50         | 24    | 85    | tools=request_clarification applied=1 words=26 no-message                           |
| gemini:gemini-3-flash-preview@low#copy | draft-blank-page | 1   | 14553 | 1089       | 75    | 85    | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=484 bullets=4 no-message |
| gemini:gemini-3-flash-preview@low#copy | draft-blank-page | 2   | 8206  | 1133       | 138   | 100   | tools=set_seo_metadata                                                              | replace_page_sections applied=2 words=659 bullets=6            |
| gemini:gemini-3-flash-preview@low#copy | hero-rewrite     | 1   | 2128  | 94         | 44    | 85    | tools=edit_block_1_block_hero applied=1 words=42 no-message                         |
| gemini:gemini-3-flash-preview@low#copy | hero-rewrite     | 2   | 2368  | 101        | 43    | 85    | tools=edit_block_1_block_hero applied=1 words=52 no-message                         |
| gemini:gemini-3-flash-preview@low#copy | faq-add          | 1   | 3591  | 359        | 100   | 85    | tools=add_block applied=1 words=237 no-message                                      |
| gemini:gemini-3-flash-preview@low#copy | faq-add          | 2   | 4277  | 388        | 91    | 85    | tools=add_block applied=1 words=254 no-message                                      |
| gemini:gemini-3-flash-preview@low#copy | seo-metadata     | 1   | 2177  | 90         | 41    | 85    | tools=set_seo_metadata applied=1 words=37 no-message                                |
| gemini:gemini-3-flash-preview@low#copy | seo-metadata     | 2   | 1697  | 95         | 56    | 85    | tools=set_seo_metadata applied=1 words=33 no-message                                |
| gemini:gemini-3-flash-preview@low#copy | vague-image-ask  | 1   | 1802  | 47         | 26    | 85    | tools=request_clarification applied=1 words=24 no-message                           |
| gemini:gemini-3-flash-preview@low#copy | vague-image-ask  | 2   | 1771  | 47         | 27    | 85    | tools=request_clarification applied=1 words=26 no-message                           |

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
