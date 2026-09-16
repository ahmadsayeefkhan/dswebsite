# Defined Solution — main website

Astro 7 · Tailwind CSS 4 · GSAP 3.15 (ScrollTrigger + SplitText) · Lenis.
Static output, no client framework.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview  # serve dist/
npm run check    # astro type check
```

## Deploying

Live at **https://definedsolution.com** (Hostinger, Business plan).

```
push to main ──► GitHub Actions: npm ci + npm run build ──► commit dist/ to `deploy`
                                                                    │
                        Hostinger (hPanel → Advanced → Git) ◄───────┘ auto-deploy → public_html/main
```

`public_html` also holds the subdomain sites' folders, so the site deploys into
`public_html/main`, and `public_html/.htaccess` (a copy of
[`deploy/root.htaccess`](deploy/root.htaccess), installed once by hand) maps
definedsolution.com into it. Never empty `public_html`.

To ship a change: commit it and `git push`. The site updates in about a minute —
watch the run under the repo's **Actions** tab. Nothing is built on the server.

- **Rollback:** revert the commit on `main` and push; or in hPanel → Git, redeploy.
- **Form key:** `PUBLIC_WEB3FORMS_KEY` (public by design). Locally it comes from `.env`
  (see `.env.example`); in CI from the workflow default or a repository variable.
- **Server rules:** `deploy/root.htaccess` (domain level: HTTPS, non-www, `/main` mapping) and
  `public/.htaccess` (site level: 404 page, caching, security headers, `.git` block).
- **Cache:** HTML revalidates on every visit. Images keep their names, so a replaced image
  can take up to a week to refresh for returning visitors — give it a new filename if it
  must change at once. Flush hPanel → Performance → CDN if a deploy looks stale.

---

## What governs this codebase

The design system in [`../brand-guidelines/`](../brand-guidelines/) is normative — colour,
type, spacing, motion and accessibility all come from there, and non-obvious CSS carries a
comment pointing at the clause it implements. If you change a value here that contradicts a
guideline, change the guideline first.

The three brand colours were sampled from the logo artwork, not chosen:
Ink Plum `#2C2433` · Bone `#EDEDED` · Signal Rose `#CB4A68`.

Page copy comes from [`../brand-guidelines/WebsiteContent.md`](../brand-guidelines/WebsiteContent.md).

---

## The motion idea

One orchestrated idea runs the page: **the mark draws itself.**

The logo is a single unbroken contour, so the intro animates it with a real `stroke-dasharray`
draw over the real path — not a spinner. The scroll rail then continues that stroke down the
left gutter as you read, and it terminates in the rose period in the footer.

Everything else supports that: hero line masks, section reveals, velocity-linked marquees, the
pinned horizontal services rail, parallax, magnetic buttons, tilt on the work tiles. All of it
lives in one module, [`src/scripts/motion.ts`](src/scripts/motion.ts), organised by section.

### The progressive-enhancement contract

This is the most important thing to understand before editing motion code.

1. Initial hidden states (`opacity: 0`, `clip-path`, mask offsets) apply **only** under
   `html.js`, in `global.css`.
2. `.js` is added by an inline script in `<head>`, together with a **2.6s failsafe timer**.
3. `motion.ts` clears that timer once it has booted.

So if the bundle 404s, throws, or the visitor has JavaScript off, the failsafe strips `.js`
and every element renders in its final state. **Nothing is ever stranded invisible.** This is
verified — removing `.js` leaves all 32 reveal elements at full opacity.

Under `prefers-reduced-motion`, the inline script never adds `.js` at all, and `initMotion()`
calls `standDown()` before registering anything. Lenis never starts, the intro never mounts,
and the marquee becomes a horizontally scrollable region rather than a frozen one.

---

## Structure

