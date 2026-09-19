/* AISANCE · вариант 2.1 — фоновая сцена «Цепь».
   Условный силуэт в профиль и три миофасциальные линии внутри него:
   задняя поверхностная, передняя поверхностная и спиральная.
   Одна модель состояния, привязанная к скроллу, и два способа отрисовки:
   Three.js на десктопе и лёгкий SVG на телефонах и планшетах.
   Только контур и линии — без мышц, костей, органов и обозначений патологии. */

const CREAM = '#E9E4D6';
const ACCENT = '#7FA087';
const BG = '#161E19';

/* ---------- геометрия (единицы тела: рост 8, пол y = 0, лицом вправо) ---------- */

// Контур: от середины стопы — пятка, спина, затылок, лицо, грудь, нога, носок.
// Концы затухают, как хвосты росчерка, — контур не замкнут.
const CONTOUR = [
  [0.10, 0.00], [-0.22, 0.02], [-0.33, 0.14], [-0.27, 0.55], [-0.33, 1.05], [-0.42, 1.55],
  [-0.33, 2.05], [-0.27, 2.30], [-0.36, 2.90], [-0.42, 3.45], [-0.56, 3.85], [-0.48, 4.20],
  [-0.34, 4.60], [-0.40, 5.10], [-0.50, 5.60], [-0.46, 6.05], [-0.28, 6.40], [-0.22, 6.70],
  [-0.34, 7.05], [-0.38, 7.40], [-0.28, 7.76], [0.02, 7.96], [0.30, 7.84], [0.45, 7.52], [0.47, 7.28],
  [0.58, 7.10], [0.47, 6.94], [0.44, 6.76], [0.22, 6.66], [0.18, 6.45], [0.26, 6.20],
  [0.46, 5.85], [0.43, 5.35], [0.36, 5.00], [0.40, 4.55], [0.40, 4.15], [0.33, 3.80],
  [0.40, 3.20], [0.32, 2.60], [0.30, 2.28], [0.20, 2.00], [0.17, 1.20], [0.12, 0.45],
  [0.35, 0.22], [0.72, 0.07], [0.80, 0.02], [0.55, 0.00], [0.30, 0.00]
];
const ARM = [[0.02, 6.08], [-0.03, 5.50], [-0.02, 4.95], [0.06, 4.40], [0.12, 3.95], [0.16, 3.58]];

// Задняя поверхностная линия: подошва — пятка — икра — подколенная область —
// задняя поверхность бедра — крестец — вдоль позвоночника — затылок — через свод черепа ко лбу.
const SBL = [
  [0.52, 0.05], [-0.20, 0.10], [-0.20, 0.55], [-0.30, 1.50], [-0.22, 2.30], [-0.30, 3.00],
  [-0.40, 4.00], [-0.27, 4.60], [-0.38, 5.50], [-0.18, 6.60], [-0.24, 7.10], [-0.20, 7.50], [0.02, 7.80], [0.30, 7.62]
];
// Передняя поверхностная линия: тыл стопы — голень — колено — бедро — лобок —
// живот — грудина — по передней поверхности шеи к сосцевидному отростку.
const SFL = [
  [0.66, 0.10], [0.08, 0.50], [0.10, 1.30], [0.20, 2.30], [0.28, 3.10], [0.28, 3.85],
  [0.30, 4.70], [0.34, 5.60], [0.16, 6.25], [-0.14, 7.00]
];
// Спиральная линия: огибает тело — от затылка через лопатку к рёбрам спереди,
// через живот к противоположному бедру, вниз по голени под свод стопы и обратно по задней стороне.
const SPIRAL = [
  [-0.20, 7.10, 0.25], [-0.35, 6.20, -0.10], [0.30, 5.30, -0.30], [0.30, 4.50, 0.10],
  [0.25, 3.90, 0.30], [0.00, 3.00, 0.38], [0.12, 1.80, 0.15], [0.15, 0.12, -0.10],
  [-0.10, 1.20, -0.25], [-0.28, 2.80, -0.20], [-0.45, 4.10, 0.00]
];

// На задней линии: ограничение — в области икры (периферия), сигнал — в пояснице.
const CAUSE_AT = [-0.30, 1.50];
const PAIN_AT = [-0.27, 4.60];
const SAG = [0.26, -0.12, 0];     // «проседание» участка внутрь и вниз
const BUMP = 0.055;               // ширина проседающего участка вдоль линии (доля длины)

/* ---------- математика ---------- */
const clamp = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const to3 = p => [p[0], p[1], p[2] || 0];

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
  out.push(pts[n - 1].slice());
  return out;
}

