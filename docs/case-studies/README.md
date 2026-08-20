# Case Studies collection

Video-first customer testimonial pages. One CMS collection, one shared
template, twenty-five member stories imported from the case-study pack Jess
put together.

- Public index: `/case-studies`
- Public page: `/case-studies/<slug>`
- Admin: `/admin/case-studies`

## Everything imported as a draft, on purpose

The revenue figures in these stories are what members said out loud in an
interview. Nobody has checked their books. The pack's own handoff note is
explicit about it:

> Numbers are as spoken, not audited. If a number is going on the website next
> to a logo or a claim, run it past Jess first.

So the importer only ever writes `status = 'draft'`. Nothing appears on the
site until a person opens it in the admin and presses publish.

`docs/case-studies/import-report.md` lists every story and, for each one, the
specific things the writer could not confirm — a phonetic name spelling, a
figure that was a projection rather than a closed month, a location count the
member contradicted themselves on. **Read that report before publishing.**

## Adding a new case study

1. **Get the video into the collection.** Either add it to the
   [member stories playlist][playlist] and run the sync (below), or create the
   row by hand in `/admin/case-studies`.
2. **Write the story** in the admin. Four sections, `##` headings:
   `Background`, `The Challenge`, `The Turning Point`, `Where They Are Now`.
   Keep the prose short — the member's own quotes should carry it.
3. **Add the pull quote**, verbatim from the interview. Fix punctuation, never
   wording.
4. **Add 2-4 stats** and fill the structured fields (`Monthly revenue`,
   `Machines`, `Locations`, `Tags`). The index page filters on these, so a
   blank field means the story is missing from those filters.
5. **Publish.** A story cannot be published without a YouTube video id — the
   page is video-first and the database enforces it.

### Rules that matter

- **Never invent a surname.** Several members gave only a first name.
- **Never round or invent a number.** Use the figure exactly as spoken.
- **Leave a field blank rather than guess.** A blank field is correct; a guess
  is a defect on a page with a real person's name on it.

## Tags

Filters on the index page are built from tags, so keep to this vocabulary —
a one-off tag creates a chip that matches a single story:

`part-time` · `full-time` · `career-change` · `retiree` · `family-business` ·
`couple` · `laid-off` · `scaling` · `first-location` · `micro-market` ·
`route-acquisition` · `no-experience`

## Scripts

Both are dry-run by default and print a report. Neither publishes anything.

```bash
# Pull new videos from the playlist into draft stubs
node scripts/sync-youtube-case-studies.mjs
node scripts/sync-youtube-case-studies.mjs --write

# Import / re-import the written stories in data/case-studies/
node scripts/import-case-studies.mjs
node scripts/import-case-studies.mjs --write
node scripts/import-case-studies.mjs --write --overwrite   # clobbers admin edits
```

`sync-youtube-case-studies.mjs` uses the YouTube Data API when
`YOUTUBE_API_KEY` is set, and otherwise falls back to scraping the playlist
page plus oEmbed, which needs no key but depends on YouTube's page shape.

Neither script overwrites editorial copy. The sync only fills fields that are
still empty; the import skips rows that already exist unless you pass
`--overwrite`.

## Not in the collection

Four videos on the channel are not member stories and are excluded by the sync
script: Mike Hoffman's own founder story (twice), Anthony's scripted explainer,
and Mike retelling Anthony's story secondhand. Anthony's own account is
`anthony-kolodziej`.

One video Kody listed, `0vZjvyt9tZA` ("From Laid Off to Replacing Their
Salaries With Vending"), has no transcript in the pack, so it has no story
written for it. Ask Jess for the transcript and add it through the admin.

## Where the code lives

| Path                                                      | What                                                     |
| --------------------------------------------------------- | -------------------------------------------------------- |
| `supabase/migrations/20260819120000_case_studies_cms.sql` | Table, RLS, storage bucket                               |
| `src/lib/services/case-studies.ts`                        | Reads and admin writes                                   |
| `src/lib/case-studies/index-filters.ts`                   | Index filtering, pure and tested                         |
| `src/components/sections/CaseStudyArticle.tsx`            | **The shared template — edit this to change every page** |
| `src/components/sections/CaseStudyCard.tsx`               | Card used by both the index and the related rail         |
| `src/app/case-studies/`                                   | Public routes                                            |
| `src/app/admin/case-studies/`                             | Admin CRUD                                               |
| `data/case-studies/*.json`                                | The written stories, one file per member                 |

The collection deliberately mirrors the News CMS (`news_posts`) — same service
split, same RLS shape, same admin patterns. If you are changing one, look at
the other.

[playlist]: https://www.youtube.com/playlist?list=PL1EJfe7669LmATj9lVIM602c9sEnr5k4z