```
src/
├── data/
│   ├── site.ts        Canonical company facts. Change a phone number once, here.
│   └── content.ts     Page copy: hero, marquee, studio, services, work, FAQ, form.
├── scripts/
│   └── motion.ts      The entire motion engine, one section per concern.
├── layouts/
│   └── Layout.astro   <head>, fonts, OG, JSON-LD, the .js gate + failsafe.
├── components/
│   ├── Preloader.astro     The mark drawing itself. Once per session.
│   ├── ScrollRail.astro    The stroke, continued. Also the section index.
│   ├── Navbar.astro        Condenses past the hero; hides on scroll-down.
│   ├── Hero.astro
│   ├── ToolMarquee.astro   Three lanes, velocity-linked.
│   ├── StudioTrust.astro   Portrait + why-us + counting stats.
│   ├── ServicesRail.astro  Pinned horizontal scroll.
│   ├── ProjectVisual.astro Six procedural SVG project visuals.
│   ├── BentoPortfolio.astro
│   ├── FAQAccordion.astro
│   ├── ProjectGateway.astro
│   ├── Footer.astro
│   ├── Logo.astro / Icon.astro
├── pages/
│   ├── index.astro
│   └── 404.astro
└── styles/
    └── global.css     Tokens (@theme + :root), base, motion primitives, components.
```

**All copy lives in `src/data/`.** A marketing edit should never require opening a `.astro`
file.

---

## Add the live project URLs

Three case studies are live and should link out. In
[`src/data/content.ts`](src/data/content.ts), fill in `liveUrl` on the project:

```ts
{ id: 'paperware',           liveUrl: 'https://…' },
{ id: 'starling',            liveUrl: 'https://…' },
{ id: 'bangali-foundation',  liveUrl: 'https://…' },
```

The "View live site" button renders **only when `liveUrl` is set**, so an empty string simply
hides it. A dead or invented link costs more trust than a missing one.

---

## Things that will bite you

**Astro does not extend style scope to a child component's root element.**
`<Icon class="foo" />` renders an `<svg>` that a scoped `.foo { … }` will never match — the
rule compiles to `.foo[data-astro-cid-…]` and the svg has no such attribute. Use
`.parent :global(.foo)`.

**Scoped styles outrank global ones.** A scoped `.lane[data-astro-cid-…]` is specificity
(0,2,0); a global `.lane` is (0,1,0). The reduced-motion fallback in `global.css` needs
`!important` for exactly this reason.

**The pinned services section must fit one viewport.** It is laid out as a centred flex column
with `min-height: 100svh`, and the deliverable lists are two columns *because* a single column
pushed it past an 800px laptop screen and clipped the last card. If you add content to a
service card, re-measure at 1280×800.

**Do not hand-break headlines into lines.** It was tried; the masks have to match the lines the
browser actually renders, which change with viewport and loaded font metrics. SplitText does it
at runtime.

**Never animate an element into existence without a resting state.** Anything you hide must be
hidden behind `.js` in `global.css`, never inline.

---

## Budgets

| Metric | Budget | Actual |
|---|---|---|
| HTML | — | 17.6 KB gz |
| CSS | — | 9.2 KB gz |
| JS | < 60 KB gz | **53 KB gz** (GSAP + ScrollTrigger + SplitText + Lenis) |
| CLS | < 0.02 | transform/opacity only |

The JS budget was raised from 8 KB when scroll choreography was commissioned; see
brand guideline 03 §10. If a new feature needs a second animation library, it is the wrong
feature.

---

## Accessibility floor

Verified in the browser: one `<h1>` with no skipped heading levels, every image with `alt` and
explicit `width`/`height`, every input with a real `<label>`, visible `:focus-visible` rings,
44px minimum targets, AA contrast throughout, marquee duplicates `aria-hidden`, and complete
`prefers-reduced-motion` support.

---

## Before deploying

The contact form posts to a `mailto:` action — a placeholder that opens the visitor's mail
client rather than delivering to an inbox. Point it at a real endpoint (Formspree, a serverless
function, or your CRM) and make the success state say **"Project initiated"** to match the
button, per guideline 01 §3.
