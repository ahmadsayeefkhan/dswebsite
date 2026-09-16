/**
 * Defined Solution — the work stage
 *
 * One plate of glass in the projection room. The canvas covers the screen in
 * WorkShowcase.astro and draws whichever project the reader has scrolled to:
 * the still, or the ambient loop the moment it is genuinely playing. Between
 * two projects it draws a scrubbed ink wipe — a noisy front sweeps across the
 * plate pulling the next picture in behind it, the one leaving is pushed
 * away from the front and pulled apart into its channels, and the front
 * itself carries a thin rose glow that exists only mid-wipe. Scroll velocity
 * bows the glass; the pointer is a soft lens over it. All of it is one quad
 * and one fragment shader.
 *
 * Why raw WebGL rather than three.js: two textures and a full-screen
 * triangle. three.js is in the project for the intro mark, but it is only
 * ever loaded on the one visit that plays the intro, and pulling ~150KB of
 * it in here to draw a quad would cost more than the effect is worth.
 *
 * ── Contract with motion.ts ─────────────────────────────────────────────────
 *   • Mounted only by the caller's gate (desktop, fine pointer, no reduced
 *     motion, no Save-Data) and only as the section approaches.
 *   • `setProgress(p)` is a float project index — 2.4 is 40% of the way from
 *     project 2 to project 3. The wipe runs through the middle 56% of each
 *     step, so a page-aligned position always shows one clean plate.
 *   • Returns null when a context cannot be had; calls `onLost` if the
 *     context dies later. Either way the caller hands the section back to
 *     the DOM — the plates layout — and nothing else changes.
 *
 * ── Budget ──────────────────────────────────────────────────────────────────
 *   • Stills load on demand: the current project, its neighbours, one ahead.
 *   • Loops play for the two projects that can be on the glass and are
 *     paused for every other one; nothing is fetched until it is wanted.
 *   • DPR capped at 1.5, and the loop draws only while the plate is in the
 *     viewport and the tab is visible — and, with no loop playing, only
 *     while something is actually changing.
 *   • `destroy()` loses the context on purpose so the GPU memory comes back
 *     immediately rather than on GC.
 */

export interface WorkSlide {
  /** URL of the still, or null for a project with no artwork. */
  still: string | null;
  /** The article's own <video> (preload="none", `data-src`), or null. */
  video: HTMLVideoElement | null;
}

export interface WorkStage {
  /** Float project index, 0 … slides.length - 1. */
  setProgress(p: number): void;
  /** Scroll velocity, px/s. Positive is down. */
  setVelocity(v: number): void;
  /** Tear everything down. Safe to call twice. */
  destroy(): void;
}

export interface WorkStageOptions {
  /** The GL context was lost and will not be recovered. */
  onLost?: () => void;
}

const MAX_DPR = 1.5;

/** The wipe occupies this window of each step's scroll, centred. */
const WIPE_IN = 0.22;
const WIPE_OUT = 0.78;

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  // y runs down, so uv matches the image's row order and the pointer's frame.
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_a;
uniform sampler2D u_b;
uniform float u_readyA;
uniform float u_readyB;
uniform float u_mix;     // 0 = A, 1 = B
uniform float u_time;
uniform vec2  u_res;
uniform float u_vel;     // -1..1, normalised scroll speed, sign = direction
uniform vec2  u_mouse;   // uv; far off-canvas when absent
uniform float u_hover;   // 0..1
uniform vec3  u_rose;
uniform vec3  u_ground;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise(p);
    p = p * 2.07 + vec2(3.1, 1.7);
    amp *= 0.5;
  }
  return v;
}

// A plate, sampled with its channels pulled slightly apart along \`split\`.
vec3 plate(sampler2D tex, float ready, vec2 uv, vec2 split) {
  if (ready < 0.5) return u_ground;
  float r = texture2D(tex, uv + split).r;
  float g = texture2D(tex, uv).g;
  float b = texture2D(tex, uv - split).b;
  return vec3(r, g, b);
}

