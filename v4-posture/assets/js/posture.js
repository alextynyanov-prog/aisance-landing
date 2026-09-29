/* AISANCE · вариант 4 — «Осанка».
   Схема постуральной оценки: вертикальный отвес и точки отсчёта
   (ухо, плечо, таз, колено, стопа) в профиль. Не фигура человека,
   а инструмент измерения: видно, как точки уходят с оси и как возвращаются.

   Три режима одной схемы:
   hero    — компенсация снимается от стопы вверх и возвращается, по кругу;
   diverge — виджет: ползунок «ограничение на периферии» задаёт компенсацию,
             сигнал загорается в пояснице — далеко от места причины;
   method  — при скролле через «Метод» точки возвращаются на ось от периферии
             к центру, сигнал гаснет последним.
   Чистый SVG, без WebGL. Анимация работает только пока схема на экране. */
(function () {
  'use strict';

  // y — высота точки (0 — макушка, 100 — пол); dx — смещение от оси при компенсации (+ вперёд)
  var POINTS = [
    { label: 'ухо',    y: 8,  dx: 9 },
    { label: 'плечо',  y: 22, dx: 4.5 },
    { label: 'таз',    y: 52, dx: 6 },
    { label: 'колено', y: 74, dx: -3.2 },
    { label: 'стопа',  y: 96, dx: 0 }
  ];
  var LUMBAR_Y = 43;                                  // зона сигнала — поясница
  var VB = { x: -24, y: -8, w: 48, h: 114 };
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var ease = function (v) { v = clamp(v); return v * v * (3 - 2 * v); };
  var f = function (p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); };

  // Сплайн Катмулла — Рома через точки → кубические кривые Безье
  function curve(P) {
    var d = 'M' + f(P[0]);
    for (var i = 0; i < P.length - 1; i++) {
      var p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + f(c1) + ' ' + f(c2) + ' ' + f(p2);
    }
    return d;
  }

  function build(root) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', VB.x + ' ' + VB.y + ' ' + VB.w + ' ' + VB.h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    var mk = function (tag, attrs, cls) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      e.setAttribute('class', cls);
      svg.appendChild(e);
      return e;
    };
    mk('line', { x1: 0, y1: -6, x2: 0, y2: 100 }, 'pz-plumb');
    mk('line', { x1: -12, y1: 100, x2: 14, y2: 100 }, 'pz-floor');
    var ticks = POINTS.map(function (p) { return mk('line', { x1: 0, y1: p.y, x2: 0, y2: p.y }, 'pz-tick'); });
    var body = mk('path', {}, 'pz-body');
    var cause = mk('circle', { cx: 0, cy: 96, r: 3.6 }, 'pz-cause');
    var halo = mk('circle', { r: 5.5, cy: LUMBAR_Y }, 'pz-halo');
    var pain = mk('circle', { r: 1.6, cy: LUMBAR_Y }, 'pz-pain');
    var dots = POINTS.map(function () { return mk('circle', { r: 1.25 }, 'pz-dot'); });
    root.appendChild(svg);

    // подписи — HTML поверх схемы: чёткие при любом размере
    POINTS.forEach(function (p) {
      var s = document.createElement('span');
      s.className = 'pz-label';
      s.textContent = p.label;
      s.style.top = ((p.y - VB.y) / VB.h * 100).toFixed(2) + '%';
      root.appendChild(s);
    });

    // vs — компенсация каждой точки 0…1; painV — яркость сигнала; causeV — метка причины
    return function render(vs, painV, causeV) {
      var pts = POINTS.map(function (p, i) { return [p.dx * vs[i], p.y]; });
      var lum = [pts[1][0] * 0.27 + pts[2][0] * 0.73 - 2.2 * vs[2], LUMBAR_Y];
      body.setAttribute('d', curve([[pts[0][0] * 0.8 - 0.6, -2], pts[0], pts[1], lum, pts[2], pts[3], pts[4], [pts[4][0], 100]]));
      pts.forEach(function (q, i) {
        dots[i].setAttribute('cx', q[0].toFixed(2));
        dots[i].setAttribute('cy', q[1]);
        ticks[i].setAttribute('x2', q[0].toFixed(2));
        ticks[i].style.opacity = Math.min(1, Math.abs(q[0]) / 2).toFixed(2);
      });
      pain.setAttribute('cx', lum[0].toFixed(2));
      halo.setAttribute('cx', lum[0].toFixed(2));
      pain.style.opacity = painV.toFixed(2);
      halo.style.opacity = (0.3 * painV).toFixed(2);
      halo.classList.toggle('is-live', painV > 0.05 && !reduce);
      cause.style.opacity = causeV.toFixed(2);
    };
  }

  // Выравнивание от периферии к центру: стопа → колено → таз → плечо → ухо.
  // p — общий прогресс 0…1; возвращает компенсацию каждой точки.
  function sequential(p) {
    var order = [4, 3, 2, 1, 0], vs = [0, 0, 0, 0, 0];
    order.forEach(function (idx, k) { vs[idx] = 1 - ease((p * 1.3 - k * 0.18) / 0.35); });
    return vs;
  }
  var painAfter = function (p) { return 1 - ease((p * 1.3 - 0.55) / 0.3); };
  var fill = function (v) { return [v, v, v, v, v]; };

  // Кадр анимации — только для схем на экране.
  var visible = new Set(), loops = new Map(), raf = 0;
  function tick(now) {
    raf = 0;
    visible.forEach(function (el) { var fn = loops.get(el); if (fn) fn(now); });
    if (visible.size && !reduce) raf = requestAnimationFrame(tick);
  }
  var wake = function () { if (!raf) raf = requestAnimationFrame(tick); };
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
    wake();
  }, { rootMargin: '10% 0px' }) : null;

  document.querySelectorAll('.posture[data-mode]').forEach(function (root) {
    var render = build(root);
    var mode = root.dataset.mode;

    if (mode === 'hero') {
      // цикл 11 с: компенсация → снимается от стопы вверх → лёгкость → возвращается
      var T = 11000, t0 = 0;
      loops.set(root, function (now) {
        if (!t0) t0 = now;                          // цикл начинается с момента первого показа
        var t = ((now - t0) % T) / T * 11, p;
        if (t < 1.5) p = 0;
        else if (t < 5) p = (t - 1.5) / 3.5;
        else if (t < 8.5) p = 1;
        else p = 1 - ease((t - 8.5) / 2.5);
        render(sequential(p), painAfter(p), 0);
      });
      render(reduce ? fill(0) : fill(1), reduce ? 0 : 1, 0);
    }

    if (mode === 'diverge') {
      var range = document.querySelector('[data-posture-range]');
      var v = reduce ? 0.8 : 0, touched = reduce, demoStart = 0;
      var paint = function () { render(fill(v), ease(v * 1.15), v); if (range) range.value = Math.round(v * 100); };
      if (range) range.addEventListener('input', function () { touched = true; v = range.value / 100; paint(); });
      // при первом появлении схема сама показывает компенсацию; потом ползунок — у читателя
      loops.set(root, function (now) {
        if (touched) return;
        if (!demoStart) demoStart = now + 400;
        v = 0.85 * ease((now - demoStart) / 1800);
        paint();
        if (v >= 0.849) touched = true;
      });
      paint();
    }

    if (mode === 'method') {
      var section = root.closest('section');
      var draw = function () {
        var r = section.getBoundingClientRect(), vh = window.innerHeight;
        var p = clamp((vh * 0.65 - r.top) / (r.height * 0.6));
        render(sequential(p), painAfter(p), 1 - ease(p / 0.2));
      };
      loops.set(root, draw);
      window.addEventListener('scroll', function () { if (visible.has(root)) wake(); }, { passive: true });
      draw();
    }

    if (io) io.observe(root); else { visible.add(root); wake(); }
  });
})();
