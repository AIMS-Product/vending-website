# S6 Runtime Design Spec

Status: ACCEPTED FOR IMPLEMENTATION
Created: 2026-06-17
Source: built-in Image Gen concept generated in this thread.

## Image Gen Prompt

Use case: ui-mockup
Asset type: public qualification runtime concept for Vendingpreneurs
Primary request: Create a polished Typeform-style web app screen for a
post-submit qualification flow. It should show one question at a time for a
vending business prospect after they submitted a short contact form.
Audience: people starting or scaling a vending machine business.
Surface: full desktop web screen, 1440x1000-ish composition, with a small mobile
preview inset only if it remains readable.
Visible copy must be code-native in implementation but shown in concept: brand
"Vendingpreneurs", progress "Question 3 of 10", question "How much capital can
you access to start?", helper "This helps us tailor the next step without
slowing you down.", choices "$10k-$25k", "$25k-$50k", "$50k+", "Still
deciding", buttons "Back" and "Continue", autosave note "Saved as you
continue".
Design direction: clean, airy, high-taste public product UI; Vendingpreneurs
brand feel with white background, crisp black outlines, bright sky blue, warm
orange, and dark slate text; avoid beige/cream and avoid purple gradients. Use
confident but friendly typography, deliberate button text sizing, no hero
eyebrow/pill/badge.
Layout: one large focused question area, horizontal progress rail, answer
choices as spacious selectable rows with visible focus/selected states, Back and
Continue controls in a stable footer area. Include a compact right-side visual
asset panel showing a stylized vending machine route map and machines, with the
same black-outline and blue/orange brand system. No nested cards inside cards.
Responsive intent: desktop uses two-column content plus visual panel; mobile
collapses to a single-column screen with progress, question, choices, and sticky
controls.
Constraints: no marketing landing page, no decorative orbs, no stock-photo look,
no fake analytics dashboard, no aggressive exit-blocking copy, no raw technical
labels, no clipped or overlapping text, no browser-default form styling. Keep
the design practical to implement in HTML/CSS/React with accessible controls.

## Extracted Design System

- Background: true white with a light sky-blue lower band, not cream/off-white.
- Text: dark slate `#0f172a`; muted text in slate/blue gray.
- Accent colors: warm orange around `#f47b3b`, brand blue around `#55b8e8`,
  deeper action blue around `#0b63f6`, black outline `#111111`.
- Typography: Inter, large direct question type, deliberate control text at
  `0.95rem` to `1rem`, no negative letter spacing.
- Container model: one open full-screen runtime surface with a focused question
  panel and one right-side visual panel. Do not nest cards inside cards.
- Controls: answer rows are large radio/checkbox-like buttons with black border,
  selected state in pale blue, and a small code-native indicator.
- Buttons: Back is secondary white/black, Continue is orange/black with stable
  dimensions and strong focus state.
- Motion: subtle step transitions only; must respect reduced motion.
- Visual asset: code-native branded vending route panel with machines and path
  motifs matching the concept. It is supportive, not a dashboard.

## Allowed Visible Copy

- Vendingpreneurs
- Question n of total
- Saved as you continue
- Back
- Continue
- Complete
- Your answers are saved.
- Qualification complete
- Continue to next step
- This helps us tailor the next step without slowing you down.
- The question labels, helper text, placeholders, and option labels from the
  immutable qualification form version.

## Required States

- Active question with unanswered controls.
- Active question with prefilled answer from server data.
- Validation error near the affected question and announced in an aria-live
  region.
- Last-step completion state with a safe redirect button.
- Completed session state.
- Unavailable link state without PII.
- Mobile one-column layout with controls reachable without hover.

## Verification Checklist

- Desktop screenshot: full `/qualify/demo-qualification-runtime` runtime view
  with no overlap or horizontal overflow.
- Mobile screenshot: narrow viewport with one-column layout and sticky controls.
- Browser interactions: answer a question, Continue, Back, edit previous answer,
  trigger validation error, complete mocked session, refresh/resume from initial
  saved data.
- Use `view_image` on the latest desktop and mobile screenshots before marking
  S6 done.
