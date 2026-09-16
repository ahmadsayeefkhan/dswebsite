/**
 * Defined Solution — motion engine
 *
 * One orchestrated idea runs the whole page: **the mark draws itself.**
 *
 * The preloader states it in three dimensions — the logo as an extruded solid
 * turning from edge-on to face the reader, with the stroke-dash draw kept as
 * the fallback for anything without WebGL. The scroll rail then continues that
 * same stroke down the document as you read, and it terminates in the rose
 * period in the footer. Every other effect is a supporting move, not a
 * separate idea.
 *
 * ── Progressive enhancement contract ───────────────────────────────────────
 * Initial hidden states live behind `html.js` in global.css. That class is set
 * by an inline head script together with a failsafe timer. This module clears
 * the timer once it has booted. So if the bundle 404s, throws, or the visitor
 * has JavaScript off, the failsafe strips `.js` and every element renders in
 * its final state. Nothing is ever stranded invisible.
 *
 * ── Reduced motion ─────────────────────────────────────────────────────────
 * We bail out before registering anything and hand control back to CSS, which
 * forces all reveals to their resting state.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

import type { Mark3D } from './preloader3d';
import type { ServicesField } from './servicesField';
import type { WorkStage } from './workStage';

declare global {
  interface Window {
    __dsMotionFailsafe?: number;
    __dsLenis?: Lenis;
  }
}

const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

let booted = false;

/** Hand the page back to CSS: everything renders in its final state. */
function standDown() {
  clearTimeout(window.__dsMotionFailsafe);
  root.classList.remove('js');
  // Removing the canvas does not stop its render loop — the scene has to be
  // told, or it keeps drawing frames nobody will ever see.
  activeMark3D?.dispose();
  activeMark3D = null;
  document.querySelector<HTMLElement>('[data-preloader]')?.remove();
}

/**
 * Reduced motion switched on while the page was already running. Stop every
 * drive and leave each scroll-driven element at its finished value — a rail
 * frozen mid-fill or a headline stranded below its mask is worse than no
 * animation at all.
 */
function pinToFinalStates() {
  gsap.globalTimeline.pause();
  ScrollTrigger.getAll().forEach((t) => t.kill());
  window.__dsLenis?.destroy();

  gsap.set(
    '[data-reveal], [data-reveal="stagger"] > *, .line-mask > span, .split-line > *, ' +
      '[data-chor], [data-step-visual], [data-step-art], [data-step-rule], [data-hero-main], ' +
      '[data-work-chor], [data-work-title], [data-work-copy]',
    {
      clearProps: 'all',
      opacity: 1,
      y: 0,
      yPercent: 0,
      clipPath: 'none',
    },
  );
  gsap.set('[data-rail-fill], [data-journey-fill]', { scaleY: 1 });
  gsap.set('[data-journey-hud-bar]', { scaleX: 1 });
  document.querySelectorAll('[data-tick]').forEach((t) => t.classList.add('is-passed'));
  document.querySelectorAll('[data-step]').forEach((s) => s.classList.add('is-lit', 'is-in'));
  activeField?.destroy();
  activeField = null;
  activeStage?.destroy();
  activeStage = null;
  document.querySelector<HTMLElement>('[data-cursor]')?.remove();
  root.classList.remove('has-cursor');
  standDown();
}

/**
 * A hidden tab pays for nothing. `animation-play-state` is not inherited, so
 * the CSS side of this (global.css) has to reach every descendant and both
 * pseudo-elements; this only owns the class.
 */
function initTabPause() {
  const sync = () => document.body.classList.toggle('is-paused', document.hidden);
  document.addEventListener('visibilitychange', sync);
  sync();
}

/* ══ Boot ═════════════════════════════════════════════════════════════════ */

export function initMotion() {
  /* Motion preference is honoured live, in both directions. A visitor who
     turns reduced motion ON mid-session gets the page pinned to its finished
     state; one who turns it OFF gets a real boot rather than a dead page that
     only a reload fixes. Both are one-way per session, which is the honest
     trade: re-arming GSAP over a stood-down DOM is not worth the failure
     modes it opens. */
  reduced.addEventListener('change', (e) => {
    if (e.matches) pinToFinalStates();
    else if (!booted) location.reload();
  });

  initTabPause();

  // Not motion — a live clock is content, and a reduced-motion reader still
  // wants the right time in Dhaka.
  initClock();

  if (reduced.matches) {
    standDown();
    return;
  }

  booted = true;
  clearTimeout(window.__dsMotionFailsafe);

  // First, before anything else competes for the network or the main thread.
  warmMark3D();

  gsap.registerPlugin(ScrollTrigger, SplitText);

  const lenis = initSmoothScroll();

  // Built and paused up front: the intro plays it once the curtain moves.
  const hero = buildHero();

  initAtmosphere();
  initRail();
  // Before the reveals: on the stage the work figures hand their reveal
  // attribute back, and that has to happen before initReveals reads them.
  initWorkShowcase();
  initReveals();
  initServicesJourney();
  initHeroScrub();
  initMarquees();
  initCounters();
  initParallax();
  initBentoTiles();
  initMagnetics();
  initCursor();
  initNav();

  runIntro(hero);

  // Fonts change metrics, which changes every trigger position.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());

  return lenis;
}

/* ══ Smooth scroll ════════════════════════════════════════════════════════
   Lenis drives the scroll position; ScrollTrigger reads it. The canonical
   integration is to disable GSAP's lag smoothing and drive Lenis from GSAP's
   own ticker, so scroll, tweens and scrubs all advance on one clock.      */

function initSmoothScroll() {
  const lenis = new Lenis({
    duration: 1.05,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    // Touch keeps native scrolling: momentum hijacking on a phone reads as lag.
    syncTouch: false,
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  window.__dsLenis = lenis;

  // Anchor links have to go through Lenis or they fight it.
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -72, duration: 1.1 });
    });
  });

  return lenis;
}

/* ══ Intro ════════════════════════════════════════════════════════════════
   The mark arrives, the curtain lifts into the hero. Shown once per session —
   a repeat visitor who has already seen it only experiences it as a delay.

   Two ways the mark can arrive, and the reader sees exactly one:

     3D  — the logo as a real extruded solid (a GLB generated from the 2D mark
           with Higgsfield), turning from edge-on to face the reader in a small
           WebGL scene. This is the intended experience.
     SVG — the contour drawing itself with a stroke-dash tween, which is what
           plays when there is no WebGL, three.js fails, or the mesh is slower
           to arrive than BOOT_BUDGET.

   The fallback is not a lesser version of the same animation, it is the same
   idea told flat, so landing on it does not read as a downgrade.          */

