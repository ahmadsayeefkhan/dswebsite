/**
 * Defined Solution — the services field
 *
 * A sparse field of motes behind the services walk, drawn with raw WebGL.
 * The motes drift; they are drawn toward the comet on the spine (the light at
 * the head of the stroke) and turn rose as they near it; they part around the
 * cursor; and a hard scroll streams them with the reader. It is the
 * atmosphere's one travelling light, made particulate for the one section
 * where the reader is walking a line.
 *
 * Why raw WebGL rather than three.js: this is one point cloud and two
 * shaders. three.js is already in the project for the intro mark, but pulling
 * ~150KB of it in here to draw `gl.POINTS` would cost more than the effect is
 * worth; the whole file is smaller than three's Vector3.
 *
 * ── Budget ──────────────────────────────────────────────────────────────────
 *   • Mounted only by the caller's gate (desktop, fine pointer, no reduced
 *     motion, no Save-Data) — see motion.ts.
 *   • The canvas is viewport-sized and sticky, never section-sized: a 1440 ×
 *     3200 backing store at 2× would be 37MB for a background.
 *   • DPR capped at 1.5 — motes are soft discs, 2× buys nothing visible.
 *   • Renders only while the section intersects the viewport and the tab is
 *     visible; the loop stops entirely otherwise.
 *   • `destroy()` loses the context on purpose so the GPU memory comes back
 *     immediately rather than on GC.
 */

export interface ServicesField {
  /** Where the comet is, in viewport (client) pixels. */
  setHead(x: number, y: number): void;
  /** Scroll velocity, px/s. Positive is down. */
  setVelocity(v: number): void;
  /** Tear everything down. Safe to call twice. */
  destroy(): void;
}

const COUNT = 900;
const MAX_DPR = 1.5;

const VERT = `
precision highp float;

attribute vec4 a_seed;   // x, y in 0..1 · size · phase

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_head;
uniform vec2  u_mouse;
uniform float u_scroll;  // accumulated scroll offset, px
uniform float u_vel;     // normalised scroll speed 0..1
uniform float u_dpr;

varying float v_glow;
varying float v_alpha;

void main() {
  // Base position: the field scrolls at a fraction of the page, so it reads
  // as depth behind the content rather than as paint on it.
  float y0 = a_seed.y * u_res.y - u_scroll * 0.18;
  y0 = mod(y0, u_res.y + 80.0) - 40.0;
  vec2 p = vec2(a_seed.x * u_res.x, y0);

  // Idle drift, phase-shifted per mote so the field never breathes in unison.
  float ph = a_seed.w * 6.2831;
  p.x += sin(u_time * 0.21 + ph) * 14.0 + cos(u_time * 0.09 + ph * 1.7) * 6.0;
  p.y += cos(u_time * 0.17 + ph * 1.3) * 11.0;

  // The comet gathers the field. Pull is soft and wide, so the motes lean in
  // rather than snap.
  vec2 toHead = u_head - p;
  float dh = length(toHead);
  float pull = smoothstep(340.0, 0.0, dh);
  p += toHead * pull * 0.34;

  // The cursor parts it.
  vec2 fromMouse = p - u_mouse;
  float dm = length(fromMouse);
  float push = smoothstep(150.0, 0.0, dm);
  p += normalize(fromMouse + 0.001) * push * 46.0;

  v_glow  = smoothstep(300.0, 20.0, dh);
  v_alpha = 0.11 + a_seed.z * 0.2 + v_glow * 0.55 + u_vel * 0.12;

  vec2 clip = (p / u_res) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = (1.4 + a_seed.z * 2.2 + v_glow * 2.6) * u_dpr;
}
`;

