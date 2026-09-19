/* AISANCE · вариант 3 — фоновая сцена «Течение».
   Несколько тонких линий на трёх глубинах, непрерывно текущих, как росчерк логотипа,
   который сносит мягким течением. Никаких фигур и антропоморфных форм — только линии.

   Сюжет метода разыгрывается на передней линии:
   покой → сигнал (пульсирующая точка) и заминка потока в другом месте той же линии →
   от заминки расходится волна, возвращающая плавность; точка гаснет, когда волна до неё доходит →
   снова спокойное синхронное течение.

   Десктоп — Three.js (линии Line2 с толщиной в экранных пикселях, кадр сохраняется в буфере).
   Телефоны — лёгкий SVG. После «Метода» сцена уступает место эху — движущимся при скролле
   SVG-разделителям между разделами, без WebGL. */

const CREAM = '#E9E4D6';
const ACCENT = '#7FA087';
const BG = '#161E19';

const clamp = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const gauss = (x, w) => Math.exp(-(x * x) / (w * w));

const secComp = document.getElementById('compensation');
const secMethod = document.getElementById('method');
const secProcess = document.getElementById('process');
const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEBUG = /[?&]chain-debug\b/.test(location.search);
let forced = null;

/* ---------- скролл → состояние ---------- */
function readScroll() {
  const vh = window.innerHeight;
  const m = secMethod.getBoundingClientRect();
  const zoneEnd = m.bottom + window.scrollY - vh;               // где заканчивается «Метод»
  const base = {
    scroll: window.scrollY,
    zone: clamp(window.scrollY / Math.max(1, zoneEnd)),          // 0..1 по объясняющей части
    hero: 1 - smooth(window.scrollY / (vh * 0.45))               // hero ещё на экране
  };
  if (forced) return { ...base, ...forced };
  const c = secComp.getBoundingClientRect();
  const p = secProcess.getBoundingClientRect();
  return {
    ...base,
    diverge: smooth((vh * 0.9 - c.top) / (c.height * 0.65)),
    realign: smooth((vh * 0.55 - m.top) / (m.height * 0.75)),
    fade: smooth((vh * 0.95 - p.top) / (vh * 0.55))
  };
}

/* ---------- модель течения ----------
   Координаты мировые: x — горизонталь, y — вертикаль, z — глубина слоя.
   Каждая линия — сумма медленных синусоид (форма росчерка), фаза которой
   течёт со временем и сдвигается скроллом: передний слой — быстрее всех (параллакс). */
const LAYERS = [
  { name: 'back', z: -6, width: 1.0, level: 0.15, amp: 0.30, drift: 0.25, scrollPhase: 0.0007, speed: 0.55,
    lines: [{ y: 0.2, ph: 0.4 }, { y: -1.3, ph: 2.1 }, { y: -2.9, ph: 4.0 }] },
  { name: 'mid', z: -2.5, width: 1.3, level: 0.3, amp: 0.36, drift: 0.55, scrollPhase: 0.0015, speed: 0.75,
    lines: [{ y: -0.9, ph: 1.2 }, { y: -2.35, ph: 3.3 }] },
  { name: 'front', z: 0, width: 1.9, level: 0.62, amp: 0.42, drift: 1.0, scrollPhase: 0.0030, speed: 1.0,
    lines: [{ y: -1.1, ph: 0.0 }] }
];
const N = 180; // точек на линию

function flowY(x, t, L, line, j, desync) {
  const sp = motion ? L.speed : 0;
  const ph = line.ph + desync;
  return 0.55 * Math.sin(0.42 * x + ph + t * 0.35 * sp) +
         0.28 * Math.sin(0.93 * x - t * 0.23 * sp + 1.7 * j + ph * 0.5) +
         0.12 * Math.sin(1.8 * x + t * 0.5 * sp + j);
}

/* Сюжет на передней линии.
   xH — место заминки (причина), xS — место сигнала. Волна выравнивания
   расходится от заминки в обе стороны; до сигнала она доходит последней. */
function story(s, t, span) {
  const reach = s.realign * (span + 0.9);        // сколько прошла волна от заминки
  const waveOn = s.diverge * Math.sin(Math.PI * s.realign);
  const signalReached = smooth((reach - span - 0.1) / 0.7);
  // «Спотыкание»: поток рывками теряет плавность — короткие толчки с неровным ритмом
  const stutter = motion ? 0.45 + 0.55 * Math.pow(Math.max(0, Math.sin(t * 2.1)), 3) + 0.2 * Math.sin(t * 5.3) : 0.8;
  return {
    reach, waveOn, stutter,
    glow: s.diverge * (1 - signalReached),
    beadOn: waveOn * (1 - signalReached),
    desync: s.diverge * (1 - s.realign)
  };
}