/**
 * How long the 3D mark gets to become ready before the SVG draw commits.
 *
 * It has to cover fetching and compiling three.js as well as the mesh, which
 * is why it is measured in seconds rather than hundreds of milliseconds. The
 * budget is spent behind a filling meter, so it reads as loading rather than
 * as a stall, and the head preloads the mesh so most of it overlaps the
 * bundle's own download.
 */
const BOOT_BUDGET = 2200;

/**
 * The 3D module, started as early as possible.
 *
 * Kicked off before the rest of the motion engine initialises rather than at
 * the point of use: three.js is by far the largest thing the intro waits on,
 * and starting its fetch and compile a few hundred milliseconds sooner is the
 * difference between the 3D mark making its budget and the reader getting the
 * flat fallback.
 */
let mark3dModule: Promise<typeof import('./preloader3d')> | null = null;

/**
 * Save-Data and 2G, tested before the import rather than inside it.
 *
 * `preloader3d` exports the same test, but importing the module to ask it
 * would already have spent the bytes the test exists to save.
 */
function worthLoadingMark3D(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (connection?.saveData) return false;
  return !(connection?.effectiveType && /^(slow-)?2g$/.test(connection.effectiveType));
}

function warmMark3D(): Promise<typeof import('./preloader3d')> | null {
  if (!worthLoadingMark3D()) return null;
  if (!mark3dModule) mark3dModule = import('./preloader3d');
  return mark3dModule;
}

/** Disposed by `standDown()` if reduced motion arrives mid-intro. */
let activeMark3D: Mark3D | null = null;

/**
 * Give the 3D mark a fixed window to load, decode and draw its first frame.
 *
 * Resolves with `null` on WebGL absence, any failure, or a miss — and a late
 * arrival is disposed rather than shown, because swapping marks part-way
 * through the animation looks like a bug rather than a flourish.
 */
function raceMark3D(canvas: HTMLCanvasElement): Promise<Mark3D | null> {
  // Decided before the promise: on Save-Data or 2G there is no module to wait
  // for, so there is no race to run and nothing to time out.
  const module = warmMark3D();
  if (!module) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    let giveUp = 0;

    const finish = (mark: Mark3D | null) => {
      if (settled) {
        mark?.dispose();
        return;
      }
      settled = true;
      clearTimeout(giveUp);
      resolve(mark);
    };

    giveUp = setTimeout(() => finish(null), BOOT_BUDGET);

    module
      .then((mod) => mod.initMark3D(canvas))
      .then(finish)
      .catch(() => finish(null));
  });
}

/** The SVG contour drawing itself — the fallback mark. */
function drawFallbackMark(pre: HTMLElement): gsap.core.Timeline {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  const svg = pre.querySelector<SVGSVGElement>('[data-intro-fallback]');
  const path = pre.querySelector<SVGPathElement>('[data-intro-path]');
  const dot = pre.querySelector<SVGCircleElement>('[data-intro-dot]');

  if (svg) tl.set(svg, { opacity: 1 });

  if (path) {
    const len = path.getTotalLength();
    gsap.set(path, { strokeDasharray: len, strokeDashoffset: len, fillOpacity: 0 });
    tl.to(path, { strokeDashoffset: 0, duration: 1.0, ease: 'power2.inOut' })
      .to(path, { fillOpacity: 1, duration: 0.34 }, '-=0.16')
      .to(path, { strokeOpacity: 0, duration: 0.34 }, '<');
  }
  if (dot) {
    tl.fromTo(dot, { scale: 0, transformOrigin: 'center' }, { scale: 1, duration: 0.42, ease: 'back.out(2.4)' }, '-=0.12');
  }

  return tl;
}

/**
 * Run the curtain, then hand over to the hero.
 *
 * Async because the 3D mark is loaded on demand — but `hero` is built and
 * paused before this is called, so the hero timeline is ready to play the
 * instant the curtain starts moving, whichever path the mark took.
 */
async function runIntro(hero: gsap.core.Timeline) {
  const pre = document.querySelector<HTMLElement>('[data-preloader]');
  const seen = sessionStorage.getItem('ds-intro') === '1';

  if (!pre || seen) {
    pre?.remove();
    hero.play();
    return;
  }

  const canvas = pre.querySelector<HTMLCanvasElement>('[data-intro-canvas]');
  const meter = pre.querySelector<HTMLElement>('[data-intro-meter]');

  /* The meter runs on both paths, and it fills in two stages: most of the way
     while the mark is still being decided, the rest under the reveal. It is
     the only thing on screen during the boot window, so it has to start
     immediately rather than wait for the race to settle. */
  if (meter) {
    gsap.fromTo(meter, { scaleX: 0 }, { scaleX: 0.72, duration: 1.15, ease: 'power2.out' });
  }

  const mark = canvas ? await raceMark3D(canvas) : null;
  activeMark3D = mark;

  if (meter) {
    gsap.to(meter, { scaleX: 1, duration: 0.9, ease: 'power1.inOut' });
  }

  if (mark && canvas) {
    // The SVG never appears on this path — it is still at opacity 0.
    await gsap.to(canvas, { opacity: 1, duration: 0.32, ease: 'power2.out' });
    await mark.reveal(1.05);
  } else {
    await drawFallbackMark(pre);
  }

  // The solid spins away underneath the curtain rather than merely vanishing.
  mark?.exit(0.62);

  gsap.to(pre, {
    clipPath: 'inset(0% 0% 100% 0%)',
    duration: 0.82,
    ease: 'power4.inOut',
    delay: 0.12,
    onComplete: () => {
      mark?.dispose();
      activeMark3D = null;
      pre.remove();
      sessionStorage.setItem('ds-intro', '1');
      ScrollTrigger.refresh();
    },
  });

  // The hero rises as the curtain clears, overlapping by ~0.35s.
  gsap.delayedCall(0.59, () => hero.play());
}

