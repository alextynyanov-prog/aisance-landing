/* AISANCE · вариант 2 — фоновая сцена «Цепь».
   Одна модель состояния, привязанная к скроллу, и два способа её отрисовки:
   Three.js на десктопе и лёгкий SVG на телефонах и планшетах.
   Только абстрактная геометрия — точки и линия. Никакой анатомии. */

const N = 9;          // узлов в цепи
const CAUSE = 2;      // узел-причина: ближе к краю, смещается и тускнеет
const PAIN = 6;       // узел-сигнал: светится там, где «чувствуется»
const CREAM = '#E9E4D6';
const ACCENT = '#7FA087';
const NODE_A = 0.66;  // прозрачность спокойного узла: сцена фоновая, не спорит с текстом

/* Базовая форма — плавная S-кривая, родственная росчерку логотипа. */
const BASE = Array.from({ length: N }, (_, i) => {
  const u = i / (N - 1);
  return [
    -4 + 8 * u,
    0.55 * Math.sin(u * Math.PI * 1.6 + 0.3) - 0.35 * u + 0.1,
    0.9 * Math.sin(u * Math.PI * 1.1)
  ];
});
/* Насколько каждый узел втянут в компенсацию: причина — полностью, соседи — затухая. */
const COMP = [0.15, 0.45, 1, 0.55, 0.25, 0.08, 0.12, 0, 0];
const DIR = [0.05, -0.62, 0.55];

const clamp = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };

const secComp = document.getElementById('compensation');
const secMethod = document.getElementById('method');
const secProcess = document.getElementById('process');
const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let forced = null; // только для отладки: ?chain-debug
const DEBUG = /[?&]chain-debug\b/.test(location.search);

/* Скролл → три величины: расхождение, выравнивание, уход сцены. */
function readScroll() {
  if (forced) return forced;
  const vh = window.innerHeight;
  const c = secComp.getBoundingClientRect();
  const m = secMethod.getBoundingClientRect();
  const p = secProcess.getBoundingClientRect();
  return {
    diverge: smooth((vh * 0.9 - c.top) / (c.height * 0.65)),
    realign: smooth((vh * 0.55 - m.top) / (m.height * 0.75)),
    fade: smooth((vh * 0.95 - p.top) / (vh * 0.55))
  };
}

/* Состояние цепи. Выравнивание идёт волной от узла-причины наружу:
   сначала выправляется смещённый узел, потом соседи, и только когда волна
   доходит до светящегося узла, он гаснет — как следствие, а не от прямого воздействия. */
function solve(s, t) {
  const front = s.realign * 6.4;
  const pts = [];
  let causeK = 0;
  for (let i = 0; i < N; i++) {
    const aligned = smooth((front - Math.abs(i - CAUSE)) / 1.3);
    const k = COMP[i] * s.diverge * (1 - aligned);
    if (i === CAUSE) causeK = k;
    const b = BASE[i];
    const breath = motion ? 0.045 * Math.sin(t * 0.55 + i * 0.8) : 0;
    pts.push([b[0] + DIR[0] * k, b[1] + DIR[1] * k + breath, b[2] + DIR[2] * k]);
  }
  const painAligned = smooth((front - (PAIN - CAUSE) - 0.6) / 1.3);
  return {
    pts,
    causeK,
    glow: s.diverge * (1 - painAligned),
    pulse: motion ? 1 + 0.2 * Math.sin(t * 2.3) : 1,
    angle: 0.6 * Math.sin(Math.PI * s.realign)
  };
}

/* Хвосты росчерка за крайними узлами. */
function tails(pts) {
  const ext = (p, q) => [p[0] + (p[0] - q[0]) * 1.1, p[1] + (p[1] - q[1]) * 1.1, p[2] + (p[2] - q[2]) * 1.1];
  return [ext(pts[0], pts[1]), ...pts, ext(pts[N - 1], pts[N - 2])];
}

/* Сплайн Катмулла — Рома через узлы. */
function catmull(pts, seg) {
  const out = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i ? i - 1 : 0], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2 < n ? i + 2 : n - 1];
    for (let j = 0; j < seg; j++) {
      const t = j / seg, t2 = t * t, t3 = t2 * t;
      const o = [0, 0, 0];
      for (let d = 0; d < 3; d++) {
        o[d] = 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t +
          (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 +
          (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3);
      }
      out.push(o);
    }
  }
  out.push(pts[n - 1]);
  return out;
}

function hexMix(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',') + ')';
}