/* Точки всех линий на момент времени t при состоянии s.
   geo — геометрия экрана: visW(z) — видимая ширина на глубине z, xH, xS — точки сюжета. */
function solve(s, t, geo) {
  const st = story(s, t, geo.xS - geo.xH);
  const lines = [];
  LAYERS.forEach(L => {
    const half = geo.visW(L.z) * 0.56;
    const phaseScroll = s.scroll * L.scrollPhase;                 // скролл сдвигает фазу — слои текут с разной скоростью
    const yDrift = L.drift * (s.zone - 0.5) * 1.2;                // и расходятся по вертикали — объём
    L.lines.forEach((line, j) => {
      const desync = L.name === 'front' ? 0 : 0.5 * st.desync * Math.sin(t * 0.9 + j * 2.1 + L.z);
      const pts = new Array(N), tint = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const x = -half + 2 * half * u;
        let y = line.y + yDrift + L.amp * flowY(x, t, L, line, j, desync + phaseScroll);
        if (L.name === 'front') {
          const d = Math.abs(x - geo.xH);
          const aligned = smooth((st.reach - d) / 0.7);
          const k = s.diverge * (1 - aligned) * gauss(x - geo.xH, 0.55);
          // заминка: мелкая неровная рябь и лёгкий провал — линия теряет плавность
          y += k * (0.2 * st.stutter * Math.sin(10 * x - 13 * (motion ? t : 0)) - 0.14);
          tint[i] = st.waveOn * gauss(d - st.reach, 0.35);
        }
        pts[i] = [x, y, L.z];
      }
      lines.push({ L, pts, tint });
    });
  });
  const front = lines[lines.length - 1].pts;
  const at = x => { // точка передней линии, ближайшая к x
    let best = front[0], bd = Infinity;
    for (const p of front) { const d = Math.abs(p[0] - x); if (d < bd) { bd = d; best = p; } }
    return best;
  };
  const beadX = geo.xH + Math.min(geo.xS - geo.xH, st.reach);
  return {
    lines,
    signal: at(geo.xS), glow: st.glow,
    pulse: motion ? 1 + 0.22 * Math.sin(t * 2.4) : 1,
    bead: at(beadX), beadOn: st.beadOn
  };
}