void main() {
  float asp = u_res.x / u_res.y;
  vec2 uv = v_uv;

  /* Scroll: the glass bows with velocity — the centre lags the edges in the
     direction of travel, and the whole plate squashes a touch. */
  float k = u_vel;
  uv.y -= cos((uv.x - 0.5) * 3.14159) * k * 0.022;
  uv.y = 0.5 + (uv.y - 0.5) * (1.0 + abs(k) * 0.05);

  /* Pointer: a soft lens. Sampling coordinates draw in toward the pointer,
     so the picture swells gently under it. */
  vec2 dm = (uv - u_mouse) * vec2(asp, 1.0);
  float md = length(dm);
  float lens = smoothstep(0.36, 0.0, md) * u_hover;
  uv -= dm / vec2(asp, 1.0) * lens * 0.11;

  /* The front. A diagonal, bent by noise that drifts slowly so a slow scrub
     still reads as ink moving rather than a mask sliding. */
  vec2 q = vec2(uv.x * asp, uv.y);
  float n1 = fbm(q * 1.6 + vec2(u_time * 0.04, -u_time * 0.03));
  float n2 = fbm(q * 3.1 + vec2(-u_time * 0.02, u_time * 0.05) + 11.0);
  const float W = 0.2;
  float field = uv.x * 0.78 + uv.y * 0.22 + (n1 - 0.5) * 0.7;
  // The sweep has to start past the field's lowest value and end past its
  // highest, or B leaks in at mix 0 and A lingers at mix 1.
  float edge = mix(-0.42 - W, 1.42 + W, u_mix);
  float m = 1.0 - smoothstep(edge - W, edge + W, field);   // 1 where B has arrived
  float band = 1.0 - smoothstep(0.0, W, abs(field - edge)); // 1 at the front
  float hot = u_mix * (1.0 - u_mix) * 4.0;                  // 0 at rest, 1 mid-wipe

  vec2 disp = vec2(n1 - 0.5, n2 - 0.5) * band * 0.065;
  vec2 split = disp * 0.35 + vec2(0.0, k * 0.004);

  /* Depth: the plate leaving pushes away from the reader, the one arriving
     settles in from slightly larger. A small overscan at rest keeps the
     bow and the lens from ever showing an edge. */
  float sA = 1.05 + u_mix * 0.06;
  float sB = 1.13 - u_mix * 0.08;
  vec2 uvA = (uv - 0.5) / sA + 0.5 + disp;
  vec2 uvB = (uv - 0.5) / sB + 0.5 - disp;

  vec3 a = plate(u_a, u_readyA, uvA, split);
  vec3 b = plate(u_b, u_readyB, uvB, split);
  vec3 col = mix(a, b, m);

  /* The front itself: ink darkens it, and a thin rose light rides its
     leading edge — the one accent, kept to a line rather than a wash, and
     only while the wipe is in flight. */
  float lip = 1.0 - smoothstep(0.0, W * 0.24, abs(field - edge));
  col *= 1.0 - band * 0.3 * hot;
  col += u_rose * pow(lip, 3.0) * 0.45 * hot;

  /* Vignette, the lens's sheen, and grain. */
  float d = length((v_uv - 0.5) * vec2(1.0, 1.25));
  col *= 1.0 - smoothstep(0.42, 0.98, d) * 0.3;
  col += vec3(0.05) * lens;
  col += (hash(gl_FragCoord.xy + fract(u_time) * 17.0) - 0.5) * 0.04;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader: ${log}`);
  }
  return shader;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function token(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Slot {
  still: WebGLTexture | null;
  stillLoading: boolean;
  videoTex: WebGLTexture | null;
  /** The loop is decoded and running — safe to upload frames from. */
  live: boolean;
  videoFailed: boolean;
  wired: boolean;
  lastTime: number;
}

/**
 * Mount the stage into `canvas`, which fills `plate`.
 * Returns null when a context cannot be had — the caller treats that as
 * "no stage" and shows the plates layout instead.
 */
export function mountWorkStage(
  canvas: HTMLCanvasElement,
  plate: HTMLElement,
  slides: WorkSlide[],
  options: WorkStageOptions = {},
): WorkStage | null {
  const attrs = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance' as const,
  };
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = (canvas.getContext('webgl2', attrs) ||
      canvas.getContext('webgl', attrs)) as WebGLRenderingContext | null;
  } catch {
    gl = null;
  }
  if (!gl) return null;

  let program: WebGLProgram;
  try {
    program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');
  } catch {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  gl.useProgram(program);

  /* ── Geometry: one triangle that covers the clip space ─────────────────── */
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const U = {
    a: gl.getUniformLocation(program, 'u_a'),
    b: gl.getUniformLocation(program, 'u_b'),
    readyA: gl.getUniformLocation(program, 'u_readyA'),
    readyB: gl.getUniformLocation(program, 'u_readyB'),
    mix: gl.getUniformLocation(program, 'u_mix'),
    time: gl.getUniformLocation(program, 'u_time'),
    res: gl.getUniformLocation(program, 'u_res'),
    vel: gl.getUniformLocation(program, 'u_vel'),
    mouse: gl.getUniformLocation(program, 'u_mouse'),
    hover: gl.getUniformLocation(program, 'u_hover'),
    rose: gl.getUniformLocation(program, 'u_rose'),
    ground: gl.getUniformLocation(program, 'u_ground'),
  };
  gl.uniform1i(U.a, 0);
  gl.uniform1i(U.b, 1);
  gl.uniform3f(U.ground, 0.067, 0.051, 0.082);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  /* ── Colour, per theme ─────────────────────────────────────────────────
     Only the accent changes: the pictures are the pictures. */
  function applyTheme() {
    const dark = document.documentElement.dataset.theme !== 'light';
    const rose = hexToRgb(token('--color-rose', dark ? '#cb4a68' : '#bd3d5c'));
    gl!.uniform3f(U.rose, rose[0], rose[1], rose[2]);
  }
  applyTheme();
  const themeWatch = new MutationObserver(applyTheme);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ── Textures ─────────────────────────────────────────────────────────── */
  const slots: Slot[] = slides.map(() => ({
    still: null,
    stillLoading: false,
    videoTex: null,
    live: false,
    videoFailed: false,
    wired: false,
    lastTime: -1,
  }));
  const n = slides.length;
  let destroyed = false;

  /* 1600×900 is not a power of two, so in WebGL1 the texture has to clamp
     and go without mipmaps. We want both anyway: a plate never tiles, and
     it is drawn at or near its own size. */
  function makeTexture(): WebGLTexture {
    const t = gl!.createTexture()!;
    gl!.bindTexture(gl!.TEXTURE_2D, t);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    return t;
  }

  function ensureStill(i: number) {
    const slot = slots[i];
    const src = slides[i]?.still;
    if (!slot || !src || slot.still || slot.stillLoading) return;
    slot.stillLoading = true;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      // Decode off the main thread where the browser allows, then upload.
      const upload = () => {
        if (destroyed) return;
        const t = makeTexture();
        gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, img);
        slot.still = t;
        wake();
      };
      if (img.decode) img.decode().then(upload, upload);
      else upload();
    };
    img.onerror = () => {
      /* Left unloaded: the plate shows the ground for this one. */
      slot.stillLoading = false;
    };
    img.src = src;
  }

  /* The loops. The article's own <video> is the player — it is in the tree
     (visually hidden on the stage) so it plays under every browser's rules
     for muted inline media. Nothing is fetched until the project is wanted:
     under preload="none" a freshly assigned src is ignored until load() asks
     for it, which is why load() is here. Autoplay can still be refused (Low
     Power Mode, a data-saver); that rejection is expected, and the still
     stays on the glass. */
  function ensureVideo(i: number) {
    const slot = slots[i];
    const v = slides[i]?.video;
    if (!slot || !v || slot.videoFailed) return;
    if (!slot.wired) {
      slot.wired = true;
      const src = v.dataset.src;
      if (!v.src && src) {
        v.src = src;
        v.load();
      }
      v.addEventListener('playing', () => {
        slot.live = true;
        wake();
      });
      const drop = () => {
        slot.live = false;
      };
      v.addEventListener('pause', drop);
      v.addEventListener('waiting', drop);
      v.addEventListener('emptied', drop);
      v.addEventListener(
        'error',
        () => {
          slot.live = false;
          slot.videoFailed = true;
        },
        { once: true },
      );
    }
    if (v.paused) {
      void v.play().catch(() => {
        slot.live = false;
      });
    }
  }

  function restVideo(i: number) {
    const v = slides[i]?.video;
    if (v && !v.paused) v.pause();
  }

  /** Upload the loop's current frame if it has advanced since last time. */
  function uploadFrame(i: number): boolean {
    const slot = slots[i];
    const v = slides[i]?.video;
    if (!slot || !v || !slot.live || v.readyState < 2) return false;
    if (v.currentTime === slot.lastTime) return true;
    slot.lastTime = v.currentTime;
    if (!slot.videoTex) slot.videoTex = makeTexture();
    else gl!.bindTexture(gl!.TEXTURE_2D, slot.videoTex);
    try {
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, v);
    } catch {
      // A cross-origin or not-yet-decodable frame: fall back to the still.
      slot.live = false;
      return false;
    }
    return true;
  }

  /** The texture to show for project i, and whether there is one. */
  function bind(unit: number, i: number): boolean {
    const slot = slots[i];
    if (!slot) return false;
    gl!.activeTexture(gl!.TEXTURE0 + unit);
    if (slot.live && uploadFrame(i) && slot.videoTex) {
      gl!.bindTexture(gl!.TEXTURE_2D, slot.videoTex);
      return true;
    }
    if (slot.still) {
      gl!.bindTexture(gl!.TEXTURE_2D, slot.still);
      return true;
    }
    return false;
  }

  /* ── State ──────────────────────────────────────────────────────────────── */
  let width = 0;
  let height = 0;
  let dpr = 1;
  let target = 0; // requested progress
  let current = 0; // smoothed progress
  let targetVel = 0;
  let vel = 0;
  let mouseX = -10;
  let mouseY = -10;
  let hot = false;
  let hover = 0;
  let visible = false;
  let running = false;
  let ready = false;
  let dirty = true;
  let raf = 0;
  const t0 = performance.now();

  function wake() {
    dirty = true;
    sync();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const d = Math.min(devicePixelRatio || 1, MAX_DPR);
    if (w === width && h === height && d === dpr) return;
    width = w;
    height = h;
    dpr = d;
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.uniform2f(U.res, canvas.width, canvas.height);
    dirty = true;
  }

  function frame(now: number) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    resize();

    /* Lenis has already smoothed the scroll; this is a light touch on top so
       a keyboard jump or an index click does not snap the wipe. */
    const dp = target - current;
    if (Math.abs(dp) > 0.0005) {
      current += dp * 0.24;
      dirty = true;
    } else if (current !== target) {
      current = target;
      dirty = true;
    }

    /* Velocity is an impulse, not a state: the caller only reports it while
       scroll events arrive, so the target decays on its own — otherwise a
       hard stop would leave the glass bowed at the last speed it saw. The
       glass itself eases in fast and out slow: light with mass. */
    targetVel *= 0.9;
    if (Math.abs(targetVel) < 0.002) targetVel = 0;
    const dv = targetVel - vel;
    if (Math.abs(dv) > 0.001) {
      vel += dv * (Math.abs(targetVel) > Math.abs(vel) ? 0.2 : 0.06);
      dirty = true;
    } else if (vel !== targetVel) {
      vel = targetVel;
      dirty = true;
    }

    const dh = (hot ? 1 : 0) - hover;
    if (Math.abs(dh) > 0.002) {
      hover += dh * 0.1;
      dirty = true;
    } else if (hover !== (hot ? 1 : 0)) {
      hover = hot ? 1 : 0;
      dirty = true;
    }

    /* Which two plates, and how far between them. */
    const a = Math.min(n - 1, Math.max(0, Math.floor(current)));
    const b = Math.min(n - 1, a + 1);
    const frac = b === a ? 0 : current - a;
    const mix = smoothstep(WIPE_IN, WIPE_OUT, frac);

    // Fetch around the reader; play only what can be on the glass.
    ensureStill(a);
    ensureStill(b);
    ensureStill(a - 1);
    ensureStill(b + 1);
    for (let i = 0; i < n; i++) {
      if (i === a || i === b) ensureVideo(i);
      else restVideo(i);
    }

    const showA = mix < 0.999;
    const showB = mix > 0.001;
    if ((showA && slots[a].live) || (showB && slots[b].live) || hover > 0.001) dirty = true;
    if (!dirty) return;
    dirty = false;

    const readyA = showA ? bind(0, a) : false;
    const readyB = showB ? bind(1, b) : false;

    gl!.uniform1f(U.readyA, readyA ? 1 : 0);
    gl!.uniform1f(U.readyB, readyB ? 1 : 0);
    gl!.uniform1f(U.mix, mix);
    gl!.uniform1f(U.time, (now - t0) / 1000);
    gl!.uniform1f(U.vel, vel);
    gl!.uniform2f(U.mouse, mouseX, mouseY);
    gl!.uniform1f(U.hover, hover);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);

    // The first textured frame: let the CSS fade the canvas in.
    if (!ready && (readyA || readyB)) {
      ready = true;
      plate.classList.add('is-ready');
    }
  }

  function sync() {
    const should = visible && !document.hidden && !destroyed;
    if (should && !running) {
      running = true;
      dirty = true;
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
      // Off the glass, nothing should be decoding.
      for (let i = 0; i < n; i++) restVideo(i);
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      sync();
    },
    { rootMargin: '10% 0px' },
  );
  io.observe(plate);

  const onVisibility = () => sync();
  document.addEventListener('visibilitychange', onVisibility);

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) / Math.max(1, r.width);
    mouseY = (e.clientY - r.top) / Math.max(1, r.height);
    hot = true;
    dirty = true;
  };
  const onLeave = () => {
    hot = false;
    dirty = true;
  };
  plate.addEventListener('pointermove', onMove, { passive: true });
  plate.addEventListener('pointerleave', onLeave);

  /* A lost context does not come back on its own, and a blank plate is
     worse than the still: tell the caller so it can hand back to the DOM. */
  const onLost = (e: Event) => {
    e.preventDefault();
    destroy();
    options.onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    running = false;
    cancelAnimationFrame(raf);
    io.disconnect();
    themeWatch.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    plate.removeEventListener('pointermove', onMove);
    plate.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('webglcontextlost', onLost);
    plate.classList.remove('is-ready');
    for (let i = 0; i < n; i++) restVideo(i);
    if (gl!.isContextLost()) return;
    slots.forEach((s) => {
      if (s.still) gl!.deleteTexture(s.still);
      if (s.videoTex) gl!.deleteTexture(s.videoTex);
    });
    gl!.deleteBuffer(buffer);
    gl!.deleteProgram(program);
    gl!.getExtension('WEBGL_lose_context')?.loseContext();
  }

  return {
    setProgress(p) {
      target = Math.min(n - 1, Math.max(0, p));
      wake();
    },
    setVelocity(v) {
      targetVel = Math.max(-1, Math.min(1, v / 2600));
      wake();
    },
    destroy,
  };
}