/* ---------------- WebGL (десктоп) ---------------- */
async function startGL(canvas) {
  const THREE = await import('./vendor/three.module.min.js');
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'low-power',
    preserveDrawingBuffer: DEBUG // только в отладке: позволяет снять кадр
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);
  const group = new THREE.Group();
  group.position.set(0.6, -1.05, 0);
  group.scale.setScalar(0.92);
  scene.add(group);

  const cream = new THREE.Color(CREAM);
  const accent = new THREE.Color(ACCENT);

  // линия: прозрачность затухает к хвостам, как у росчерка пером
  const SEG = 18;
  const count = (N + 1) * SEG + 1;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1);
    col.set([cream.r, cream.g, cream.b, 0.34 * smooth(Math.min(u, 1 - u) / 0.12)], i * 4);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
  line.frustumCulled = false;
  group.add(line);

  const sphere = new THREE.SphereGeometry(0.046, 16, 12);
  const nodes = BASE.map(() => {
    const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: CREAM, transparent: true, opacity: NODE_A, depthWrite: false }));
    group.add(m);
    return m;
  });

  // кольцо на «нормальной оси» причины — видно, откуда узел сместился
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 0.112, 48),
    new THREE.MeshBasicMaterial({ color: CREAM, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
  );
  ring.position.set(...BASE[CAUSE]);
  group.add(ring);

  // мягкое свечение узла-сигнала
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: ACCENT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  group.add(halo);

  function draw(st) {
    const curve = catmull(tails(st.pts), SEG);
    for (let i = 0; i < curve.length; i++) pos.set(curve[i], i * 3);
    lineGeo.attributes.position.needsUpdate = true;

    st.pts.forEach((p, i) => nodes[i].position.set(p[0], p[1], p[2]));
    nodes[CAUSE].material.opacity = NODE_A - 0.45 * st.causeK;
    nodes[PAIN].material.opacity = NODE_A + (1 - NODE_A) * st.glow;
    ring.material.opacity = 0.4 * st.causeK;

    const pain = nodes[PAIN];
    pain.material.color.copy(cream).lerp(accent, st.glow);
    pain.scale.setScalar(1 + 0.6 * st.glow * st.pulse);
    halo.position.copy(pain.position);
    halo.material.opacity = 0.7 * st.glow;
    halo.scale.setScalar(1.1 * st.pulse);

    group.rotation.y = st.angle;
    group.rotation.x = 0.1 * st.angle;
    renderer.render(scene, camera);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w / h < 1.3 ? 14 : 11;
    camera.updateProjectionMatrix();
  }

  const t0 = performance.now();
  let raf = 0;
  function tick(now) {
    raf = 0;
    const s = readScroll();
    canvas.style.opacity = String(1 - s.fade);
    if (s.fade >= 1 || document.hidden) return; // сцена ушла — не рендерим, ждём скролла
    draw(solve(s, (now - t0) / 1000));
    if (motion) raf = requestAnimationFrame(tick);
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', () => { resize(); wake(); });
  document.addEventListener('visibilitychange', wake);
  resize();
  wake();
  const now = () => { const s = readScroll(); canvas.style.opacity = String(1 - s.fade); draw(solve(s, (performance.now() - t0) / 1000)); };
  return { wake, now };
}

/* ---------------- SVG (телефоны, планшеты, запасной вариант) ----------------
   Те же состояния, без объёма и вращения. Перерисовка только на скролл,
   без постоянного цикла анимации — бережём батарею. */
function startSVG(svg) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    svg.appendChild(e);
    return e;
  };
  svg.setAttribute('viewBox', '-5.2 -2.6 10.4 5.2');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const path = el('path', { class: 'ch-line' });
  const ring = el('circle', { class: 'ch-ring', r: 0.17, cx: BASE[CAUSE][0], cy: -BASE[CAUSE][1] });
  const halo = el('circle', { class: 'ch-halo', r: 0.42 });
  const dots = BASE.map(() => el('circle', { class: 'ch-node', r: 0.085 }));

  let raf = 0;
  function tick() {
    raf = 0;
    const s = readScroll();
    svg.style.opacity = String(1 - s.fade);
    if (s.fade >= 1) return;
    const st = solve(s, 0);
    const curve = catmull(tails(st.pts), 12);
    path.setAttribute('d', 'M' + curve.map(p => p[0].toFixed(3) + ' ' + (-p[1]).toFixed(3)).join('L'));
    st.pts.forEach((p, i) => {
      dots[i].setAttribute('cx', p[0].toFixed(3));
      dots[i].setAttribute('cy', (-p[1]).toFixed(3));
    });
    dots[CAUSE].style.opacity = String(1 - 0.65 * st.causeK);
    ring.style.opacity = String(0.45 * st.causeK);
    dots[PAIN].style.fill = hexMix(CREAM, ACCENT, st.glow);
    halo.setAttribute('cx', st.pts[PAIN][0].toFixed(3));
    halo.setAttribute('cy', (-st.pts[PAIN][1]).toFixed(3));
    halo.style.opacity = String(0.4 * st.glow);
    halo.classList.toggle('is-live', st.glow > 0.05);
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', wake);
  wake();
  return { wake, now: tick };
}

/* ---------------- выбор рендера ---------------- */
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

(async function init() {
  const canvas = document.querySelector('.chain-gl');
  const svg = document.querySelector('.chain-svg');
  if (!canvas || !svg || !secComp || !secMethod || !secProcess) return;

  const light = window.matchMedia('(max-width: 900px), (hover: none) and (pointer: coarse)').matches;
  let mode = 'svg';
  let api;
  if (!light && webglAvailable()) {
    try {
      api = await startGL(canvas);
      svg.remove();
      mode = 'gl';
    } catch (e) {
      canvas.remove();
      api = startSVG(svg);
    }
  } else {
    canvas.remove();
    api = startSVG(svg);
  }
  document.documentElement.dataset.chain = mode;

  if (DEBUG) {
    window.__chain = {
      mode,
      force(s) { forced = s ? { diverge: 0, realign: 0, fade: 0, ...s } : null; api.now(); },
      snapshot() { return mode === 'gl' ? canvas.toDataURL('image/png') : null; }
    };
  }
})();