function buildHero() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero) return tl;

  /* Split at runtime so the masks match the lines the browser actually
     renders — hand-broken lines go wrong the moment the viewport or the
     loaded font metrics differ from the ones you authored against. */
  const headline = hero.querySelector<HTMLElement>('[data-hero-headline]');
  let lines: Element[] = [];
  if (headline) {
    const split = new SplitText(headline, {
      type: 'lines',
      linesClass: 'split-line',
      mask: 'lines',
    });
    lines = split.lines;
    gsap.set(lines, { yPercent: 108 });
  }

  const eyebrow = hero.querySelector<HTMLElement>('[data-hero-eyebrow]');
  const body = hero.querySelectorAll<HTMLElement>('[data-hero-body]');
  const actions = hero.querySelector<HTMLElement>('[data-hero-actions]');
  const period = hero.querySelector<HTMLElement>('[data-hero-period]');

  if (eyebrow) tl.fromTo(eyebrow, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 }, 0);
  if (lines.length) tl.to(lines, { yPercent: 0, duration: 0.95, stagger: 0.085 }, 0.1);
  if (period) tl.fromTo(period, { scale: 0, transformOrigin: 'center bottom' }, { scale: 1, duration: 0.5, ease: 'back.out(3)' }, 0.72);
  if (body.length) tl.fromTo(body, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.09 }, 0.5);
  if (actions) tl.fromTo(actions.children, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07 }, 0.68);

  return tl;
}

/* ══ The environment ══════════════════════════════════════════════════════
   The atmosphere's one light travels the document. Scroll progress drives its
   position; the page's own scroll velocity drives its intensity, so a hard
   flick briefly brightens the room and it settles again as you stop. That is
   the whole trick — the background stops being a backdrop and becomes the
   thing you are moving through.

   Every write here is delta-gated. This runs on every scroll frame, and a
   custom-property write that changes nothing still invalidates style for the
   whole subtree.                                                          */

/* ── The journey ──────────────────────────────────────────────────────────
   The background's four plates are stations along one continuous camera
   descent, and scroll progress is the playhead. Each later plate fades in
   over its own third of the document on top of a fully opaque result, so
   every dissolve is a clean two-way lerp with no brightness dip in the
   middle. Nothing here steps: opacity, pan and push-in are all continuous
   functions of progress, and Lenis has already smoothed the progress itself,
   so no extra easing loop is needed to make the motion smooth.            */

const PLATE_COUNT = 4;

function initJourney() {
  const frames = Array.from(
    document.querySelectorAll<HTMLElement>('[data-atmos-frame]'),
  ).slice(1); // plate 0 is the opaque floor and never changes
  if (!frames.length) return null;

  const span = 1 / (PLATE_COUNT - 1);
  const last = frames.map(() => -1);

  return (p: number) => {
    for (let i = 0; i < frames.length; i++) {
      const v = Math.min(1, Math.max(0, (p - i * span) / span));
      // Style writes on every scroll frame are the usual cause of a janky
      // background; only touch the DOM when the value actually moved.
      if (Math.abs(v - last[i]) < 0.004) continue;
      last[i] = v;
      frames[i].style.opacity = v.toFixed(3);
    }
  };
}

function initAtmosphere() {
  const glow = document.querySelector<HTMLElement>('[data-atmos-glow]');
  const plate = document.querySelector<HTMLElement>('[data-atmos-plate]');
  if (!glow) return;

  const setJourney = initJourney();

  let lastX = -999;
  let lastY = -999;
  let lastR = -1;
  let lastI = -1;
  let lastP = -999;
  let vel = 0;

  const set = (prop: string, v: string) => glow.style.setProperty(prop, v);

  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const p = self.progress;

      /* The light sweeps across as it descends rather than dropping straight
         down, so no two sections are lit from the same angle. */
      const x = 26 + Math.sin(p * Math.PI * 1.7) * 34;
      const y = -6 + p * 112;

      /* Rose is the ask. It stays absent for the first two thirds and warms in
         only as the contact section approaches — the accent earns its dose. */
      const r = Math.max(0, (p - 0.62) / 0.38);

      /* Velocity, normalised and eased. ScrollTrigger reports px/s; ~2500 is a
         hard flick. The decay is what makes it feel like light with mass.

         A flick DIMS the room rather than brightening it. That reads the same
         way — the environment reacting to how hard you move — but it keeps the
         resting state as the brightest the stack ever gets, which is the state
         the contrast budget in Atmosphere.astro was measured against. Brighten
         here instead and the small type silently fails while text is moving. */
      const raw = Math.min(1, Math.abs(self.getVelocity()) / 2500);
      vel += (raw - vel) * (raw > vel ? 0.28 : 0.06);
      const i = 1 - vel * 0.16;

      if (Math.abs(x - lastX) > 0.2 || Math.abs(y - lastY) > 0.2) {
        lastX = x;
        lastY = y;
        set('--gx', `${x.toFixed(1)}%`);
        set('--gy', `${y.toFixed(1)}%`);
      }
      if (Math.abs(r - lastR) > 0.01) {
        lastR = r;
        set('--gr', r.toFixed(2));
      }
      if (Math.abs(i - lastI) > 0.01) {
        lastI = i;
        set('--gi', i.toFixed(2));
      }

      // The journey's playhead. This is the whole effect.
      if (setJourney) setJourney(p);

      /* The camera move. The pan is what carries the background down the page
         with the reader; the push-in is what makes it read as travelling into
         the space rather than sliding across it. Ten percent and 7% of scale
         over the WHOLE document is a few pixels per screen — felt as depth,
         never noticed as an effect. */
      if (plate) {
        const py = -5 + p * 10;
        if (Math.abs(py - lastP) > 0.04) {
          lastP = py;
          plate.style.setProperty('--py', `${py.toFixed(2)}%`);
          plate.style.setProperty('--ps', (1.02 + p * 0.07).toFixed(4));
        }
      }
    },
  });
}

/* ══ The rail ═════════════════════════════════════════════════════════════
   The stroke, continued. A rose line scales down from the top in step with
   scroll progress, with the dot riding its leading edge and each section tick
   filling permanently as the dot passes.                                  */

function initRail() {
  const rail = document.querySelector<HTMLElement>('[data-rail]');
  if (!rail) return;
  if (!matchMedia('(min-width: 1024px)').matches) return;

  const fill = rail.querySelector<HTMLElement>('[data-rail-fill]');
  const dot = rail.querySelector<HTMLElement>('[data-rail-dot]');
  const ticks = Array.from(rail.querySelectorAll<HTMLAnchorElement>('[data-tick]'));

  const place = () => {
    const docH = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
    const railH = rail.clientHeight;
    ticks.forEach((tick) => {
      const s = document.getElementById(tick.dataset.tick!);
      if (s) tick.style.top = `${Math.min(s.offsetTop / docH, 1) * railH}px`;
    });
  };
  place();
  ScrollTrigger.addEventListener('refreshInit', place);

  if (fill) gsap.set(fill, { scaleY: 0, transformOrigin: 'top' });

  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      if (fill) gsap.set(fill, { scaleY: self.progress });
      if (dot) gsap.set(dot, { y: self.progress * rail.clientHeight });
    },
  });

  ticks.forEach((tick) => {
    const section = document.getElementById(tick.dataset.tick!);
    if (!section) return;
    ScrollTrigger.create({
      trigger: section,
      start: 'top 55%',
      end: 'bottom 45%',
      onEnter: () => setActive(tick),
      onEnterBack: () => setActive(tick),
    });
  });

  function setActive(tick: HTMLAnchorElement) {
    ticks.forEach((t) => t.classList.remove('is-active'));
    tick.classList.add('is-active', 'is-passed');
  }
}

