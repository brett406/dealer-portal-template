---
name: brand-discovery
description: >
  Run Phase 0 of any new dealer-portal customer build — the brand-discovery gate
  that has to clear before any design or theme.config.yaml work begins. Produces
  the customer-specific design skill that downstream sessions will use. Triggers:
  "kickoff [customer]", "brand intake for [customer]", "what do we need from
  [customer] before designing", "is the [customer] brand locked", "start
  [customer] discovery". This skill exists so that no stamp begins reskinning
  against placeholders — placeholders → customer sees a generic portal with
  their name on it, and they will hate it. Use BEFORE the `dealer-portal-stamp`
  skill's Phase 1 if the customer's brand isn't already locked.
---

# Brand Discovery Skill

## Why this exists

The dealer-portal template can be reskinned in 30 minutes — but only if the
customer's brand is already locked. The trap: it's tempting to start reskinning
against placeholders ("we'll polish brand later") because the levers are right
there in `theme.config.yaml`. Then the customer reviews a stamped portal that's
80% generic-template and 20% their logo, and the engagement loses momentum.

This skill makes brand discovery a **gate**, not a side task. Until every box
below is ticked, no `theme.config.yaml` edits and no design work happen. The
output of this skill is a customer-specific design skill (e.g. `bhf-design`,
`acme-design`) that locks the brand for every downstream session.

## When to invoke

Whenever Brett kicks off a new dealer-portal customer build and the customer
isn't already obviously brand-locked (no design system, no Toma engagement, no
existing identity). Run BEFORE the `dealer-portal-stamp` skill.

