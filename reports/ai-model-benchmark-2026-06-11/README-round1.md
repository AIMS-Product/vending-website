# Page builder AI model benchmark

Run: 2026-06-11T01:30:18.584Z — 2 repeat(s) per model+task.

Quality scores are deterministic (0–100): schema-valid response, expected
tool usage, tool calls actually applying to the page draft, and proposal
schema/source-reference validity. Read responses/ for the raw outputs.

## Summary (mean per model)

| Model                         | Mean latency (ms) | Mean tokens/s | Mean quality | Errors |
| ----------------------------- | ----------------- | ------------- | ------------ | ------ |
| openai:gpt-5.5@medium         | —                 | —             | 0            | 12     |
| gemini:gemini-2.5-flash       | 5784              | 60            | 81           | 0      |
| gemini:gemini-3-flash-preview | 9787              | 56            | 75           | 0      |
| gemini:gemini-3.1-flash-lite  | 2067              | 160           | 80           | 0      |
| gemini:gemini-3.5-flash       | 9392              | 44            | 84           | 0      |

## Per-run detail

| Model                         | Task             | Run | ms    | Out tokens | tok/s | Score | Notes                                                                    |
| ----------------------------- | ---------------- | --- | ----- | ---------- | ----- | ----- | ------------------------------------------------------------------------ | --------------------------------- | --------- | --------- | ------------------- |
| openai:gpt-5.5@medium         | draft-blank-page | 1   | 700   | —          | —     | 0     | OpenAI rejected the page-builder assistant request (insufficient_quota). |
| openai:gpt-5.5@medium         | draft-blank-page | 2   | 1032  | —          | —     | 0     | OpenAI rejected the page-builder assistant request (insufficient_quota). |
| openai:gpt-5.5@medium         | hero-rewrite     | 1   | 572   | —          | —     | 0     | OpenAI rejected the page-builder assistant request (insufficient_quota). |
| openai:gpt-5.5@medium         | hero-rewrite     | 2   | 899   | —          | —     | 0     | OpenAI rejected the page-builder assistant request (insufficient_quota). |
| openai:gpt-5.5@medium         | faq-add          | 1   | 616   | —          | —     | 0     | OpenAI rejected the page-builder assistant request (insufficient_quota). |
| openai:gpt-5.5@medium         | faq-add          | 2   | 656   | —          | —     | 0     | OpenAI rejected the page-builder assistant request (insufficient_quota). |
| openai:gpt-5.5@medium         | seo-metadata     | 1   | 651   | —          | —     | 0     | OpenAI rejected the page-builder assistant request (insufficient_quota). |
| openai:gpt-5.5@medium         | seo-metadata     | 2   | 632   | —          | —     | 0     | OpenAI rejected the page-builder assistant request (insufficient_quota). |
| openai:gpt-5.5@medium         | vague-image-ask  | 1   | 722   | —          | —     | 0     | OpenAI rejected the page-builder assistant request (insufficient_quota). |
| openai:gpt-5.5@medium         | vague-image-ask  | 2   | 608   | —          | —     | 0     | OpenAI rejected the page-builder assistant request (insufficient_quota). |
| openai:gpt-5.5@medium         | seo-proposal     | 1   | 999   | —          | —     | 0     | OpenAI rejected the SEO agent request (insufficient_quota).              |
| openai:gpt-5.5@medium         | seo-proposal     | 2   | 517   | —          | —     | 0     | OpenAI rejected the SEO agent request (insufficient_quota).              |
| gemini:gemini-2.5-flash       | draft-blank-page | 1   | 15536 | 1082       | 70    | 100   | tools=set_seo_metadata                                                   | replace_page_sections applied=2   |
| gemini:gemini-2.5-flash       | draft-blank-page | 2   | 13908 | 1008       | 72    | 100   | tools=set_seo_metadata                                                   | replace_page_sections applied=2   |
| gemini:gemini-2.5-flash       | hero-rewrite     | 1   | 1887  | 81         | 43    | 85    | tools=edit_block_1_block_hero applied=1                                  |
| gemini:gemini-2.5-flash       | hero-rewrite     | 2   | 2401  | 90         | 37    | 85    | tools=edit_block_1_block_hero applied=1                                  |
| gemini:gemini-2.5-flash       | faq-add          | 1   | 3522  | 293        | 83    | 85    | tools=add_block applied=1                                                |
| gemini:gemini-2.5-flash       | faq-add          | 2   | 3626  | 333        | 92    | 85    | tools=add_block applied=1                                                |
| gemini:gemini-2.5-flash       | seo-metadata     | 1   | 2395  | 50         | 21    | 85    | tools=set_seo_metadata applied=1                                         |
| gemini:gemini-2.5-flash       | seo-metadata     | 2   | 2595  | 55         | 21    | 85    | tools=set_seo_metadata applied=1                                         |
| gemini:gemini-2.5-flash       | vague-image-ask  | 1   | 2029  | 43         | 21    | 85    | tools=request_clarification applied=1                                    |
| gemini:gemini-2.5-flash       | vague-image-ask  | 2   | 2278  | 42         | 18    | 85    | tools=request_clarification applied=1                                    |
| gemini:gemini-2.5-flash       | seo-proposal     | 1   | 13453 | 1351       | 100   | 10    | invalid: Use an internal path or an http(s) URL.                         |
| gemini:gemini-2.5-flash       | seo-proposal     | 2   | 5777  | 813        | 141   | 80    | blocks=3 unsupported-claims                                              |
| gemini:gemini-3-flash-preview | draft-blank-page | 1   | 17032 | 1059       | 62    | 100   | tools=set_seo_metadata                                                   | replace_page_sections applied=2   |
| gemini:gemini-3-flash-preview | draft-blank-page | 2   | 11964 | 1024       | 86    | 100   | tools=set_seo_metadata                                                   | replace_page_sections applied=2   |
| gemini:gemini-3-flash-preview | hero-rewrite     | 1   | 4578  | 196        | 43    | 85    | tools=edit_block_1_block_hero                                            | set_seo_metadata applied=2        |
| gemini:gemini-3-flash-preview | hero-rewrite     | 2   | 3844  | 112        | 29    | 85    | tools=edit_block_1_block_hero applied=1                                  |
| gemini:gemini-3-flash-preview | faq-add          | 1   | 14313 | 941        | 66    | 85    | tools=set_seo_metadata                                                   | edit_block_1_block_hero           | add_block | add_block | add_block applied=5 |
| gemini:gemini-3-flash-preview | faq-add          | 2   | 9216  | 354        | 38    | 85    | tools=add_block applied=1                                                |
| gemini:gemini-3-flash-preview | seo-metadata     | 1   | 5835  | 202        | 35    | 85    | tools=set_seo_metadata                                                   | edit_block_1_block_hero applied=2 |
| gemini:gemini-3-flash-preview | seo-metadata     | 2   | 20889 | 1001       | 48    | 85    | tools=set_seo_metadata                                                   | replace_page_sections applied=2   |
| gemini:gemini-3-flash-preview | vague-image-ask  | 1   | 2908  | 54         | 19    | 85    | tools=request_clarification applied=1                                    |
| gemini:gemini-3-flash-preview | vague-image-ask  | 2   | 3821  | 46         | 12    | 85    | tools=request_clarification applied=1                                    |
| gemini:gemini-3-flash-preview | seo-proposal     | 1   | 11783 | 1327       | 113   | 10    | invalid: Use an internal path or an http(s) URL.                         |
| gemini:gemini-3-flash-preview | seo-proposal     | 2   | 11258 | 1408       | 125   | 10    | invalid: Use an internal path or an http(s) URL.                         |
| gemini:gemini-3.1-flash-lite  | draft-blank-page | 1   | 4426  | 1013       | 229   | 85    | tools=set_seo_metadata                                                   | replace_page_sections applied=2   |
| gemini:gemini-3.1-flash-lite  | draft-blank-page | 2   | 4257  | 1053       | 247   | 85    | tools=set_seo_metadata                                                   | replace_page_sections applied=2   |
| gemini:gemini-3.1-flash-lite  | hero-rewrite     | 1   | 1129  | 103        | 91    | 85    | tools=edit_block_1_block_hero applied=1                                  |
| gemini:gemini-3.1-flash-lite  | hero-rewrite     | 2   | 974   | 106        | 109   | 85    | tools=edit_block_1_block_hero applied=1                                  |
| gemini:gemini-3.1-flash-lite  | faq-add          | 1   | 1929  | 288        | 149   | 85    | tools=add_block applied=1                                                |
| gemini:gemini-3.1-flash-lite  | faq-add          | 2   | 1778  | 297        | 167   | 85    | tools=add_block applied=1                                                |
| gemini:gemini-3.1-flash-lite  | seo-metadata     | 1   | 1086  | 92         | 85    | 85    | tools=set_seo_metadata applied=1                                         |
| gemini:gemini-3.1-flash-lite  | seo-metadata     | 2   | 867   | 90         | 104   | 85    | tools=set_seo_metadata applied=1                                         |
| gemini:gemini-3.1-flash-lite  | vague-image-ask  | 1   | 835   | 43         | 51    | 85    | tools=request_clarification applied=1                                    |
| gemini:gemini-3.1-flash-lite  | vague-image-ask  | 2   | 839   | 48         | 57    | 85    | tools=request_clarification applied=1                                    |
| gemini:gemini-3.1-flash-lite  | seo-proposal     | 1   | 3406  | 1052       | 309   | 100   | blocks=4                                                                 |
| gemini:gemini-3.1-flash-lite  | seo-proposal     | 2   | 3277  | 1059       | 323   | 10    | invalid: Use an internal path or an http(s) URL.                         |
| gemini:gemini-3.5-flash       | draft-blank-page | 1   | 14181 | 1125       | 79    | 85    | tools=set_seo_metadata                                                   | replace_page_sections applied=2   |
| gemini:gemini-3.5-flash       | draft-blank-page | 2   | 22564 | 1207       | 53    | 85    | tools=set_seo_metadata                                                   | replace_page_sections applied=2   |
| gemini:gemini-3.5-flash       | hero-rewrite     | 1   | 6432  | 98         | 15    | 85    | tools=edit_block_1_block_hero applied=1                                  |
| gemini:gemini-3.5-flash       | hero-rewrite     | 2   | 3964  | 107        | 27    | 85    | tools=edit_block_1_block_hero applied=1                                  |
| gemini:gemini-3.5-flash       | faq-add          | 1   | 9279  | 371        | 40    | 85    | tools=add_block applied=1                                                |
| gemini:gemini-3.5-flash       | faq-add          | 2   | 6828  | 340        | 50    | 85    | tools=add_block applied=1                                                |
| gemini:gemini-3.5-flash       | seo-metadata     | 1   | 4683  | 96         | 21    | 85    | tools=set_seo_metadata applied=1                                         |
| gemini:gemini-3.5-flash       | seo-metadata     | 2   | 7017  | 199        | 28    | 85    | tools=set_seo_metadata                                                   | edit_block_1_block_hero applied=2 |
| gemini:gemini-3.5-flash       | vague-image-ask  | 1   | 4184  | 56         | 13    | 85    | tools=request_clarification applied=1                                    |
| gemini:gemini-3.5-flash       | vague-image-ask  | 2   | 4579  | 61         | 13    | 85    | tools=request_clarification applied=1                                    |
| gemini:gemini-3.5-flash       | seo-proposal     | 1   | 17078 | 1575       | 92    | 80    | blocks=5 unsupported-claims                                              |
| gemini:gemini-3.5-flash       | seo-proposal     | 2   | 11916 | 1174       | 99    | 80    | blocks=4 unsupported-claims                                              |

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