/* ══ Reveals ══════════════════════════════════════════════════════════════
   A small, fixed vocabulary rather than a bespoke tween per section. Four
   values, applied via `data-reveal`, so the page reads as one motion system.

     lines    → SplitText line masks, staggered rise
     fade     → opacity + 22px rise
     stagger  → children, staggered
     clip     → clip-path wipe, for media                                  */

/* Every reveal fired between `top 84%` and `top 88%`, so seven sections
   arrived on one identical tick and the page read as a metronome. Each section
   now gets its own phase — a few percent of viewport either way, keyed off its
   position in the document — which is far too small to notice as a difference
   and exactly enough to stop the rhythm being uniform. */
const SECTION_ORDER = ['index', 'studio', 'services', 'work', 'questions', 'contact'];

function revealPhase(el: HTMLElement) {
  const section = el.closest<HTMLElement>('section[id]');
  const i = section ? SECTION_ORDER.indexOf(section.id) : -1;
  return i < 0 ? 0 : [0, 1.5, -1, 2.5, -1.5, 1][i % 6];
}

/* `will-change` on ~50 nodes for tweens that run `once: true` keeps that many
   layers promoted for the life of the page, which costs memory and, past a
   point, costs the smoothness it was meant to buy. Hand each one back the
   moment its tween is done.

   This marks the element with a class rather than writing `will-change: auto`
   inline: the CSS rule that grants the hint is scoped to
   `:not(.is-revealed)`, so removing the promotion is a matter of the element
   no longer matching. An inline counter-write has to out-specify whatever
   GSAP is also writing to the same style attribute, which it does not
   reliably do once a tween has cleared its own properties. */
function release(el: Element) {
  el.classList.add('is-revealed');
}

function initReveals() {
  // Headlines: split into lines, wrap each in a mask, rise them out.
  document.querySelectorAll<HTMLElement>('[data-reveal="lines"]').forEach((el) => {
    const split = new SplitText(el, {
      type: 'lines',
      linesClass: 'split-line',
      mask: 'lines',
    });
    gsap.set(split.lines, { yPercent: 108 });
    // The element is held at opacity 0 until the split exists, so the lines
    // never paint unmasked in the gap before SplitText runs.
    el.classList.add('is-split');

    ScrollTrigger.create({
      trigger: el,
      start: `top ${84 + revealPhase(el)}%`,
      once: true,
      onEnter: () =>
        gsap.to(split.lines, {
          yPercent: 0,
          duration: 0.95,
          stagger: 0.08,
          ease: 'power3.out',
          onComplete: () => release(el),
        }),
    });
  });

  document.querySelectorAll<HTMLElement>('[data-reveal="fade"]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: `top ${88 + revealPhase(el)}%`,
      once: true,
      onEnter: () =>
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          onComplete: () => release(el),
        }),
    });
  });

  document.querySelectorAll<HTMLElement>('[data-reveal="stagger"]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: `top ${86 + revealPhase(el)}%`,
      once: true,
      onEnter: () =>
        gsap.to(el.children, {
          opacity: 1,
          y: 0,
          duration: 0.72,
          stagger: 0.07,
          ease: 'power3.out',
          onComplete: () => release(el),
        }),
    });
  });

  document.querySelectorAll<HTMLElement>('[data-reveal="clip"]').forEach((el) => {
    ScrollTrigger.create({
      trigger: el,
      start: `top ${88 + revealPhase(el)}%`,
      once: true,
      onEnter: () =>
        gsap.to(el, {
          clipPath: 'inset(0 0 0% 0)',
          duration: 1.05,
          ease: 'power4.out',
          onComplete: () => release(el),
        }),
    });
  });
}

/* ══ Marquees ═════════════════════════════════════════════════════════════
   Three lanes running on their own clocks. Scroll velocity feeds the tween's
   timeScale, so the stack visibly accelerates when the reader moves and
   reverses when they scroll back up — the marquee is tied to the reader's
   input instead of just looping past them.                                */

function initMarquees() {
  const lanes = document.querySelectorAll<HTMLElement>('[data-lane]');
  if (!lanes.length) return;

  // Declared before the handlers below close over it.
  let dir = 1;
  let settle: number;

  const tweens = Array.from(lanes).map((lane) => {
    const track = lane.querySelector<HTMLElement>('[data-lane-track]')!;
    const rtl = lane.dataset.lane === 'rtl';
    const speed = Number(lane.dataset.speed || 45);

    // The track holds the list exactly twice and travels exactly 50%.
    gsap.set(track, { xPercent: rtl ? 0 : -50 });
    const tween = gsap.to(track, {
      xPercent: rtl ? -50 : 0,
      duration: speed,
      ease: 'none',
      repeat: -1,
    });

    lane.addEventListener('mouseenter', () => gsap.to(tween, { timeScale: 0.15, duration: 0.4 }));
    lane.addEventListener('mouseleave', () => gsap.to(tween, { timeScale: dir, duration: 0.5 }));

    return tween;
  });

  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const v = self.getVelocity();
      dir = self.direction === -1 ? -1 : 1;
      const boost = gsap.utils.clamp(0, 5, Math.abs(v) / 420);
      tweens.forEach((t) =>
        gsap.to(t, { timeScale: dir * (1 + boost), duration: 0.25, overwrite: true }),
      );
      clearTimeout(settle);
      settle = window.setTimeout(() => {
        tweens.forEach((t) => gsap.to(t, { timeScale: dir, duration: 0.8, overwrite: true }));
      }, 180);
    },
  });
}

/* ══ Counters ═════════════════════════════════════════════════════════════ */

