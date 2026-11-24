/* =========================================================
   FM estudio · main.js
   Three.js (pieza procedural) + GSAP ScrollTrigger + Lenis
   ========================================================= */

const CONFIG = {
  // Endpoint del formulario (Formspree, Basin, tu API…). Vacío = modo demostración.
  FORM_ENDPOINT: '',
  // REEMPLAZAR por la ruta de tu modelo, p. ej. 'assets/pieza.glb'. null = pieza procedural.
  CUSTOM_MODEL_URL: null,
  CONTACT_EMAIL: 'mome3219@gmail.com',
};

const doc = document.documentElement;
// ?motion=1 fuerza la animación (solo para pruebas en un navegador con movimiento reducido).
const forceMotion = new URLSearchParams(window.location.search).has('motion');
const reduceMotion = !forceMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const mqMobile = window.matchMedia('(max-width: 767px)');
let isMobile = mqMobile.matches;
const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
const motion = !reduceMotion && hasGSAP;
doc.classList.add(motion ? 'js-motion' : 'static');

/* ---------------------------------------------------------
   Coreografía: un estado por sección (data-stage en el HTML).
   Cada etapa hereda de la anterior y solo cambia lo que indica.
   x / y: fracción de medio viewport (−1…1). s: escala.
   --------------------------------------------------------- */
const BASE = {
  x: 0.42, y: 0, s: 1, camZ: 6,
  rough: 1, reveal: 0, wire: 0.9, points: 1, psize: 0.035,
  explode: 0, slice: 0,
  metal: 0, rgh: 0.9, clear: 0, irid: 0, env: 0.55, color: '#B9BFC7',
  rings: 0, bloom: 0, spin: 0.12, turn: 0, tilt: 0, grid: 1,
};
const PI = Math.PI;
const RAW_STAGES = [
  /* 0 Hero        */ { label: 'boceto' },
  /* 1 Diseño 3D   */ { label: 'malla', rough: 0.85, psize: 0.06, turn: PI * 0.5 },
  /* 2 Desarrollo  */ { label: 'corte', rough: 0.6, reveal: 1, wire: 0.2, points: 0, slice: 1, rgh: 0.6, color: '#8A929C', tilt: 0.35, turn: PI },
  /* 3 Tiendas     */ { label: 'producto', rough: 0.4, wire: 0, slice: 0, tilt: 0, rgh: 0.85, color: '#B9BFC7', s: 0.9, camZ: 5.5, spin: 0.6 },
  /* 4 Mantenim.   */ { label: 'acabado', rough: 0.28, rgh: 0.35, metal: 0.15, env: 0.75, clear: 0.6, color: 'config', s: 1, camZ: 6, spin: 0.08 },
  /* 5 Descubrim.  */ { label: 'piezas', x: 0.5, s: 0.85, rough: 0.7, reveal: 0, wire: 1, points: 0.4, psize: 0.035, explode: 0.75, camZ: 7.2, metal: 0, clear: 0, env: 0.55, color: '#B9BFC7', rgh: 0.9, spin: 0.1, grid: 0.8 },
  /* 6 Diseño      */ { label: 'forma', rough: 0.55, reveal: 1, wire: 0.12, points: 0, explode: 0.42, camZ: 6.6, grid: 0.6 },
  /* 7 Desarr. 3D  */ { label: 'ajuste', rough: 0.3, wire: 0, explode: 0.14, rgh: 0.45, metal: 0.35, env: 0.8, color: '#9BA3AD', camZ: 6.2, grid: 0.35, turn: PI * 1.5 },
  /* 8 Lanzamiento */ { label: 'pulido', x: 0.42, s: 1, rough: 0.06, explode: 0, rgh: 0.16, metal: 1, clear: 0.5, env: 1, color: '#C7CEDA', camZ: 6, grid: 0.08, turn: PI * 3 },
  /* 9 Portafolio  */ { label: 'vitrina', x: 0.8, y: -0.4, s: 0.42, rough: 0.04, rgh: 0.22, clear: 0.6, color: '#7A8494', grid: 0, spin: 0.15 },
  /* 10 Resultados */ { label: 'medición', x: 0.45, y: 0, s: 0.8, rgh: 0.12, clear: 0.8, color: '#B9C2D4', rings: 1, turn: PI * 3.5 },
  /* 11 Contacto   */ { label: 'terminada', x: 0.55, s: 0.95, camZ: 5.4, rough: 0, rgh: 0.07, clear: 1, irid: 0.7, color: '#DCE2FF', rings: 0, bloom: 0.35, env: 1.3, spin: 0.08, turn: PI * 4 },
];
// En móvil la pieza vive en la mitad superior; en secciones largas pasa a una esquina.
const MOBILE_OVERRIDES = { 9: { x: 0.55, y: 0.72, s: 0.32 }, 10: { x: 0.5, y: 0.64, s: 0.42 }, 11: { x: 0.45, y: 0.64, s: 0.5 } };
const KEYS = Object.keys(BASE).filter((k) => k !== 'color');