If the customer DOES have a locked brand (e.g. they've come in with a brand
guide PDF, or they're a Toma client who has a system), skip discovery and go
straight to writing the customer-specific design skill against that source
material.

## The gate — six items

A new customer build does not enter Phase 1 (Repo + local boot in
`dealer-portal-stamp`) until ALL six are confirmed. If any is missing, stop and
ask the customer for it. Do not paper over with placeholders.

### 1. The brand truth

A single sentence — typically 1–3 lines — that captures who this customer is
and how they sound. Not their tagline; their identity. Examples of the genre:

- *"BHF is a 50-year Ontario manufacturer talking to people who already know
  farm and industrial equipment, not a marketing agency pitching at them."*
- *"NM Attachments builds excavator and wheel-loader attachments for serious
  operators. They speak the language of horsepower curves and hydraulic
  pressure."*

If the customer can't give you this, write a draft from their existing site /
sales materials and ask them to react. Reactions ("yes that's us" / "we're
warmer than that" / "nope, we're way more conservative") get you there faster
than asking them to author it from scratch.

### 2. Logo files (final-form, vector)

- One `logo.svg` (vector) at minimum. Raster fallbacks (`logo.png`, `logo@2x.png`)
  if the customer relies on bitmap output anywhere.
- Favicon as `.ico` (32×32) AND a 512×512 PNG for PWA / app icons.
- A separate dark-background variant if the logo doesn't read on `#0f0f0f`.

**Do not begin Phase 2 (Reskin) without the SVG.** Placeholder logos lead to
deploys-with-placeholder-logos, every time.

### 3. Colour palette — locked

Three minimum: primary, dark-surface, light-surface. Five preferred:
primary, primary-dark (text-on-primary or hover), secondary accent, dark
surface, light surface.

If the customer has a brand guide PDF, lift hex values from there. If they
don't, extract from their existing site CSS (the way `bhf-design` was extracted
from `bhfmfg.webflow/css/bhfmfg.css`) and confirm with the customer before
locking.

**Run a contrast check** on every primary-colour-on-white and primary-on-dark
pair. If primary on white fails AA (under 4.5:1 for body text, 3.0:1 for large
text or non-text UI), the customer's design skill must explicitly forbid that
combination — e.g. "yellow on white is illegal."

### 4. Typography — two faces

- A display face (for hero headlines, section titles)
- A body face (for everything else)

Both must be web-licensable (Google Fonts is the default — free, broad coverage).
If the customer wants a paid family (Klim, Commercial Type, etc.), get the
license sorted in this phase, not at deploy time. Also confirm: are they OK
with system fonts as a fallback, or do they want the custom font as a hard
requirement (which has perf implications)?

### 5. Production photography (3+ hero-quality shots)

- 2400px wide minimum
- Real product, real environment
- High-resolution, not downsampled CDN exports
- A mix that covers: hero / lifestyle / detail-shot / product-on-white (only if
  the brand calls for it)

If the customer doesn't have 3+ usable photos, this is a real blocker. Two paths:
1. Brief a photographer (timeline + cost — don't surprise them with this at
   week 4 of the build)
2. Shoot iPhone-grade reference photos with the customer; use them for
   placeholder until the real shoot lands; flag every page that uses them so
   they're easy to swap

### 6. Reference URLs — three they like, three they don't

Three sites the customer admires (and can articulate why), and three sites
they explicitly don't want to look like. The "don't" list is more useful — it
catches reflexive instincts ("I want it to look modern" → asks "modern like
which of these?" → customer picks Apple → now you know they want
serif-headlines and a lot of whitespace, even if they didn't say that).

If the customer can't name reference sites, look at their two closest
competitors and ask "which is closer to what you want?" That gets you 80% of
the way.

## What this skill produces

A `<customer>-design` SKILL.md, written in the customer's voice and locked to
their brand. Use `bhf-design` as the canonical template for shape:

- **Lead with the brand truth.** One paragraph that becomes the lens for every
  downstream decision.
- **Asset boundaries section** (REQUIRED — see "Operating rules" below).
- **Scope ladder for design work** (REQUIRED — see below).
- **Fewest-words test** (REQUIRED — see below).
- **Voice with before/after table.** Show, don't list.
- **Don'ts list.** Five-to-seven items that catch the common drifts.
- **Visual system** — colour usage rules (where it appears, where it doesn't),
  type scale, spacing scale, motion, state coverage, iconography.
- **Layout principles** — 5–7 numbered rules.
- **Customer-specific UI decisions.** Things this build is doing that other
  stamps aren't.
- **References** — the 3 like / 3 don't-like list, plus 2–3 industry exemplars.
- **Accessibility as creative constraints**, not a checklist.
- **Output format** the skill should produce when invoked downstream.

The skill lives at `<customer-repo>/.claude/skills/<customer>-design/SKILL.md`.
The repo doesn't have to exist yet — drop it in
`~/Documents/Claude Work/<customer>/.claude/skills/` and move it once the repo
is created.

## Operating rules — bake these into every customer design skill

Three sections every customer-specific design skill MUST inherit verbatim
(adapted to the customer's name + assets). They live near the top of the
skill, right after the brand truth — before voice or visual-system content.
They exist because design tasks are easy to over-execute: a "fix the logo"
ticket can quietly become "redesign the header" if the skill doesn't draw
the line.

### 1. Asset boundaries

```
## Asset boundaries — what you do NOT touch

The customer's brand assets are fixed inputs, not design problems to be
solved. The following are off-limits without explicit, in-turn approval
from Brett:

- **The logo file.** Never substitute the customer's logo with rendered
  text, redrawn marks, or generated alternatives. If the logo is too big,
  make it smaller. If it has contrast issues at small size, ask for a
  simpler variant or a darker background treatment — do not type out the
  brand name in its place.
- **Brand colours from the customer's palette.** Don't introduce off-palette
  accents to "balance" the design, even if it would read better. Bring the
  contrast issue back to Brett.
- **Brand voice from this locked design skill.** Refining a headline is
  fine; replacing the customer's about-us copy with a "better" version is
  not.
- **Typography choices** the customer locked. Different weights of the
  same family are fine. A different family is not.

If you find yourself reaching for any of these, stop and surface the
trade-off to Brett before acting. The signal that you've crossed the
line: you are doing more than the user asked for, and the "more" affects
the customer's brand identity.
```

The customer-specific design skill should ALSO include a short list of
*Tier-3 moves to refuse*, named in concrete terms for that customer (e.g.
"Replacing `Logo.svg` with rendered text" for BHF). Three to five items
is plenty.

### 2. Scope ladder for design work

```
## Scope ladder for design work

When Brett asks for a design fix, locate the request on this ladder
*before* acting. The smaller the ask, the smaller the move.

**Tier 1 — proceed autonomously**
Sizing, spacing, padding, alignment, hierarchy, contrast, focus states,
hover states, motion timing, responsive breakpoints. Pure CSS or layout
adjustments to existing components.
Example: "the logo is too big" → make the logo smaller.

**Tier 2 — proceed and report**
Adding new components in the established style. Adding motion to existing
components. Refining copy that's clearly placeholder.
Example: "add a stamp confirmation to the form" → build it, commit,
explain.

**Tier 3 — propose first, do not execute**
Replacing brand assets. Restructuring information architecture. Removing
existing components. Substituting the customer's content with rewrites.
Anything where the diff would surprise the customer rather than feel like
a refinement.
Example: "the logo doesn't read on white" is NOT permission to replace
the logo with text; it's permission to size it, swap to a darker variant,
or surface the constraint.

When in doubt: a request that names ONE small thing is almost never a
Tier-3 ticket.
```

### 3. Fewest-words test

```
## The fewest-words test before any design commit

Before committing a design change, write a one-line summary of the diff.
If that summary is *bigger than the user's request*, you've overshot.
Trim back.

User said: "the logo is too big"
❌ Bad summary: "rewrote the header to use a Teko wordmark, replaced the
  CTA, restyled nav links, swapped the login treatment"
✅ Good summary: "shrunk header logo from 100px to 44px"

If you cannot write a tight one-liner that obviously matches the ask,
stop, undo, and re-scope before pushing.
```

These three sections are non-negotiable. A customer-specific design skill
without them is incomplete and will allow drift.

## The kickoff conversation

If Brett tells you to run discovery for a customer who's never been in front of
a brand exercise, structure the conversation like this:

1. **5-minute warm-up.** What does the existing site / brand do well? What
   embarrasses you about it? (The second question is the more useful one.)
2. **The brand truth in 60 seconds.** Read them three drafts you've written
   from their existing materials. Have them pick the closest, then iterate.
3. **Walk the references.** Open three competitor sites + three sites you've
   pre-picked from outside their industry. Quick reactions — "more like this"
   or "absolutely not."
4. **Asset audit.** What logos, fonts, photos exist? Where do they live?
   What's missing?
5. **Constraints.** Anything off-limits? (e.g. "we cannot use the colour red
   because our largest distributor uses red and we don't want to be confused
   with them") — these are gold and easy to miss.

Write the customer's design skill from your notes, send it to Brett for a
review pass, then ship it.

## Anti-patterns

- **"We'll figure out the brand as we go."** No, you won't. Every page designed
  before the brand is locked has to be redone after. Stop and gate.
- **"Use placeholders for now."** Placeholder logos and stock photography
  shape the customer's perception of what their site will become. Once they
  see it stamped with placeholders, "polishing brand later" feels like a
  downgrade rather than the actual finished product. Don't open this door.
- **"Their existing site is fine, just match it."** Sometimes — but verify.
  Their existing Webflow / Squarespace site might be 8 years old and out of
  step with how they actually talk now. Confirm the voice + palette is still
  current before lifting it.
- **"Skip references — we know the industry."** The reference list is for
  catching what the customer can't articulate. Even if you know the industry,
  run it.