function initCounters() {
  document.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count);
    const obj = { n: 0 };
    el.textContent = '0';
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () =>
        gsap.to(obj, {
          n: to,
          duration: 1.5,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = String(Math.round(obj.n));
          },
        }),
    });
  });
}

/* ══ Parallax ═════════════════════════════════════════════════════════════ */

function initParallax() {
  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    const amount = Number(el.dataset.parallax || 0.12);
    gsap.fromTo(
      el,
      { yPercent: -amount * 100 },
      {
        yPercent: amount * 100,
        ease: 'none',
        scrollTrigger: {
          trigger: el.parentElement || el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });
}

/* ══ Bento tiles ══════════════════════════════════════════════════════════
   Requested: "the background image should slowly scale up (a smooth 3D zoom
   effect)". The zoom sits on an inner wrapper so the tile's own border and
   radius stay pin-sharp, and the tilt is capped at 3° — enough to read as
   depth, not enough to read as a gimmick.                                 */

function initBentoTiles() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return;

  // The bento is the fallback component (BentoPortfolio.astro); with the
  // projection room mounted there are no tiles and this is a no-op.
  const tiles = document.querySelectorAll<HTMLElement>('[data-tile]');
  if (!tiles.length) return;

  tiles.forEach((tile) => {
    const zoom = tile.querySelector<HTMLElement>('[data-tile-zoom]');
    /* GSAP's canonical names. The `rotateX`/`rotateY` aliases tween fine but
       are "not eligible for reset", so quickTo() warned on every move and the
       tilt never actually updated. */
    const setRX = gsap.quickTo(tile, 'rotationX', { duration: 0.5, ease: 'power3.out' });
    const setRY = gsap.quickTo(tile, 'rotationY', { duration: 0.5, ease: 'power3.out' });

    tile.addEventListener('mouseenter', () => {
      if (zoom) gsap.to(zoom, { scale: 1.06, duration: 0.7, ease: 'power3.out' });
    });

    tile.addEventListener('mousemove', (e) => {
      const r = tile.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      setRY(px * 6);
      setRX(-py * 6);
      // The border glow follows the pointer (BentoPortfolio.astro, .tile::after).
      tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
      tile.style.setProperty('--my', `${e.clientY - r.top}px`);
    });

    tile.addEventListener('mouseleave', () => {
      setRX(0);
      setRY(0);
      if (zoom) gsap.to(zoom, { scale: 1, duration: 0.7, ease: 'power3.out' });
    });
  });
}

/* ══ Magnetic buttons ═════════════════════════════════════════════════════
   The script writes --mx/--my; CSS applies them, so the magnet composes with
   the button's own hover states instead of overwriting their transform.   */

function initMagnetics() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return;

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic || 0.28);

    el.addEventListener('mouseenter', () => el.classList.add('is-magnetised'));

    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
    });

    el.addEventListener('mouseleave', () => {
      el.classList.remove('is-magnetised');
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    });
  });
}

/* ══ Nav ══════════════════════════════════════════════════════════════════
   Condenses once past the hero, and hides on scroll-down / reveals on
   scroll-up so the reader gets the viewport back while reading.           */

function initNav() {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!nav) return;

  ScrollTrigger.create({
    start: 'top -80',
    end: 99999,
    onToggle: (self) => nav.classList.toggle('is-condensed', self.isActive),
  });

  let last = 0;
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const y = self.scroll();
      if (y < 200) {
        nav.classList.remove('is-hidden');
      } else if (y > last + 6) {
        nav.classList.add('is-hidden');
      } else if (y < last - 6) {
        nav.classList.remove('is-hidden');
      }
      last = y;
    },
  });
}

/* ══ The services walk ════════════════════════════════════════════════════
   The stroke, walking the services. One ScrollTrigger scrubs the spine's
   fill to the walk's own progress and rides the comet along it; each badge
   ignites as the comet passes; each row plays a small timeline the moment it
   arrives — the visual unfolds away from the spine, the title rises word by
   word, the deliverables land last. Behind it, the WebGL field is fed the
   comet's position and the scroll velocity.

   Everything that is a touch or a small screen does not need is gated here,
   not in CSS: the field and the tilt are simply never constructed.        */

/** Disposed by `pinToFinalStates()` if reduced motion arrives mid-session. */
let activeField: ServicesField | null = null;

/** A device that will enjoy the field: desktop, a fine pointer, memory. */
function worthFielding(): boolean {
  if (!matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches) return false;
  if (!worthLoadingMark3D()) return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem < 4) return false;
  if ((navigator.hardwareConcurrency || 8) < 4) return false;
  return true;
}