/* ---------------------------------------------------------
   Shaders: desplazamiento procedural compartido
   --------------------------------------------------------- */
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const DISPLACE_GLSL = /* glsl */ `
uniform float uRough;
uniform float uTime;
${NOISE_GLSL}
float heightAt(vec3 n){
  float t = uTime * 0.04;
  return snoise(n * 1.3 + vec3(t, 0.0, 0.0)) * 0.55
       + snoise(n * 2.9 - vec3(0.0, t, 0.0)) * 0.30
       + snoise(n * 6.1) * 0.15;
}
// Canto rodado: esfera achatada + ruido proporcional a la rugosidad.
vec3 dispP(vec3 p){
  vec3 n = normalize(p);
  vec3 q = n * (1.0 + uRough * 0.32 * heightAt(n));
  q.y *= 0.84;
  return q;
}
`;

const U = {
  uRough: { value: 1 },
  uTime: { value: 0 },
  uReveal: { value: 0 },
  uSlice: { value: 0 },
  uEdge: { value: null },
};

function patchMaterial(mat, kind) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    if (kind === 'solid') {
      shader.vertexShader = `varying vec3 vObj;\n${DISPLACE_GLSL}\n${shader.vertexShader}`
        .replace('#include <beginnormal_vertex>', /* glsl */ `
          vec3 n0 = normalize(position);
          vec3 tg = normalize(cross(n0, abs(n0.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
          vec3 bt = cross(n0, tg);
          vec3 dp = dispP(n0);
          vec3 objectNormal = normalize(cross(dispP(n0 + tg * 0.012) - dp, dispP(n0 + bt * 0.012) - dp));
          vObj = position;
        `)
        .replace('#include <begin_vertex>', 'vec3 transformed = dp;');

      shader.fragmentShader = `varying vec3 vObj;\nuniform float uReveal;\nuniform float uSlice;\nuniform vec3 uEdge;\n${NOISE_GLSL}\n${shader.fragmentShader}`
        .replace('#include <clipping_planes_fragment>', /* glsl */ `
          #include <clipping_planes_fragment>
          float edgeGlow = 0.0;
          if (uReveal < 0.999) {
            float dn = snoise(vObj * 2.2) * 0.5 + 0.5;
            float thr = uReveal * 1.2 - 0.1;
            if (dn > thr) discard;
            edgeGlow = smoothstep(thr - 0.07, thr, dn);
          }
          if (uSlice > 0.001 && fract(vObj.y * 7.0 + 0.25) < uSlice * 0.45) discard;
        `)
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uEdge * edgeGlow;');
    } else {
      shader.vertexShader = `${DISPLACE_GLSL}\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', 'vec3 transformed = dispP(position) * 1.004;');
    }
  };
  mat.customProgramCacheKey = () => `fm-${kind}`;
}

/* ---------------------------------------------------------
   Estado global
   --------------------------------------------------------- */
let THREE, RoomEnvironment;
let renderer, scene, camera, root3, piece, halo, customModel = null, customMat = null;
let solidMat, wireMat, ptsMat;
const gajos = [];
const rings = [];
let stages = [];
let stageEls = [];
let stops = [];
let lenis = null;
let webglOK = false;
let configColor = null;
let tgtColor = null, curColor = null;
const cur = {};
const tgt = {};
let spinAcc = 0;
let storyP = 0;
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

/* ---------------------------------------------------------
   Pantalla de carga con progreso real (pasos completados)
   --------------------------------------------------------- */
const loaderEl = $('#loader');
const loaderNum = $('#loader-num');
const loaderBar = loaderEl ? $('.loader__bar', loaderEl) : null;
let progressTarget = 0;
let progressShown = 0;
let loaderRaf = 0;

function bump(n) { progressTarget = Math.min(100, progressTarget + n); }
function loaderLoop() {
  progressShown += (progressTarget - progressShown) * 0.2;
  if (progressTarget - progressShown < 0.4) progressShown = progressTarget;
  if (loaderNum) loaderNum.textContent = Math.round(progressShown);
  if (loaderBar) loaderBar.style.transform = `scaleX(${progressShown / 100})`;
  loaderRaf = requestAnimationFrame(loaderLoop);
}
function finishLoader() {
  progressTarget = 100;
  return new Promise((resolve) => {
    const check = () => {
      if (!loaderEl || !loaderEl.isConnected || progressShown >= 99.5) {
        cancelAnimationFrame(loaderRaf);
        doc.classList.remove('is-loading');
        doc.classList.add('is-ready');
        if (loaderEl && loaderEl.isConnected) {
          loaderEl.classList.add('is-done');
          loaderEl.setAttribute('aria-hidden', 'true');
          setTimeout(() => loaderEl.remove(), reduceMotion ? 260 : 900);
        }
        resolve();
      } else requestAnimationFrame(check);
    };
    check();
  });
}

function loadFonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const fonts = ['400 1em "Familjen Grotesk"', '700 1em "Familjen Grotesk"', '400 1em "Martian Mono"'];
  const timeout = new Promise((r) => setTimeout(r, 2500));
  return Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), timeout]).catch(() => {});
}

/* ---------------------------------------------------------
   Escena
   --------------------------------------------------------- */
function buildStages() {
  let prev = { ...BASE };
  return RAW_STAGES.map((raw, i) => {
    const s = { ...prev, ...raw };
    prev = s;
    const out = { ...s };
    if (isMobile) Object.assign(out, { x: 0, y: 0.58 }, MOBILE_OVERRIDES[i] || {});
    out.colorObj = out.color === 'config' ? null : new THREE.Color(out.color);
    return out;
  });
}

function makeHaloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.28)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildScene() {
  const canvas = $('#scene');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile || window.devicePixelRatio < 2,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  camera.position.set(0, 0, 6);

  // Entorno de estudio procedural (sin descargar HDRI).
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3, 4, 5);
  const rim = new THREE.DirectionalLight(0xaeb9ff, 2.2);
  rim.position.set(-4, 1.5, -3);
  scene.add(key, rim);

  configColor = new THREE.Color('#B9BFC7');
  tgtColor = new THREE.Color('#C9CDD2');
  curColor = new THREE.Color('#C9CDD2');
  U.uEdge.value = new THREE.Color('#5867FF').multiplyScalar(2.2);

  solidMat = new THREE.MeshPhysicalMaterial({
    color: '#C9CDD2',
    roughness: 0.9,
    metalness: 0,
    side: THREE.DoubleSide,
    clearcoat: 0.001, // > 0 desde el inicio: evita recompilar al animar
    clearcoatRoughness: 0.12,
    iridescence: 0.001,
    iridescenceIOR: 1.35,
    iridescenceThicknessRange: [120, 420],
  });
  wireMat = new THREE.MeshBasicMaterial({ color: '#3A414B', wireframe: true, transparent: true, opacity: 0.9, depthWrite: false });
  ptsMat = new THREE.PointsMaterial({ color: '#2433C8', size: 0.035, sizeAttenuation: true, transparent: true, depthWrite: false });
  patchMaterial(solidMat, 'solid');
  patchMaterial(wireMat, 'wire');
  patchMaterial(ptsMat, 'points');

  root3 = new THREE.Group();
  piece = new THREE.Group();
  root3.add(piece);
  scene.add(root3);

  // La pieza: 4 gajos de esfera. Geometría liviana en móvil.
  const hi = isMobile ? { w: 12, h: 40 } : { w: 24, h: 72 };
  const lo = isMobile ? { w: 7, h: 12 } : { w: 10, h: 16 };
  for (let i = 0; i < 4; i++) {
    const phiStart = (i * PI) / 2;
    const gHi = new THREE.SphereGeometry(1, hi.w, hi.h, phiStart, PI / 2);
    const gLo = new THREE.SphereGeometry(1, lo.w, lo.h, phiStart, PI / 2);
    const group = new THREE.Group();
    const solid = new THREE.Mesh(gHi, solidMat);
    const wire = new THREE.Mesh(gLo, wireMat);
    const pts = new THREE.Points(gLo, ptsMat);
    solid.frustumCulled = wire.frustumCulled = pts.frustumCulled = false;
    group.add(solid, wire, pts);
    const mid = phiStart + PI / 4;
    gajos.push({ group, solid, wire, pts, dir: new THREE.Vector3(-Math.cos(mid), 0, Math.sin(mid)) });
    piece.add(group);
  }

  // Anillos de medición (sección Resultados)
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshBasicMaterial({ color: '#AEB9FF', transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.32 + i * 0.17, 0.0035, 6, 180), m);
    r.rotation.set(PI / 2 + (i - 1) * 0.35, i * 0.6, 0);
    r.visible = false;
    rings.push(r);
    root3.add(r);
  }

  // Halo suave en la forma final (sustituye al bloom por post-proceso: ver README en el chat)
  halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeHaloTexture(), color: '#AEB9FF', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  halo.renderOrder = -1;
  scene.add(halo);

  stages = buildStages();
  KEYS.forEach((k) => { cur[k] = BASE[k]; tgt[k] = BASE[k]; });
  resizeRenderer();
}

async function compileScene() {
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  else renderer.compile(scene, camera);
}

/* Modelo .glb propio (opcional). Sustituye la pieza procedural;
   hereda color, metal, rugosidad y movimiento de cada sección. */
async function loadCustomModel(url) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
  model.position.sub(sphere.center);
  customMat = new THREE.MeshPhysicalMaterial({ color: '#C9CDD2', clearcoat: 0.001, iridescence: 0.001, iridescenceIOR: 1.35 });
  model.traverse((o) => { if (o.isMesh) o.material = customMat; });
  customModel = new THREE.Group();
  customModel.add(model);
  customModel.scale.setScalar(1 / sphere.radius);
  piece.visible = false;
  root3.add(customModel);
}

function resizeRenderer() {
  if (!renderer) return;
  const canvas = renderer.domElement;
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ---------------------------------------------------------
   Scroll → estado
   --------------------------------------------------------- */
function computeStops() {
  const vh = window.innerHeight;
  const max = Math.max(0, doc.scrollHeight - vh);
  stops = stageEls.map((el) => {
    const r = el.getBoundingClientRect();
    const c = r.top + window.scrollY + r.height / 2 - vh / 2;
    return clamp(c, 0, max);
  });
  for (let i = 1; i < stops.length; i++) stops[i] = Math.max(stops[i], stops[i - 1]);
}

function sampleStory(y) {
  const n = stages.length;
  let i = 0;
  while (i < n - 1 && y >= stops[i + 1]) i++;
  let t = 0;
  if (i < n - 1) {
    const span = stops[i + 1] - stops[i];
    t = span > 0 ? clamp((y - stops[i]) / span) : 1;
  }
  const j = Math.min(i + 1, n - 1);
  const a = stages[i];
  const b = stages[j];
  const e = t * t * (3 - 2 * t);
  for (const k of KEYS) tgt[k] = a[k] + (b[k] - a[k]) * e;
  tgtColor.copy(a.colorObj || configColor).lerp(b.colorObj || configColor, e);
  storyP = i + t;
}

/* ---------------------------------------------------------
   Aplicar estado a la escena
   --------------------------------------------------------- */
function applyState(c, dt) {
  U.uRough.value = c.rough;
  U.uReveal.value = c.reveal;
  U.uSlice.value = c.slice;

  const mats = customMat ? [solidMat, customMat] : [solidMat];
  for (const m of mats) {
    m.color.copy(curColor);
    m.roughness = c.rgh;
    m.metalness = c.metal;
    m.clearcoat = Math.max(0.001, c.clear);
    m.iridescence = Math.max(0.001, c.irid);
    m.envMapIntensity = c.env;
  }
  wireMat.opacity = c.wire;
  ptsMat.opacity = c.points;
  ptsMat.size = c.psize;

  for (const g of gajos) {
    g.solid.visible = c.reveal > 0.002;
    g.wire.visible = c.wire > 0.01;
    g.pts.visible = c.points > 0.01;
    g.group.position.copy(g.dir).multiplyScalar(c.explode);
  }

  camera.position.z = c.camZ;
  const halfH = c.camZ * Math.tan((camera.fov * PI) / 360);
  const halfW = halfH * camera.aspect;
  const fit = Math.min(1, halfW * (isMobile ? 0.72 : 0.5));
  // Nunca invadir la columna de texto: el radio no pasa del espacio libre a su lado.
  const room = isMobile ? Math.min(halfW * 0.95, halfH * 0.32) : halfW * (1 - Math.abs(c.x)) * 0.95;
  const scale = Math.min(c.s * fit, room);
  root3.position.set(c.x * halfW, c.y * halfH, 0);
  root3.scale.setScalar(scale);

  spinAcc += dt * c.spin;
  root3.rotation.set(c.tilt + mouse.y * 0.12, spinAcc + c.turn + mouse.x * 0.16, 0);

  rings.forEach((r, i) => {
    r.material.opacity = c.rings * (0.55 - i * 0.12);
    r.visible = c.rings > 0.01;
    r.rotation.z += dt * (0.08 + i * 0.05) * (i % 2 ? -1 : 1);
  });

  halo.material.opacity = c.bloom;
  halo.visible = c.bloom > 0.01;
  halo.position.set(root3.position.x, root3.position.y, -1.4);
  halo.scale.setScalar(scale * 5.2);
}

/* ---------------------------------------------------------
   UI ligada a la historia
   --------------------------------------------------------- */
const gridEl = $('.grid-overlay');
const readState = $('#readout-state');
const readRough = $('#readout-rough');
const indexLinks = $$('.index a');
const progressEl = $('#progress');
const progressItems = progressEl ? $$('li', progressEl) : [];
const readoutEl = $('.readout');
const ui = { grid: -1, label: '', rough: '', svc: -2, proc: -1, procIdx: -2, nearEnd: null };

function updateUI(c) {
  if (gridEl && Math.abs(c.grid - ui.grid) > 0.005) { gridEl.style.opacity = c.grid.toFixed(3); ui.grid = c.grid; }
  const nearEnd = window.scrollY > doc.scrollHeight - window.innerHeight * 1.35;
  if (readoutEl && nearEnd !== ui.nearEnd) { readoutEl.style.opacity = nearEnd ? '0' : '1'; ui.nearEnd = nearEnd; }
  const st = stages[Math.round(clamp(storyP, 0, stages.length - 1))];
  if (readState && st.label !== ui.label) { readState.textContent = st.label; ui.label = st.label; }
  const r = c.rough.toFixed(2);
  if (readRough && r !== ui.rough) { readRough.textContent = r; ui.rough = r; }

  const svc = storyP > 0.5 && storyP < 4.5 ? Math.round(storyP) - 1 : -1;
  if (svc !== ui.svc) {
    indexLinks.forEach((a, i) => (i === svc ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    ui.svc = svc;
  }
  if (progressEl) {
    const p = clamp((storyP - 5) / 3);
    if (Math.abs(p - ui.proc) > 0.002) { progressEl.style.setProperty('--p', p.toFixed(3)); ui.proc = p; }
    const idx = storyP > 4.5 && storyP < 8.5 ? Math.round(storyP) - 5 : -1;
    if (idx !== ui.procIdx) { progressItems.forEach((li, i) => li.classList.toggle('is-active', i === idx)); ui.procIdx = idx; }
  }
}

/* ---------------------------------------------------------
   Bucles de render
   --------------------------------------------------------- */
let firstFrame = true;
function tick(time, deltaTime) {
  const dt = Math.min((deltaTime || 16) / 1000, 0.05);
  sampleStory(window.scrollY);

  if (firstFrame) {
    KEYS.forEach((k) => (cur[k] = tgt[k]));
    curColor.copy(tgtColor);
    firstFrame = false;
  } else {
    for (const k of KEYS) cur[k] = damp(cur[k], tgt[k], 6, dt);
    curColor.lerp(tgtColor, 1 - Math.exp(-6 * dt));
  }
  mouse.x = damp(mouse.x, mouse.tx, 3.5, dt);
  mouse.y = damp(mouse.y, mouse.ty, 3.5, dt);

  U.uTime.value = time;
  applyState(cur, dt);
  updateUI(cur);
  renderer.render(scene, camera);
}

// Movimiento reducido: pieza terminada, quieta, sin scroll ligado.
function setStaticState() {
  const f = stages[stages.length - 1];
  const h = stages[0];
  KEYS.forEach((k) => (cur[k] = f[k]));
  Object.assign(cur, { x: h.x, y: h.y, s: h.s * 0.95, camZ: 6, rings: 0, bloom: 0.2, spin: 0, turn: 0.6, tilt: 0.12 });
  curColor.copy(f.colorObj);
}
function renderStatic() {
  if (!webglOK) return;
  applyState(cur, 0);
  renderer.render(scene, camera);
}

/* ---------------------------------------------------------
   Interacción y UI independiente del 3D
   --------------------------------------------------------- */
function setupLinks() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    if (a.hasAttribute('data-placeholder-link')) { e.preventDefault(); return; }
    const href = a.getAttribute('href') || '';
    if (!href.startsWith('#') || href.length < 2) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    e.preventDefault();
    const done = () => {
      target.focus({ preventScroll: true });
      history.replaceState(null, '', href);
    };
    if (lenis) lenis.scrollTo(target, { duration: 1.3, onComplete: done });
    else { target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' }); done(); }
  });
}

function setupSwatches() {
  const btns = $$('.swatch');
  btns.forEach((b) => b.addEventListener('click', () => {
    btns.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    if (!configColor) return;
    configColor.set(b.dataset.color);
    if (!motion) { curColor.set(b.dataset.color); renderStatic(); }
  }));
}

function setupTheme() {
  const dz = $('.dark-zone');
  const meta = $('meta[name="theme-color"]');
  if (dz && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      const dark = e.isIntersecting || e.boundingClientRect.top < 0;
      doc.classList.toggle('in-dark', dark);
      if (meta) meta.setAttribute('content', dark ? '#0D0F14' : '#ECEEF0');
    }, { rootMargin: '-45% 0px -54% 0px' }).observe(dz);
  }
  const onScroll = () => doc.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function setupForm() {
  const form = $('#contact-form');
  if (!form) return;
  const status = $('#form-status');
  const btn = $('button[type="submit"]', form);
  const messages = {
    'f-name': { valueMissing: 'Escribe tu nombre.' },
    'f-email': { valueMissing: 'Escribe tu email.', typeMismatch: 'Revisa el email: debería parecerse a nombre@empresa.com.' },
    'f-message': { valueMissing: 'Cuéntanos en una frase qué necesitas.' },
  };
  const validate = (field) => {
    const err = document.getElementById(`${field.id}-error`);
    const m = messages[field.id] || {};
    let msg = '';
    if (field.validity.valueMissing || (field.required && !field.value.trim())) msg = m.valueMissing || 'Campo obligatorio.';
    else if (field.validity.typeMismatch) msg = m.typeMismatch || 'Revisa este campo.';
    if (err) err.textContent = msg;
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  };
  const fields = $$('[required]', form);
  fields.forEach((f) => f.addEventListener('blur', () => { if (f.getAttribute('aria-invalid') === 'true' || f.value) validate(f); }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    status.classList.remove('is-ok');
    let firstBad = null;
    fields.forEach((f) => { if (!validate(f) && !firstBad) firstBad = f; });
    if (firstBad) { firstBad.focus(); return; }

    if (!CONFIG.FORM_ENDPOINT) {
      status.textContent = 'Modo demostración: el formulario aún no está conectado, así que no se ha enviado nada. Configura FORM_ENDPOINT en main.js.';
      return;
    }
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    try {
      const res = await fetch(CONFIG.FORM_ENDPOINT, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
      if (!res.ok) throw new Error(String(res.status));
      const email = $('#f-email').value;
      form.reset();
      status.textContent = `Recibido. Te escribiremos a ${email} con la propuesta.`;
      status.classList.add('is-ok');
    } catch (err) {
      status.textContent = `No se pudo enviar. Escríbenos directamente a ${CONFIG.CONTACT_EMAIL}.`;
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}

/* ---------------------------------------------------------
   Scroll (Lenis + ScrollTrigger)
   --------------------------------------------------------- */
function setupMotion() {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  if (typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Titulares: la máscara se traza como una línea de cota.
  $$('.draw').forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => el.classList.add('is-drawn') }));
  $$('.metric').forEach((el) => ScrollTrigger.create({ trigger: el, start: 'top 82%', once: true, onEnter: () => el.classList.add('is-drawn') }));

  // Fondo: de papel técnico a estudio.
  const header = $('#site-header');
  const lerpBg = gsap.utils.interpolate('#ECEEF0', '#0D0F14');
  const setBg = (p) => {
    const c = lerpBg(p);
    doc.style.backgroundColor = c;
    header.style.backgroundColor = c;
  };
  ScrollTrigger.create({
    trigger: '.dark-zone',
    start: 'top 90%',
    end: 'top 35%',
    onUpdate: (s) => setBg(s.progress),
    onRefresh: (s) => setBg(s.progress),
  });

  ScrollTrigger.addEventListener('refresh', computeStops);

  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }
}

function setupResize() {
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  let raf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mobileNow = mqMobile.matches;
      // En móvil, la barra de direcciones cambia la altura: lo ignoramos.
      if (w === lastW && Math.abs(h - lastH) < 140 && mobileNow === isMobile) return;
      lastW = w; lastH = h;
      if (mobileNow !== isMobile) {
        isMobile = mobileNow;
        if (webglOK) stages = buildStages();
      }
      if (webglOK) {
        resizeRenderer();
        if (!motion) { setStaticState(); renderStatic(); }
      }
      computeStops();
    });
  });
}

/* ---------------------------------------------------------
   Arranque
   --------------------------------------------------------- */
async function boot() {
  loaderLoop();
  setupLinks();
  setupSwatches();
  setupTheme();
  setupForm();
  stageEls = $$('[data-stage]').sort((a, b) => Number(a.dataset.stage) - Number(b.dataset.stage));
  if (motion) setupMotion();
  setupResize();

  try {
    await Promise.all([
      loadFonts().then(() => bump(20)),
      import('three').then((m) => { THREE = m; bump(25); }),
      import('three/addons/environments/RoomEnvironment.js').then((m) => { RoomEnvironment = m.RoomEnvironment; bump(10); }),
    ]);
    buildScene();
    bump(15);
    if (CONFIG.CUSTOM_MODEL_URL) await loadCustomModel(CONFIG.CUSTOM_MODEL_URL);
    await compileScene();
    bump(20);
    webglOK = true;
  } catch (err) {
    console.warn('[fm] 3D desactivado:', err && err.message ? err.message : err);
    doc.classList.add('no-webgl');
  }

  computeStops();
  if (webglOK) {
    if (motion) {
      tick(0, 16);
      window.gsap.ticker.add((t, d) => tick(t, d));
    } else {
      setStaticState();
      renderStatic();
    }
  }
  bump(10);

  if (lenis) lenis.stop();
  await finishLoader();
  if (lenis) lenis.start();
  if (motion) window.ScrollTrigger.refresh();
}

boot();