// Сэмплирование с параметром s ∈ [0,1] по длине дуги.
function sample(ctrl, seg) {
  const pts = catmull(ctrl.map(to3), seg);
  const L = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const tot = L[L.length - 1];
  return { pts, s: L.map(v => v / tot) };
}
function nearestS(line, p) {
  let best = 0, bd = Infinity;
  line.pts.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = i; } });
  return line.s[best];
}

const G = {
  contour: sample(CONTOUR, 8),
  arm: sample(ARM, 10),
  sbl: sample(SBL, 16),
  sfl: sample(SFL, 12),
  spiral: sample(SPIRAL, 14)
};
const S_CAUSE = nearestS(G.sbl, CAUSE_AT);
const S_PAIN = nearestS(G.sbl, PAIN_AT);
const SPAN = S_PAIN - S_CAUSE;
const GHOST_IDX = G.sbl.s.map((v, i) => (Math.abs(v - S_CAUSE) < BUMP * 2.2 ? i : -1)).filter(i => i >= 0);

/* ---------- скролл → состояние ---------- */
const secComp = document.getElementById('compensation');
const secMethod = document.getElementById('method');
const secProcess = document.getElementById('process');
const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEBUG = /[?&]chain-debug\b/.test(location.search);
let forced = null;

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

// Лёгкое дыхание: грудная клетка чуть расширяется вперёд-назад.
function breathe(p, t) {
  if (!motion) return p;
  const w = Math.exp(-Math.pow((p[1] - 5.4) / 0.9, 2));
  return [p[0] * (1 + 0.02 * w * Math.sin(t * 0.55)), p[1], p[2]];
}

/* Состояние: проседание участка задней линии у икры, сигнал в пояснице.
   Выравнивание идёт волной вдоль задней линии от икры вверх; сигнал гаснет,
   когда волна до него доходит, — как следствие, а не от прямого воздействия. */
function solve(s, t) {
  const front = s.realign * (SPAN + 0.12);
  const waveOn = s.diverge * Math.sin(Math.PI * s.realign);
  const sbl = [], dim = [], wave = [];
  let causeK = 0;
  for (let j = 0; j < G.sbl.pts.length; j++) {
    const v = G.sbl.s[j];
    const aligned = smooth((front - Math.abs(v - S_CAUSE)) / 0.05);
    const k = s.diverge * Math.exp(-Math.pow((v - S_CAUSE) / BUMP, 2)) * (1 - aligned);
    if (k > causeK) causeK = k;
    const p = G.sbl.pts[j];
    sbl.push(breathe([p[0] + SAG[0] * k, p[1] + SAG[1] * k, p[2]], t));
    dim.push(k);
    wave.push(waveOn * Math.exp(-Math.pow((v - (S_CAUSE + front)) / 0.05, 2)));
  }
  const painA = smooth((front - SPAN - 0.02) / 0.05);
  const emph = s.diverge * (1 - smooth((s.realign - 0.75) / 0.25));
  let pi = 0, bd = Infinity, wi = 0, wd = Infinity;
  G.sbl.s.forEach((v, i) => {
    const d = Math.abs(v - S_PAIN); if (d < bd) { bd = d; pi = i; }
    const e = Math.abs(v - Math.min(S_PAIN, S_CAUSE + front)); if (e < wd) { wd = e; wi = i; }
  });
  return {
    contour: G.contour.pts.map(p => breathe(p, t)),
    arm: G.arm.pts.map(p => breathe(p, t)),
    sfl: G.sfl.pts.map(p => breathe(p, t)),
    spiral: G.spiral.pts.map(p => breathe(p, t)),
    sbl, dim, wave, causeK, emph,
    pain: sbl[pi],
    bead: sbl[wi], beadOn: waveOn * (1 - smooth((front - SPAN) / 0.04)),
    glow: s.diverge * (1 - painA),
    pulse: motion ? 1 + 0.2 * Math.sin(t * 2.3) : 1,
    angle: 0.6 * Math.sin(Math.PI * s.realign)
  };
}