const FRAG = `
precision mediump float;

uniform vec3 u_bone;
uniform vec3 u_rose;

varying float v_glow;
varying float v_alpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float disc = smoothstep(0.5, 0.18, d);
  vec3 col = mix(u_bone, u_rose, v_glow);
  gl_FragColor = vec4(col, disc * v_alpha);
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

/**
 * Mount the field into `canvas`, watching `section` for visibility.
 * Returns null when a context cannot be had — the caller treats that as
 * "no field", nothing else changes.
 */
export function mountServicesField(
  canvas: HTMLCanvasElement,
  section: HTMLElement,
): ServicesField | null {
  const gl = (canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    powerPreference: 'low-power',
  }) ||
    canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
    })) as WebGLRenderingContext | null;
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

  /* ── Geometry ─────────────────────────────────────────────────────────── */
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    seeds[i * 4] = Math.random();
    seeds[i * 4 + 1] = Math.random();
    // Skewed small: a few bright motes over many faint ones reads as depth.
    seeds[i * 4 + 2] = Math.pow(Math.random(), 2.4);
    seeds[i * 4 + 3] = Math.random();
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
  const aSeed = gl.getAttribLocation(program, 'a_seed');
  gl.enableVertexAttribArray(aSeed);
  gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0);

  const U = {
    res: gl.getUniformLocation(program, 'u_res'),
    time: gl.getUniformLocation(program, 'u_time'),
    head: gl.getUniformLocation(program, 'u_head'),
    mouse: gl.getUniformLocation(program, 'u_mouse'),
    scroll: gl.getUniformLocation(program, 'u_scroll'),
    vel: gl.getUniformLocation(program, 'u_vel'),
    dpr: gl.getUniformLocation(program, 'u_dpr'),
    bone: gl.getUniformLocation(program, 'u_bone'),
    rose: gl.getUniformLocation(program, 'u_rose'),
  };

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);

  /* ── Colour, per theme ─────────────────────────────────────────────────
     On the dark ground the motes are additive light. On paper, light adds up
     to nothing, so they become ink: plum specks with ordinary blending. */
  let dark = true;
  function applyTheme() {
    dark = document.documentElement.dataset.theme !== 'light';
    const bone = hexToRgb(token(dark ? '--color-bone' : '--color-slate', dark ? '#ededed' : '#554e60'));
    const rose = hexToRgb(token('--color-rose', dark ? '#cb4a68' : '#bd3d5c'));
    gl.uniform3f(U.bone, bone[0], bone[1], bone[2]);
    gl.uniform3f(U.rose, rose[0], rose[1], rose[2]);
    if (dark) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  applyTheme();
  const themeWatch = new MutationObserver(applyTheme);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ── State ──────────────────────────────────────────────────────────────── */
  let width = 0;
  let height = 0;
  let dpr = 1;
  // The canvas is sticky: before it pins it sits below the viewport top, so
  // every client coordinate has to be re-based onto the canvas each frame.
  let rectLeft = 0;
  let rectTop = 0;
  let headX = -9999;
  let headY = -9999;
  let mouseX = -9999;
  let mouseY = -9999;
  let targetVel = 0;
  let vel = 0;
  let scrollAcc = 0;
  let lastScrollY = window.scrollY;
  let visible = false;
  let running = false;
  let raf = 0;
  let destroyed = false;
  const t0 = performance.now();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    rectLeft = rect.left;
    rectTop = rect.top;
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const d = Math.min(devicePixelRatio || 1, MAX_DPR);
    if (w === width && h === height && d === dpr) return;
    width = w;
    height = h;
    dpr = d;
    canvas.width = Math.round(w * d);
    canvas.height = Math.round(h * d);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.res, w, h);
    gl.uniform1f(U.dpr, d);
  }

  function frame(now: number) {
    if (!running) return;
    resize();

    // Scroll accumulates so the field streams with the page; velocity eases
    // in fast and out slow, which is what makes it feel like mass.
    const sy = window.scrollY;
    scrollAcc += sy - lastScrollY;
    lastScrollY = sy;
    vel += (targetVel - vel) * (targetVel > vel ? 0.2 : 0.05);

    gl.uniform1f(U.time, (now - t0) / 1000);
    gl.uniform2f(U.head, headX - rectLeft, headY - rectTop);
    gl.uniform2f(U.mouse, mouseX < -1000 ? mouseX : mouseX - rectLeft, mouseY < -1000 ? mouseY : mouseY - rectTop);
    gl.uniform1f(U.scroll, scrollAcc);
    gl.uniform1f(U.vel, vel);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, COUNT);

    raf = requestAnimationFrame(frame);
  }

  function sync() {
    const should = visible && !document.hidden && !destroyed;
    if (should && !running) {
      running = true;
      lastScrollY = window.scrollY;
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting);
      sync();
    },
    { rootMargin: '10% 0px' },
  );
  io.observe(section);

  const onVisibility = () => sync();
  document.addEventListener('visibilitychange', onVisibility);

  const onMove = (e: PointerEvent) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  };
  const onLeave = () => {
    mouseX = -9999;
    mouseY = -9999;
  };
  section.addEventListener('pointermove', onMove, { passive: true });
  section.addEventListener('pointerleave', onLeave);

  // The field is live: let the CSS fade the canvas in.
  canvas.parentElement?.classList.add('is-live');

  return {
    setHead(x, y) {
      headX = x;
      headY = y;
    },
    setVelocity(v) {
      targetVel = Math.min(1, Math.abs(v) / 2600);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      themeWatch.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      section.removeEventListener('pointermove', onMove);
      section.removeEventListener('pointerleave', onLeave);
      canvas.parentElement?.classList.remove('is-live');
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