/* ---------------- WebGL (десктоп) ---------------- */
async function startGL(canvas) {
  const THREE = await import('three');
  const { Line2 } = await import('three/addons/lines/Line2.js');
  const { LineGeometry } = await import('three/addons/lines/LineGeometry.js');
  const { LineMaterial } = await import('three/addons/lines/LineMaterial.js');

  // preserveDrawingBuffer — кадр остаётся в буфере и проверяется обычным чтением пикселей.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const cream = new THREE.Color(CREAM), accent = new THREE.Color(ACCENT), bg = new THREE.Color(BG);
  const tmp = new THREE.Color();

  // Геометрия экрана: видимая ширина на глубине z и точки сюжета.
  const geo = { visW: () => 1, xH: -2, xS: 2 };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const visH0 = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
    geo.visW = z => visH0 * camera.aspect * (camera.position.z - z) / camera.position.z;
    geo.xH = -0.24 * geo.visW(0);   // заминка — левее
    geo.xS = 0.22 * geo.visW(0);    // сигнал — правее, на той же линии
  }

  // Линии толщиной в экранных пикселях. Непрозрачные: яркость задаётся цветом
  // (смешиванием с фоном), чтобы стыки отрезков не давали «бисер».
  function makeLine(width, order) {
    const g = new LineGeometry();
    g.setPositions(new Float32Array(N * 3));
    g.setColors(new Float32Array(N * 3));
    const mat = new LineMaterial({ color: 0xffffff, vertexColors: true, linewidth: width, worldUnits: false, depthWrite: false, depthTest: false });
    const line = new Line2(g, mat);
    line.frustumCulled = false;
    line.renderOrder = order;
    scene.add(line);
    return { line, pos: g.attributes.instanceStart.data, col: g.attributes.instanceColorStart.data };
  }
  function write(obj, pts, level, tint) {
    const a = obj.pos.array, c = obj.col.array;
    const colAt = i => {
      const u = i / (N - 1);
      const lv = level * smooth(Math.min(u, 1 - u) / 0.12);          // концы затухают, как хвосты росчерка
      tmp.setRGB(bg.r + (cream.r - bg.r) * lv, bg.g + (cream.g - bg.g) * lv, bg.b + (cream.b - bg.b) * lv);
      if (tint && tint[i] > 0.01) tmp.lerp(accent, Math.min(1, tint[i]));
      return tmp;
    };
    for (let i = 0; i < N - 1; i++) {
      const p = pts[i], q = pts[i + 1], o = i * 6;
      a[o] = p[0]; a[o + 1] = p[1]; a[o + 2] = p[2];
      a[o + 3] = q[0]; a[o + 4] = q[1]; a[o + 5] = q[2];
      let k = colAt(i); c[o] = k.r; c[o + 1] = k.g; c[o + 2] = k.b;
      k = colAt(i + 1); c[o + 3] = k.r; c[o + 4] = k.g; c[o + 5] = k.b;
    }
    obj.pos.needsUpdate = true;
    obj.col.needsUpdate = true;
  }

  let order = 0;
  const objs = [];
  LAYERS.forEach(L => L.lines.forEach(() => objs.push(makeLine(L.width, order++))));
  const invite = makeLine(1.0, -1); // линия-приглашение: утекает за нижний край и появляется снова

  // Сигнал: точка и мягкое свечение; бусина на фронте волны.
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 16), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthTest: false }));
  dot.renderOrder = 50;
  scene.add(dot);
  const hc = document.createElement('canvas');
  hc.width = hc.height = 128;
  const hg = hc.getContext('2d');
  const grd = hg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  hg.fillStyle = grd;
  hg.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(hc);
  tex.colorSpace = THREE.SRGBColorSpace;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: ACCENT, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false }));
  halo.renderOrder = 49;
  scene.add(halo);
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthTest: false }));
  bead.renderOrder = 51;
  scene.add(bead);

  function draw(s, t) {
    const st = solve(s, t, geo);
    st.lines.forEach((ln, i) => write(objs[i], ln.pts, ln.L.level, ln.tint));

    // приглашение листать: линия заднего слоя плавно утекает вниз за край и возвращается
    const u = motion ? (t % 10) / 10 : 0.3;
    const L = LAYERS[0], half = geo.visW(L.z) * 0.56;
    const inviteY = 0.2 - 5.8 * u * u;
    const ipts = new Array(N);
    for (let i = 0; i < N; i++) {
      const x = -half + 2 * half * (i / (N - 1));
      ipts[i] = [x, inviteY + L.amp * flowY(x, t, L, { ph: 5.2 }, 3, 0), L.z];
    }
    write(invite, ipts, 0.24 * s.hero * smooth(u / 0.12));
    invite.line.visible = s.hero > 0.01;

    dot.position.set(...st.signal);
    dot.material.opacity = st.glow;
    dot.scale.setScalar(1 + 0.3 * st.glow * (st.pulse - 1) * 4);
    halo.position.set(...st.signal);
    halo.material.opacity = 0.8 * st.glow;
    halo.scale.setScalar(1.4 * st.pulse);
    bead.position.set(...st.bead);
    bead.material.opacity = st.beadOn;

    renderer.render(scene, camera);
  }

  const t0 = performance.now();
  let raf = 0;
  function tick(now) {
    raf = 0;
    const s = readScroll();
    canvas.style.opacity = String(1 - s.fade);
    if (s.fade >= 1 || document.hidden) return;   // сцена ушла или вкладка скрыта — не рендерим
    draw(s, (now - t0) / 1000);
    if (motion) raf = requestAnimationFrame(tick); // течение непрерывно, пока сцена на экране
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', () => { resize(); wake(); });
  document.addEventListener('visibilitychange', wake);
  resize();
  wake();
  return { wake, now: () => { const s = readScroll(); canvas.style.opacity = String(1 - s.fade); draw(s, (performance.now() - t0) / 1000); } };
}

/* ---------------- SVG (телефоны, планшеты, запасной вариант) ----------------
   Два слоя: передняя линия с сюжетом и тихая задняя. Форма пересчитывается только на скролл;
   непрерывное течение — CSS-анимацией группы (работает на компоновщике, без JS-цикла). */
