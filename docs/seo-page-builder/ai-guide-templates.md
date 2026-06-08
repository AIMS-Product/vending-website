# AI Guide Templates

Internal AI guide templates are prompt strategy, not visible user templates.
Editors choose a page type and describe what they want; the AI chooses a hidden
guide, drafts the page structure, and the editor can adjust from there. Later,
user-created visual templates can become a separate visible templating system.

## Research Basis

- Google Search Central emphasizes people-first content that substantially and
  completely helps the intended audience, rather than pages made only to attract
  search visits.
- Google's SEO starter guidance emphasizes clear, accurate titles, useful
  content, descriptive headings, and links that help people and search engines
  understand the page.
- Blog and content-structure guidance commonly separates a strong introduction,
  scannable sections, useful body content, and a clear conclusion or next step.

Sources:

- Google Search Central, "Creating helpful, reliable, people-first content":
  https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- Google Search Central, "SEO Starter Guide":
  https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- HubSpot, "The Anatomy of a Perfect Blog Post":
  https://blog.hubspot.com/marketing/anatomy-perfect-blog-post

## Decisions

- Guides are internal only and should not be named or exposed in chat responses.
- Guide selection is deterministic first, AI-assisted second.
- Every selection has one primary guide and optional secondary signals.
- When uncertain, choose the safest default instead of interrupting the user.
- Guides contain structure, copy rules, and SEO rules.
- V1 implements SEO/resource guides first. Blog, landing, and video have stubs.
- Guide selection is runtime-only for v1. No database fields.

## SEO / Resource V1 Guides

### Commercial Service

Use when the prompt implies a buyer evaluating a service, solution, provider, or
managed installation.

Structure:

- Hero with exact topic and clear service outcome
- Problem and buyer need
- Service or solution benefits
- Process or what happens next
- FAQ that resolves objections
- CTA or lead form

### Local Intent

Use when the prompt clearly includes a location, service area, or local-service
intent.

Structure:

- Hero with service plus location
- Local fit and service area context
- What the service includes
- Process for local enquiry
- FAQ for local logistics
- CTA or lead form

### Use Case

Use when the prompt is about a placement context, audience, scenario, facility,
or operational use case.

Structure:

- Hero naming the scenario
- Why the use case matters
- Fit, requirements, or constraints
- Implementation or service process
- FAQ for objections and decision criteria
- CTA or lead form

### How-To Guide

Use when the prompt asks how to do something, start something, learn a process,
or understand steps.

Structure:

- Hero with the task or learning goal
- Short answer or overview
- Step-by-step process
- Requirements, mistakes, or considerations
- FAQ
- CTA for expert help

### Comparison

Use when the prompt includes "best", "vs", "compare", alternatives, or option
selection.

Structure:

- Hero with comparison question
- Quick recommendation or decision frame
- Option cards or comparison grid
- Pros, cons, and fit criteria
- FAQ
- CTA for choosing the right option

### General Resource

Use as the broad fallback when intent is too thin or mixed.

Structure:

- Hero with topic and promise
- Overview of the topic
- Key benefits or considerations
- Common questions
- CTA or lead form