/* ---------------- WebGL (десктоп) ---------------- */
async function startGL(canvas) {
  const THREE = await import('three');
  const { Line2 } = await import('three/addons/lines/Line2.js');
  const { LineGeometry } = await import('three/addons/lines/LineGeometry.js');
  const { LineMaterial } = await import('three/addons/lines/LineMaterial.js');

  // Кадр сохраняется в буфере: его можно прочитать и проверить обычными средствами браузера.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);
  const group = new THREE.Group();
  scene.add(group);
  const body = new THREE.Group();          // вращается вокруг вертикальной оси тела
  body.position.set(0, -4, 0);
  group.add(body);

  const cream = new THREE.Color(CREAM), accent = new THREE.Color(ACCENT), bg = new THREE.Color(BG);

  // Линия толщиной в пикселях экрана. Обычная THREE.Line в WebGL всегда в 1 физический
  // пиксель — на ретине это полпикселя CSS, её почти не видно.
  function makeLine(n, width, tail, opts = {}) {
    const geo = new LineGeometry();
    geo.setPositions(new Float32Array(n * 3));
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const c = cream.clone().lerp(bg, tail ? 1 - smooth(Math.min(u, 1 - u) / tail) : 0);
      col.set([c.r, c.g, c.b], i * 3);
    }
    geo.setColors(col);
    // Непрозрачный материал: при полупрозрачности стыки коротких отрезков смешиваются
    // дважды и линия выглядит пунктирной. Яркость задаётся цветом — смешиванием с фоном.
    const mat = new LineMaterial({
      color: 0xffffff, vertexColors: true, linewidth: width, worldUnits: false,
      transparent: false, depthWrite: false, ...opts
    });
    const line = new Line2(geo, mat);
    line.frustumCulled = false;
    body.add(line);
    return { line, mat, geo, base: col, n, pos: geo.attributes.instanceStart.data, colBuf: geo.attributes.instanceColorStart.data };
  }
  // Яркость линии level ∈ [0,1]: 0 — цвет фона, 1 — полный кремовый; mod(i, c) — поточечная поправка.
  function writeCol(L, level, mod) {
    const cb = L.colBuf.array, base = L.base;
    const at = i => {
      tmp.setRGB(base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
      tmp.r = bg.r + (tmp.r - bg.r) * level; tmp.g = bg.g + (tmp.g - bg.g) * level; tmp.b = bg.b + (tmp.b - bg.b) * level;
      if (mod) mod(i, tmp);
      return tmp;
    };
    for (let i = 0; i < L.n - 1; i++) {
      const o = i * 6;
      let c = at(i); cb[o] = c.r; cb[o + 1] = c.g; cb[o + 2] = c.b;
      c = at(i + 1); cb[o + 3] = c.r; cb[o + 4] = c.g; cb[o + 5] = c.b;
    }
    L.colBuf.needsUpdate = true;
  }
  const tmp = new THREE.Color();
  function writePos(L, pts) {
    const a = L.pos.array;
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], o = i * 6;
      a[o] = p[0]; a[o + 1] = p[1]; a[o + 2] = p[2];
      a[o + 3] = q[0]; a[o + 4] = q[1]; a[o + 5] = q[2];
    }
    L.pos.needsUpdate = true;
  }

  const L = {
    contour: makeLine(G.contour.pts.length, 1.5, 0.05),
    arm: makeLine(G.arm.pts.length, 1.2, 0.25),
    sfl: makeLine(G.sfl.pts.length, 1.2, 0.08),
    spiral: makeLine(G.spiral.pts.length, 1.1, 0.08),
    sbl: makeLine(G.sbl.pts.length, 1.8, 0.05)
  };
  // Пунктир на прежней траектории проседающего участка — видно, откуда линия ушла.
  const ghostPts = GHOST_IDX.map(i => G.sbl.pts[i]);
  const ghost = makeLine(ghostPts.length, 1.0, 0.3, { dashed: true, dashSize: 0.05, gapSize: 0.05 });
  writePos(ghost, ghostPts);
  ghost.line.computeLineDistances();
  // Линии непрозрачные, поэтому на пересечениях важен порядок: яркие рисуются поверх тусклых.
  [L.spiral, L.sfl, ghost, L.arm, L.contour, L.sbl].forEach((l, i) => { l.line.renderOrder = i; });

  // Сигнал: точка и мягкое свечение.
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 14), new THREE.MeshBasicMaterial({ color: CREAM, transparent: true, opacity: 0, depthWrite: false }));
  body.add(dot);
  const c2 = document.createElement('canvas');
  c2.width = c2.height = 128;
  const g2 = c2.getContext('2d');
  const grd = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = grd;
  g2.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c2);
  tex.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: ACCENT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  body.add(halo);
  // бусина на фронте волны выравнивания — видно, как волна идёт вдоль цепи
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false }));
  body.add(bead);

  function draw(st) {
    writePos(L.contour, st.contour);
    writePos(L.arm, st.arm);
    writePos(L.sfl, st.sfl);
    writePos(L.spiral, st.spiral);
    writePos(L.sbl, st.sbl);

    // в покое цепи едва заметны; по ходу рассказа задняя проступает
    writeCol(L.contour, 0.62);
    writeCol(L.arm, 0.5);
    writeCol(L.sfl, 0.22 + 0.12 * st.emph);
    writeCol(L.spiral, 0.16 + 0.1 * st.emph + 0.25 * Math.abs(st.angle) / 0.6);
    // задняя линия: проседающий участок тускнеет, волна выравнивания подсвечивает её акцентом
    writeCol(L.sbl, 0.32 + 0.6 * st.emph, (i, c) => {
      const k = 0.78 * st.dim[i];
      c.r += (bg.r - c.r) * k; c.g += (bg.g - c.g) * k; c.b += (bg.b - c.b) * k;
      c.lerp(accent, Math.min(1, st.wave[i]));
    });
    ghost.line.visible = st.causeK > 0.02; // в покое пунктира нет вовсе — он не перекрывает линию
    writeCol(ghost, 0.7 * st.causeK);

    dot.position.set(...st.pain);
    dot.material.opacity = st.glow;
    dot.material.color.copy(cream).lerp(accent, st.glow);
    dot.scale.setScalar(1 + 0.4 * st.glow * (st.pulse - 1) * 5);
    halo.position.set(...st.pain);
    halo.material.opacity = 0.75 * st.glow;
    halo.scale.setScalar(1.3 * st.pulse);

    bead.position.set(...st.bead);
    bead.material.opacity = st.beadOn;

    body.rotation.y = st.angle;
    renderer.render(scene, camera);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    const visW = visH * camera.aspect;
    // фигура — в правой трети экрана, около 80% высоты
    group.scale.setScalar((visH * 0.8) / 8);
    group.position.set(visW * 0.3, 0, 0);
  }

  const t0 = performance.now();
  let raf = 0;
  function tick(now) {
    raf = 0;
    const s = readScroll();
    canvas.style.opacity = String(1 - s.fade);
    if (s.fade >= 1 || document.hidden) return; // сцена ушла или вкладка скрыта — не рендерим
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
   Тот же силуэт, упрощённый: контур, рука, задняя и передняя линии, без спиральной
   и без вращения. Перерисовка только на скролл — без постоянного цикла анимации. */
function startSVG(svg) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    svg.appendChild(e);
    return e;
  };
  const d = pts => 'M' + pts.map(p => p[0].toFixed(3) + ' ' + (-p[1]).toFixed(3)).join('L');
  svg.setAttribute('viewBox', '-3.9 -8.45 5 8.9'); // фигура смещена вправо, под правую часть текста
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  el('path', { class: 'ch-body', d: d(catmull(CONTOUR.map(to3), 4)) });
  el('path', { class: 'ch-body ch-arm', d: d(catmull(ARM.map(to3), 5)) });
  el('path', { class: 'ch-front', d: d(G.sfl.pts) });
  const ghost = el('path', { class: 'ch-ghost', d: d(GHOST_IDX.map(i => G.sbl.pts[i])) });
  const back = el('path', { class: 'ch-back' });
  const sag = el('path', { class: 'ch-sag' });
  const wave = el('path', { class: 'ch-wave' });
  const halo = el('circle', { class: 'ch-halo', r: 0.34 });
  const dot = el('circle', { class: 'ch-dot', r: 0.08 });
  const bead = el('circle', { class: 'ch-dot', r: 0.07 });

  let raf = 0;
  function tick() {
    raf = 0;
    const s = readScroll();
    svg.style.opacity = String(1 - s.fade);
    if (s.fade >= 1) return;
    const st = solve(s, 0);
    back.setAttribute('d', d(st.sbl));
    back.style.opacity = String(0.3 + 0.55 * st.emph);
    const sagPts = st.sbl.filter((_, i) => st.dim[i] > 0.12);
    sag.setAttribute('d', sagPts.length > 1 ? d(sagPts) : 'M0 0');
    sag.style.opacity = String(st.causeK);
    ghost.style.opacity = String(0.8 * st.causeK);
    const wavePts = st.sbl.filter((_, i) => st.wave[i] > 0.25);
    wave.setAttribute('d', wavePts.length > 1 ? d(wavePts) : 'M0 0');
    wave.style.opacity = wavePts.length > 1 ? '1' : '0';
    dot.setAttribute('cx', st.pain[0].toFixed(3));
    dot.setAttribute('cy', (-st.pain[1]).toFixed(3));
    dot.style.opacity = String(st.glow);
    halo.setAttribute('cx', st.pain[0].toFixed(3));
    halo.setAttribute('cy', (-st.pain[1]).toFixed(3));
    halo.style.opacity = String(0.4 * st.glow);
    halo.classList.toggle('is-live', st.glow > 0.05);
    bead.setAttribute('cx', st.bead[0].toFixed(3));
    bead.setAttribute('cy', (-st.bead[1]).toFixed(3));
    bead.style.opacity = String(st.beadOn);
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
      force(s) { forced = s ? { diverge: 0, realign: 0, fade: 0, ...s } : null; api.now(); }
    };
  }
})();