function initServicesJourney() {
  const section = document.querySelector<HTMLElement>('[data-journey]');
  if (!section) return;
  const walk = section.querySelector<HTMLElement>('[data-journey-walk]');
  const fill = section.querySelector<HTMLElement>('[data-journey-fill]');
  const comet = section.querySelector<HTMLElement>('[data-journey-comet]');
  const steps = Array.from(section.querySelectorAll<HTMLElement>('[data-step]'));
  if (!walk || !steps.length) return;

  const desktop = matchMedia('(min-width: 900px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');

  const hudNow = section.querySelector<HTMLElement>('[data-journey-hud-now]');
  const hudBar = section.querySelector<HTMLElement>('[data-journey-hud-bar]');
  const hudLabel = section.querySelector<HTMLElement>('[data-journey-hud-label]');

  /* ── Per-row choreography ───────────────────────────────────────────── */
  steps.forEach((step, i) => {
    const visual = step.querySelector<HTMLElement>('[data-step-visual]');
    const art = step.querySelector<HTMLElement>('[data-step-art]');
    const title = step.querySelector<HTMLElement>('[data-step-title]');
    const rule = step.querySelector<HTMLElement>('[data-step-rule]');
    const chor = Array.from(step.querySelectorAll<HTMLElement>('[data-chor]'));
    const [kicker, body, ...items] = chor;

    /* Split at runtime, lines masked, words animated — each word rises out
       of its own line, so a two-line title never shows a word crossing the
       gap between lines. */
    let words: Element[] = [];
    if (title) {
      const split = new SplitText(title, {
        type: 'lines,words',
        linesClass: 'split-line',
        wordsClass: 'split-word',
        mask: 'lines',
      });
      words = split.words;
      gsap.set(words, { yPercent: 112 });
      title.classList.add('is-split');
    }

    /* The picture starts folded shut against the spine. Which edge that is
       depends on the row: on desktop odd rows sit left of the spine (so the
       fold is on their right), even rows sit right of it; on mobile the
       spine is on the left of everything. */
    const onLeftOfSpine = desktop.matches && i % 2 === 0;
    const shut = onLeftOfSpine
      ? 'inset(0% 0% 0% 100% round 16px)'
      : 'inset(0% 100% 0% 0% round 16px)';
    const open = 'inset(0% 0% 0% 0% round 16px)';
    if (visual) gsap.set(visual, { clipPath: shut });
    if (art) gsap.set(art, { scale: 1.14 });

    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    if (visual) tl.to(visual, { clipPath: open, duration: 1.2, ease: 'power4.inOut' }, 0);
    if (art) tl.to(art, { scale: 1.04, duration: 1.7 }, 0);
    if (kicker) tl.to(kicker, { opacity: 1, y: 0, duration: 0.6 }, 0.28);
    if (words.length) tl.to(words, { yPercent: 0, duration: 0.9, stagger: 0.045 }, 0.34);
    if (body) tl.to(body, { opacity: 1, y: 0, duration: 0.7 }, 0.56);
    if (rule) tl.to(rule, { scaleX: 1, duration: 0.9, ease: 'power3.inOut' }, 0.6);
    if (items.length) tl.to(items, { opacity: 1, y: 0, duration: 0.6, stagger: 0.055 }, 0.72);
    tl.add(() => chor.forEach(release), '>');

    ScrollTrigger.create({
      trigger: step,
      start: `top ${desktop.matches ? 76 : 84}%`,
      once: true,
      onEnter: () => {
        // The class drives the SVG's own arrival (charts drawing, bars
        // growing) in step with the timeline.
        step.classList.add('is-in');
        tl.play();
      },
    });

    /* ── Pointer tilt, fine pointers only ───────────────────────────────── */
    if (fine.matches && visual) {
      const state = { tx: 0, ty: 0, cx: 0, cy: 0, hot: false };
      const tick = () => {
        state.cx += (state.tx - state.cx) * 0.11;
        state.cy += (state.ty - state.cy) * 0.11;
        visual.style.setProperty('--px', state.cx.toFixed(4));
        visual.style.setProperty('--py', state.cy.toFixed(4));
        visual.style.setProperty('--rx', `${(-state.cy * 4.2).toFixed(3)}deg`);
        visual.style.setProperty('--ry', `${(state.cx * 5).toFixed(3)}deg`);
        // Settled and idle: stop paying for the frame.
        if (!state.hot && Math.abs(state.cx) < 0.001 && Math.abs(state.cy) < 0.001) {
          gsap.ticker.remove(tick);
          visual.style.setProperty('--px', '0');
          visual.style.setProperty('--py', '0');
          visual.style.setProperty('--rx', '0deg');
          visual.style.setProperty('--ry', '0deg');
        }
      };

      visual.addEventListener('pointerenter', () => {
        state.hot = true;
        gsap.ticker.add(tick);
        if (art) gsap.to(art, { scale: 1.09, duration: 0.9, ease: 'power3.out', overwrite: 'auto' });
      });
      visual.addEventListener(
        'pointermove',
        (e) => {
          const r = visual.getBoundingClientRect();
          state.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
          state.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        },
        { passive: true },
      );
      visual.addEventListener('pointerleave', () => {
        state.hot = false;
        state.tx = 0;
        state.ty = 0;
        if (art) gsap.to(art, { scale: 1.04, duration: 0.9, ease: 'power3.out', overwrite: 'auto' });
      });
    }
  });

  /* ── The spine ───────────────────────────────────────────────────────── */
  const badges = steps.map((s) => s.querySelector<HTMLElement>('[data-step-badge]'));
  let badgeY: number[] = [];
  let walkH = 1;

  const measure = () => {
    const wr = walk.getBoundingClientRect();
    walkH = Math.max(1, wr.height);
    badgeY = badges.map((b) => (b ? b.getBoundingClientRect().top - wr.top + b.offsetHeight / 2 : 0));
  };
  measure();
  ScrollTrigger.addEventListener('refreshInit', measure);

  if (fill) gsap.set(fill, { scaleY: 0, transformOrigin: 'top' });
  if (hudBar) gsap.set(hudBar, { scaleX: 0, transformOrigin: 'left' });

  let active = -1;
  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    const step = steps[Math.max(0, i)];
    if (hudNow) hudNow.textContent = String(Math.max(0, i) + 1).padStart(2, '0');
    if (hudLabel && step) hudLabel.textContent = step.dataset.stepLabel || '';
  };
  setActive(0);

  ScrollTrigger.create({
    trigger: walk,
    start: 'top 62%',
    end: 'bottom 62%',
    onUpdate: (self) => {
      const p = self.progress;
      const y = p * walkH;

      if (fill) gsap.set(fill, { scaleY: p });
      if (comet) gsap.set(comet, { y });
      if (hudBar) gsap.set(hudBar, { scaleX: p });

      let current = -1;
      for (let i = 0; i < steps.length; i++) {
        if (y >= badgeY[i] - 2) {
          current = i;
          // Ignition is permanent: the stroke is drawn, not scrubbed back.
          if (!steps[i].classList.contains('is-lit')) steps[i].classList.add('is-lit');
        }
      }
      setActive(current);

      if (activeField) {
        const wr = walk.getBoundingClientRect();
        const x = desktop.matches ? wr.left + wr.width / 2 : wr.left + 15.5;
        activeField.setHead(x, wr.top + y);
        activeField.setVelocity(self.getVelocity());
      }
    },
  });

  /* ── The field, mounted only as the section approaches ──────────────── */
  const canvas = section.querySelector<HTMLCanvasElement>('[data-journey-canvas]');
  if (canvas && worthFielding() && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        import('./servicesField')
          .then((m) => {
            activeField = m.mountServicesField(canvas, section);
          })
          .catch(() => {
            /* No field. The section is complete without it. */
          });
      },
      { rootMargin: '60% 0px' },
    );
    io.observe(section);
  }
}

/* ══ The projection room ══════════════════════════════════════════════════
   Selected work (WorkShowcase.astro). On the desktop stage one ScrollTrigger
   reads the reader's position through the seven viewport-tall steps as a
   float project index and drives everything off it: the odometer numeral
   behind the screen, the progress bar, the counter and the lit index button
   in the DOM; the wipe on the glass through scripts/workStage.ts. Each
   step's copy plays a small timeline the moment it arrives and is dimmed by
   scroll position on either side of the screen, so only the project on the
   glass reads at full strength.

   Everywhere the stage is not built — touch, small screens, no WebGL — the
   same articles are the plates layout, and this only lazy-plays their loops
   (initWorkPlates). The decision is made once, at boot, and is one-way:
   the stage can hand back to the plates, never the reverse.              */

