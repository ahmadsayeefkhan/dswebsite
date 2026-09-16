/**
 * Defined Solution — 3D intro mark
 *
 * The preloader's centrepiece: the logo as a real extruded solid, generated
 * from the 2D mark with Higgsfield (image → render → mesh) and shipped as a
 * Draco-free GLB in /brand/ds-mark-3d.glb.
 *
 * It is loaded here, never in the main bundle: `initMark3D()` is reached by a
 * dynamic import so a visitor on a slow link, an old GPU, or reduced motion
 * never pays for three.js. Everything is written so the caller can give up on
 * it at any moment — see `Mark3D.dispose()`.
 *
 * The reveal reads as one move: the solid starts edge-on (a hairline, because
 * a 15%-thick extrusion seen from the side is barely there), turns to face the
 * viewer, and settles into a slow idle drift. The exit spins it away as the
 * curtain wipes up. That is the same "the mark draws itself" idea as the SVG
 * fallback, told with volume instead of a stroke.
 */

import type {
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';

/** The handle `motion.ts` drives. Every method is safe after `dispose()`. */
export interface Mark3D {
  /** Turn the solid from edge-on to front-facing. Resolves when it settles. */
  reveal(duration: number): Promise<void>;
  /** Spin away for the curtain lift. Resolves when the spin finishes. */
  exit(duration: number): Promise<void>;
  /** Stop the loop, drop the GPU resources, remove the canvas. */
  dispose(): void;
}

/** Camera field of view, in degrees. Narrow keeps the extrusion honest — a
 *  wide lens on an object this close splays the side walls outward. */
const FOV = 30;

/** World height the mark is normalised to, before the reveal's scale tween. */
const MARK_UNITS = 2;

/**
 * Share of the frame's height the settled mark occupies — measured against the
 * bounding box, so perspective makes the real figure about a tenth larger, and
 * the exit's 1.14x scale has to stay inside the canvas too.
 */
const MARK_FILL = 0.72;

/**
 * Brand colour, read from the live custom property rather than hardcoded.
 *
 * The tokens invert between themes — `--color-bone` is #EDEDED on the dark
 * ground and #191420 on the light one — so a baked-in value would leave the
 * solid nearly invisible for half of all visitors. The fallbacks only matter
 * if the stylesheet has not applied yet, which the preloader outlives.
 */
function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * WebGL2, a real GPU, enough memory, and a connection worth spending on.
 *
 * A software rasteriser renders this at about 4fps, which is worse than no 3D
 * at all, so a missing context is a hard no and the caller uses the SVG draw.
 * The connection test matters just as much: three.js and the mesh are about a
 * third of a megabyte together, and on a metered or 2G connection that is a
 * real cost paid for an intro the reader would have missed the deadline on
 * anyway. `shouldLoadMark3D` is exported so the caller can skip the import
 * itself rather than pay for the module and then decline to use it.
 */
export function shouldLoadMark3D(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && /^(slow-)?2g$/.test(connection.effectiveType)) return false;
  return true;
}