function startSVG(svg) {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  };
  const backG = el('g', { class: 'fl-layer fl-back' });
  const inviteG = el('g', { class: 'fl-invite' });
  const frontG = el('g', { class: 'fl-layer fl-front' });
  const back = el('path', { class: 'fl-line fl-line--back' }, backG);
  const invite = el('path', { class: 'fl-line fl-line--back' }, inviteG);
  const front = el('path', { class: 'fl-line fl-line--front' }, frontG);
  const hitch = el('path', { class: 'fl-line fl-line--front fl-hitch' }, frontG);
  const wave = el('path', { class: 'fl-wave' }, frontG);
  const halo = el('circle', { class: 'fl-halo', r: 16 }, frontG);
  const dot = el('circle', { class: 'fl-dot', r: 4 }, frontG);
  const bead = el('circle', { class: 'fl-dot', r: 3.5 }, frontG);

  // Плоская версия геометрии в пикселях экрана.
  let W = 1, H = 1;
  const PX = 60; // пикселей на мировую единицу
  const geo = { visW: () => 1, xH: 0, xS: 0 };
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    geo.visW = () => W / PX;
    geo.xH = -0.3 * W / PX;
    geo.xS = 0.24 * W / PX;
  }
  const toPx = p => [W / 2 + p[0] * PX, H * 0.64 - p[1] * PX];
  const d = pts => 'M' + pts.map(p => { const q = toPx(p); return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L');

  let raf = 0;
  function tick() {
    raf = 0;
    const s = readScroll();
    svg.style.opacity = String(1 - s.fade);
    if (s.fade >= 1) return;
    const st = solve(s, 0, geo);
    const F = st.lines[st.lines.length - 1];
    front.setAttribute('d', d(F.pts));
    back.setAttribute('d', d(st.lines[3].pts.map(p => [p[0], p[1] * 0.8 + 0.9, 0])));
    // участок заминки — отдельной дорожкой, которая «подрагивает» CSS-анимацией
    const hPts = F.pts.filter(p => Math.abs(p[0] - geo.xH) < 1.1);
    hitch.setAttribute('d', hPts.length > 1 ? d(hPts) : 'M0 0');
    hitch.style.opacity = String(s.diverge * (1 - smooth(s.realign * 2)));
    const wPts = F.pts.filter((_, i) => F.tint[i] > 0.3);
    wave.setAttribute('d', wPts.length > 1 ? d(wPts) : 'M0 0');
    wave.style.opacity = wPts.length > 1 ? '1' : '0';
    const sp = toPx(st.signal), bp = toPx(st.bead);
    dot.setAttribute('cx', sp[0].toFixed(1)); dot.setAttribute('cy', sp[1].toFixed(1));
    halo.setAttribute('cx', sp[0].toFixed(1)); halo.setAttribute('cy', sp[1].toFixed(1));
    dot.style.opacity = String(st.glow);
    halo.style.opacity = String(0.35 * st.glow);
    halo.classList.toggle('is-live', st.glow > 0.05);
    bead.setAttribute('cx', bp[0].toFixed(1)); bead.setAttribute('cy', bp[1].toFixed(1));
    bead.style.opacity = String(st.beadOn);
    // параллакс: задний слой смещается при скролле медленнее переднего
    backG.style.transform = `translate3d(0, ${(-s.scroll * 0.04).toFixed(1)}px, 0)`;
    // приглашение — только пока виден hero
    invite.setAttribute('d', d(st.lines[0].pts.map(p => [p[0], p[1] * 0.6 + 1.6, 0])));
    inviteG.style.opacity = String(s.hero);
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', () => { resize(); wake(); });
  resize();
  wake();
  return { wake, now: tick };
}

/* ---------------- эхо после «Метода» ----------------
   Разделители-росчерки между разделами получают второй, тихий слой
   и сдвигаются при скролле с разной скоростью. Только атрибут transform и только
   у разделителей в зоне видимости — почти бесплатно для производительности. */
function startEcho() {
  const threads = Array.from(document.querySelectorAll('main > section:not(.scene-zone) .thread'));
  const live = new Set();
  threads.forEach(svg => {
    const p = svg.querySelector('path');
    if (!p) return;
    const far = p.cloneNode(false);
    far.setAttribute('class', 'thread__far');
    far.removeAttribute('style');
    svg.insertBefore(far, p);
    svg.classList.add('thread--echo');
  });
  let raf = 0;
  function tick() {
    raf = 0;
    const vh = window.innerHeight;
    live.forEach(svg => {
      const r = svg.getBoundingClientRect();
      const k = (r.top + r.height / 2 - vh / 2) / vh;             // −1…1 при прохождении через экран
      const toUnits = 1200 / Math.max(1, r.width);                // пиксели → единицы viewBox
      const near = svg.querySelector('path:not(.thread__far)');
      const far = svg.querySelector('.thread__far');
      if (near) near.setAttribute('transform', `translate(${(-70 * k * toUnits).toFixed(1)} ${(8 * k).toFixed(1)})`);
      if (far) far.setAttribute('transform', `translate(${(-24 * k * toUnits).toFixed(1)} ${(14 - 10 * k).toFixed(1)})`);
    });
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      es.forEach(e => (e.isIntersecting ? live.add(e.target) : live.delete(e.target)));
      wake();
    }, { rootMargin: '10% 0px' });
    threads.forEach(t => io.observe(t));
  } else {
    threads.forEach(t => live.add(t));
  }
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', wake);
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
  startEcho();

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