const STAGE_MQ = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';

/** Disposed by `pinToFinalStates()` if reduced motion arrives mid-session. */
let activeStage: WorkStage | null = null;

/** A device that will enjoy the stage: desktop, a fine pointer, no Save-Data. */
function worthStaging(): boolean {
  if (!matchMedia(STAGE_MQ).matches) return false;
  if (!worthLoadingMark3D()) return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem < 2) return false;
  return true;
}

function initWorkShowcase() {
  const section = document.querySelector<HTMLElement>('[data-work]');
  if (!section) return;
  const steps = Array.from(section.querySelectorAll<HTMLElement>('[data-work-step]'));
  if (!steps.length) return;

  const staged = steps.length > 1 && worthStaging();
  if (!staged) section.classList.add('is-flat');

  /* ── Per-step choreography, both layouts ────────────────────────────── */
  const dimmers: ScrollTrigger[] = [];

  steps.forEach((step) => {
    const copy = step.querySelector<HTMLElement>('[data-work-copy]');
    const title = step.querySelector<HTMLElement>('[data-work-title]');
    const chor = Array.from(step.querySelectorAll<HTMLElement>('[data-work-chor]'));
    if (!copy) return;

    let lines: Element[] = [];
    if (title) {
      const split = new SplitText(title, {
        type: 'lines',
        linesClass: 'split-line',
        mask: 'lines',
      });
      lines = split.lines;
      gsap.set(lines, { yPercent: 108 });
      title.classList.add('is-split');
    }

    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    if (chor[0]) tl.to(chor[0], { opacity: 1, y: 0, duration: 0.6 }, 0);
    if (lines.length) tl.to(lines, { yPercent: 0, duration: 0.9, stagger: 0.08 }, 0.08);
    if (chor.length > 1) tl.to(chor.slice(1), { opacity: 1, y: 0, duration: 0.65, stagger: 0.08 }, 0.36);
    tl.add(() => chor.forEach(release), '>');

    ScrollTrigger.create({
      trigger: copy,
      start: `top ${staged ? 74 : 84}%`,
      once: true,
      onEnter: () => tl.play(),
    });

    /* On the stage the copy rides through the viewport; it is brightest as
       its step is centred — which is exactly when its plate is alone on the
       glass — and faded either side. Scrubbed, so it reverses honestly. */
    if (staged) {
      const dim = gsap
        .timeline({
          scrollTrigger: { trigger: step, start: 'top 70%', end: 'bottom 30%', scrub: true },
        })
        .fromTo(copy, { opacity: 0.16 }, { opacity: 1, ease: 'none' })
        .to(copy, { opacity: 0.16, ease: 'none' });
      dimmers.push(dim.scrollTrigger!);
    }
  });

  if (!staged) {
    initWorkPlates(section);
    return;
  }

  /* ── The stage ──────────────────────────────────────────────────────── */
  const list = section.querySelector<HTMLElement>('[data-work-steps]');
  const plate = section.querySelector<HTMLElement>('[data-work-plate]');
  const canvas = section.querySelector<HTMLCanvasElement>('[data-work-canvas]');
  const ghostTrack = section.querySelector<HTMLElement>('[data-work-ghost]');
  const ghostA = section.querySelector<HTMLElement>('[data-work-ghost-a]');
  const ghostB = section.querySelector<HTMLElement>('[data-work-ghost-b]');
  const now = section.querySelector<HTMLElement>('[data-work-now]');
  const name = section.querySelector<HTMLElement>('[data-work-name]');
  const bar = section.querySelector<HTMLElement>('[data-work-bar]');
  const jumps = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-work-jump]'));

  const n = steps.length;
  const numbers = steps.map((s) => s.dataset.workNumber || '');
  const names = steps.map((s) => s.dataset.workName || '');

  // The figures belong to the plates layout; on the stage their media is
  // drawn on the glass, so they give up the clip reveal (initReveals runs
  // after this and would otherwise register one per hidden figure).
  section.querySelectorAll('[data-work-figure]').forEach((f) => f.removeAttribute('data-reveal'));

  /* Hand the section back to the DOM: the plates layout, with its loops.
     Called on any runtime failure of the stage. One-way. */
  let flat = false;
  const fallBack = () => {
    if (flat) return;
    flat = true;
    activeStage?.destroy();
    activeStage = null;
    section.classList.add('is-flat');
    dimmers.forEach((t) => t.kill());
    steps.forEach((s) => {
      const copy = s.querySelector<HTMLElement>('[data-work-copy]');
      if (copy) gsap.set(copy, { clearProps: 'opacity' });
    });
    initWorkPlates(section);
    ScrollTrigger.refresh();
  };

  /* A short mask swap for the read-out: out up, in from below. */
  const swap = (el: HTMLElement | null, text: string) => {
    if (!el || el.textContent === text) return;
    gsap
      .timeline()
      .to(el, { opacity: 0, y: -6, duration: 0.16, ease: 'power2.in', overwrite: true })
      .add(() => {
        el.textContent = text;
      })
      .fromTo(el, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power3.out' });
  };

  let active = -1;
  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    jumps.forEach((b, j) => {
      b.classList.toggle('is-active', j === i);
      b.classList.toggle('is-passed', j < i);
      if (j === i) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
    swap(now, numbers[i]);
    swap(name, names[i]);
  };

  let ghostBase = -1;
  let lastFrac = -1;
  let lastBar = -1;
  let lastP = 0;

  const update = (progress: number, velocity: number) => {
    const p = progress * (n - 1);
    lastP = p;

    /* The odometer: the numeral of the step below and the one after it,
       slid by the fraction between them. */
    const base = Math.max(0, Math.min(n - 2, Math.floor(p)));
    const frac = p - base;
    if (base !== ghostBase) {
      ghostBase = base;
      if (ghostA) ghostA.textContent = numbers[base];
      if (ghostB) ghostB.textContent = numbers[base + 1];
    }
    if (ghostTrack && Math.abs(frac - lastFrac) > 0.002) {
      lastFrac = frac;
      ghostTrack.style.transform = `translate3d(0, ${(-frac * 50).toFixed(2)}%, 0)`;
    }
    if (bar && Math.abs(progress - lastBar) > 0.003) {
      lastBar = progress;
      bar.style.transform = `scaleX(${progress.toFixed(4)})`;
    }

    setActive(Math.round(p));

    if (activeStage) {
      activeStage.setProgress(p);
      activeStage.setVelocity(velocity);
    }
  };

  update(0, 0);

  if (list) {
    ScrollTrigger.create({
      trigger: list,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => update(self.progress, self.getVelocity()),
      onRefresh: (self) => update(self.progress, 0),
    });
  }

  /* ── Navigation: the index, and the glass itself (next) ─────────────── */
  const go = (i: number) => {
    const target = steps[((i % n) + n) % n];
    const lenis = window.__dsLenis;
    if (lenis) lenis.scrollTo(target, { duration: 1.2 });
    else target.scrollIntoView({ block: 'start' });
  };
  jumps.forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.workJump))));
  plate?.addEventListener('click', () => go(active + 1));

  /* ── The glass, mounted only as the section approaches ──────────────── */
  if (!canvas || !plate || !('IntersectionObserver' in window)) {
    fallBack();
    return;
  }

  const slides = steps.map((s) => ({
    still: s.dataset.workStill || null,
    video: s.querySelector<HTMLVideoElement>('[data-work-video]'),
  }));

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      import('./workStage')
        .then((m) => {
          if (flat) return;
          const stage = m.mountWorkStage(canvas, plate, slides, { onLost: fallBack });
          if (!stage) {
            fallBack();
            return;
          }
          activeStage = stage;
          stage.setProgress(lastP);
        })
        .catch(fallBack);
    },
    { rootMargin: '60% 0px' },
  );
  io.observe(section);
}