function canRender(): boolean {
  if (typeof WebGL2RenderingContext === 'undefined') return false;
  if (!shouldLoadMark3D()) return false;
  // Coarse proxy for "this device will not enjoy a 30k-triangle scene".
  if ((navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined) {
    if ((navigator as Navigator & { deviceMemory?: number }).deviceMemory! < 2) return false;
  }
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Boot the scene into `canvas`.
 *
 * Resolves only once the GLB is decoded and the first frame has been drawn —
 * so the caller can hold the curtain until there is something to reveal, and
 * time out cleanly if that never happens. Rejects if WebGL is unavailable or
 * the asset fails to load; the caller falls back to the SVG mark.
 */
export async function initMark3D(canvas: HTMLCanvasElement): Promise<Mark3D> {
  if (!canRender()) throw new Error('webgl unavailable');

  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { RoomEnvironment } = await import('three/examples/jsm/environments/RoomEnvironment.js');

  const bone = new THREE.Color(token('--color-bone', '#ededed'));
  const rose = new THREE.Color(token('--color-rose', '#cb4a68'));

  /* On the light ground the mark inverts to near-black, and a near-black
     matte solid has almost no diffuse range to model with — it reads as a
     flat silhouette. What gives it form there is reflection, so the two
     themes want different surfaces: crisper and more reflective when the
     mark is dark, softer and more diffuse when it is bone. */
  const darkMark = bone.getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;

  const scene: Scene = new THREE.Scene();
  const camera: PerspectiveCamera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

  const renderer: WebGLRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  // Retina costs 4× the fill rate for a 300px logo. Two is already generous.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  // Transparent: the curtain behind it already paints the brand ground, and
  // matching that colour twice would drift the moment the theme changes.
  renderer.setClearColor(0x000000, 0);
  /* Khronos PBR Neutral rather than ACES. ACES is a film curve: it rolls
     saturated colour toward white as it approaches the top of the range, and
     the one saturated thing in this scene is the rose period — the brand's
     only accent. It came out of ACES as pale pink. Neutral was designed for
     exactly this case, and holds the hue. */
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* A procedural room instead of an HDR file: it costs a few milliseconds and
     no bytes over the wire, and it is what puts a readable specular edge on
     the extrusion. Without it the bevels have nothing to catch. */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  pmrem.dispose();

  /* ── Light ──────────────────────────────────────────────────────────────
     Key from the upper left to rake the extruded walls, a cool fill to keep
     the shadow side from going black, and a rose rim that ties the solid to
     the brand accent without tinting the face.

     The intensities are budgeted rather than dialled by eye: total irradiance
     on the key-facing surface lands near 1.0, so the rendered colours sit
     close to the tokens instead of being pushed up the tone curve. Bone
     survives overexposure — it is meant to be near white — but the rose
     period washes out to pale pink, and that is the brand's one accent
     colour rendered wrong. The Neutral curve holds hue far better than ACES
     did, but it is not a licence to overexpose; it just means the budget has
     some slack. Key ~0.66 of its intensity reaches a front face at this
     angle, fill ~0.44 of its own, and ambient and the environment in full. */
  const key = new THREE.DirectionalLight(0xffffff, darkMark ? 1.4 : 1.15);
  key.position.set(-2.4, 3.0, 3.2);
  const fill = new THREE.DirectionalLight(0xbfc6d8, darkMark ? 0.4 : 0.35);
  fill.position.set(3.0, -1.2, 1.6);
  const rim = new THREE.DirectionalLight(rose, darkMark ? 0.9 : 0.85);
  rim.position.set(1.6, 0.4, -3.0);
  scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, darkMark ? 0.3 : 0.22));

  /* ── Mesh ──────────────────────────────────────────────────────────────
     The GLB ships untextured: the generator's baked colour map was 550KB of
     JPEG carrying two flat colours, so it was replaced by two named
     materials — `ds-bone` for the contour, `ds-rose` for the period. The
     colours are re-asserted here rather than trusted from the file, so the
     brand tokens stay the single source of truth.                        */
  const loader = new GLTFLoader();
  /* No progress callback on purpose: the mesh is the smaller half of the
     wait — three.js itself is the rest, and its parse and compile report
     nothing — so a bar driven by these bytes alone would read as stalled at
     100% while the real work finished. The meter times the whole beat. */
  const gltf = await loader.loadAsync('/brand/ds-mark-3d.glb');

  const mark: Group = gltf.scene;
  mark.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as MeshStandardMaterial;
    const isPeriod = material.name === 'ds-rose';
    material.color.copy(isPeriod ? rose : bone);
    material.roughness = darkMark ? 0.42 : 0.5;
    material.metalness = 0.04;
    material.envMapIntensity = darkMark ? 0.9 : 0.35;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });

  /* ── Orientation ────────────────────────────────────────────────────────
     The generator does not promise an axis convention, and this mesh came out
     of it lying in the Y-Z plane: its face normal is +X, so a camera on +Z
     was looking straight down the 3mm edge of the plate. The logo is a flat
     extrusion, so its face normal is simply the shallowest axis of its own
     bounding box — turn that toward the camera and the framing is correct
     whatever the generator did.

     Which of the two square-on angles shows the FRONT rather than a mirrored
     back is not derivable from the geometry, so it is pinned here: for this
     mesh the readable face is +X, and -90° about Y brings +X onto +Z. A
     mirrored logo is a brand error, so re-check this if the mesh is ever
     regenerated. */
  const raw = new THREE.Box3().setFromObject(mark);
  const rawSize = raw.getSize(new THREE.Vector3());
  if (rawSize.x < rawSize.y && rawSize.x < rawSize.z) mark.rotation.y = -Math.PI / 2;
  else if (rawSize.z < rawSize.y && rawSize.z < rawSize.x) mark.rotation.y = 0;
  mark.updateMatrixWorld(true);

  /* Normalise whatever scale and origin the generator chose: centre the
     bounding box on the pivot, then scale so the tallest axis is 2 units.
     Without this the framing depends on a number we do not control. */
  const box = new THREE.Box3().setFromObject(mark);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const unit = MARK_UNITS / Math.max(size.x, size.y, size.z);
  mark.position.sub(centre).multiplyScalar(unit);
  mark.scale.setScalar(unit);

  /* A pivot wrapper so the tweens own rotation and scale outright and never
     fight the centring transform above. */
  const pivot = new THREE.Group();
  pivot.add(mark);
  scene.add(pivot);

  /* Frame on height: the mark is portrait, the stage is square, and the plate
     only ever narrows as it turns — so height is what has to fit, and it is
     the one dimension the animation does not change. */
  const fitHeight = MARK_UNITS / MARK_FILL;
  camera.position.set(0, 0, fitHeight / 2 / Math.tan((FOV * Math.PI) / 360));

  // Edge-on and slightly small: the state the reveal animates out of.
  pivot.rotation.set(0, -Math.PI / 2, 0);
  pivot.scale.setScalar(0.82);

  let width = 0;
  let height = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w === width && h === height) return;
    width = w;
    height = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();

  let running = true;
  let idle = 0; // Seconds of drift accumulated once the reveal has settled.
  let drifting = false;
  let last = performance.now();

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    resize();

    if (drifting) {
      idle += dt;
      // A slow yaw plus a shallower counter-rotating tilt, so the solid never
      // repeats the same silhouette while the page finishes loading.
      pivot.rotation.y = Math.sin(idle * 0.55) * 0.22;
      pivot.rotation.x = Math.sin(idle * 0.37) * 0.08;
    }

    renderer.render(scene, camera);
    if (running) requestAnimationFrame(frame);
  }

  // One synchronous frame before resolving: the caller is allowed to lift the
  // curtain the instant this promise settles, and an empty canvas would flash.
  renderer.render(scene, camera);
  requestAnimationFrame(frame);

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  /** Minimal easing pair — importing gsap here would defeat the code split. */
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t: number) => t * t * t;

  function tween(duration: number, onTick: (t: number) => void): Promise<void> {
    return new Promise((resolve) => {
      if (!running || duration <= 0) {
        onTick(1);
        resolve();
        return;
      }
      const started = performance.now();
      const step = (now: number) => {
        if (!running) {
          resolve();
          return;
        }
        const t = Math.min((now - started) / (duration * 1000), 1);
        onTick(t);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  return {
    async reveal(duration) {
      drifting = false;
      const fromY = -Math.PI / 2;
      await tween(duration, (t) => {
        const e = easeOutCubic(t);
        pivot.rotation.y = fromY * (1 - e);
        pivot.rotation.x = (1 - e) * -0.28;
        pivot.scale.setScalar(0.82 + 0.18 * e);
      });
      idle = 0;
      drifting = true;
    },

    async exit(duration) {
      drifting = false;
      const fromY = pivot.rotation.y;
      const fromX = pivot.rotation.x;
      await tween(duration, (t) => {
        const e = easeInCubic(t);
        // Away from the viewer, not toward: the curtain is lifting over it.
        pivot.rotation.y = fromY + e * Math.PI * 0.85;
        pivot.rotation.x = fromX * (1 - e);
        pivot.scale.setScalar(1 + e * 0.14);
      });
    },

    dispose() {
      running = false;
      observer.disconnect();
      scene.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          const standard = material as MeshStandardMaterial;
          standard.map?.dispose();
          standard.dispose();
        });
      });
      environment.dispose();
      renderer.dispose();
      // Frees the GL context immediately instead of waiting for the GC — the
      // browser caps concurrent contexts and this one is never coming back.
      renderer.forceContextLoss();
    },
  };
}