/* The plates' ambient loops, paid for only when they are on screen. Nothing
   is fetched at page load — `preload="none"` plus a `data-src` that only
   becomes a real `src` when the plate enters view. The still underneath is
   the source of truth: the video is revealed only on `playing` and hidden
   again on error, so a blocked autoplay or a 404 degrades to the poster
   rather than to a black rectangle. */
function initWorkPlates(section: HTMLElement) {
  const videos = Array.from(section.querySelectorAll<HTMLVideoElement>('[data-work-video]'));
  if (!videos.length || !('IntersectionObserver' in window)) return;

  const reveal = (v: HTMLVideoElement) => v.classList.add('is-playing');
  const conceal = (v: HTMLVideoElement) => v.classList.remove('is-playing');

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target as HTMLVideoElement;

        if (!entry.isIntersecting) {
          video.pause();
          continue;
        }

        if (!video.src) {
          const src = video.dataset.src;
          if (!src) continue;
          video.src = src;
          /* Required: under preload="none" Chrome ignores a freshly assigned
             src until something explicitly asks for the media, and play()
             alone does not. */
          video.load();
          video.addEventListener('playing', () => reveal(video));
          video.addEventListener('error', () => conceal(video), { once: true });
        }

        // Autoplay can still be refused; that is expected, not exceptional.
        void video.play().catch(() => conceal(video));
      }
    },
    { rootMargin: '200px 0px' },
  );

  videos.forEach((v) => observer.observe(v));
}

/* ══ Hero exit ════════════════════════════════════════════════════════════
   The hero's text sinks and dims as the reader leaves it, scrubbed to
   scroll. Small, but it is what makes the marquee feel like it is arriving
   over something rather than after it.                                    */

function initHeroScrub() {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const main = hero?.querySelector<HTMLElement>('[data-hero-main]');
  if (!hero || !main) return;

  gsap.to(main, {
    yPercent: -9,
    opacity: 0.12,
    ease: 'none',
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: 'bottom 28%',
      scrub: true,
    },
  });
}

/* ══ Clock ════════════════════════════════════════════════════════════════
   Studio time, Dhaka. A metadata detail in the hero eyebrow, in the mono
   register the page already uses for coordinates and counters.           */

function initClock() {
  const els = document.querySelectorAll<HTMLElement>('[data-clock]');
  if (!els.length) return;

  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Dhaka',
    });
  } catch {
    return;
  }

  const tick = () => {
    const t = fmt.format(new Date());
    els.forEach((el) => {
      if (el.textContent !== t) el.textContent = t;
    });
  };
  tick();
  window.setInterval(tick, 20_000);
}

/* ══ Cursor ═══════════════════════════════════════════════════════════════
   A dot on the pointer and a ring that lags behind it. The ring grows over
   anything interactive and can carry a word (`data-cursor-label`). Fine
   pointers only; the native cursor is kept on form fields (global.css), where
   an I-beam is information.                                                */

function initCursor() {
  const el = document.querySelector<HTMLElement>('[data-cursor]');
  if (!el || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const dot = el.querySelector<HTMLElement>('[data-cursor-dot]');
  const ring = el.querySelector<HTMLElement>('[data-cursor-ring]');
  const label = el.querySelector<HTMLElement>('[data-cursor-label]');
  if (!dot || !ring) return;

  root.classList.add('has-cursor');

  let mx = innerWidth / 2;
  let my = innerHeight / 2;
  let rx = mx;
  let ry = my;
  let shown = false;

  const setDot = gsap.quickSetter(dot, 'css') as (v: Record<string, number>) => void;
  const setRing = gsap.quickSetter(ring, 'css') as (v: Record<string, number>) => void;

  document.addEventListener(
    'pointermove',
    (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (!shown) {
        shown = true;
        rx = mx;
        ry = my;
        el.classList.add('is-visible');
      }
    },
    { passive: true },
  );

  document.documentElement.addEventListener('mouseleave', () => el.classList.remove('is-visible'));
  document.documentElement.addEventListener('mouseenter', () => shown && el.classList.add('is-visible'));
  document.addEventListener('pointerdown', () => el.classList.add('is-down'));
  document.addEventListener('pointerup', () => el.classList.remove('is-down'));

  const HOVER =
    'a, button, summary, label, [data-tile], [data-step-visual], [data-work-plate], [data-lane], .portrait';
  document.addEventListener(
    'pointerover',
    (e) => {
      const target = (e.target as Element | null)?.closest?.(HOVER);
      el.classList.toggle('is-hover', !!target);
      const text = (e.target as Element | null)?.closest?.('[data-cursor-label]')?.getAttribute('data-cursor-label');
      if (label) label.textContent = text || '';
      el.classList.toggle('has-label', !!text);
    },
    { passive: true },
  );

  gsap.ticker.add(() => {
    rx += (mx - rx) * 0.17;
    ry += (my - ry) * 0.17;
    setDot({ x: mx, y: my });
    setRing({ x: rx, y: ry });
  });
}
