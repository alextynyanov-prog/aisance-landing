/* AISANCE · вариант 4 — «Осанка».
   Схема постуральной оценки: вертикальный отвес и точки отсчёта
   (ухо, плечо, таз, колено, стопа) в профиль. Не фигура человека,
   а инструмент измерения: видно, как точки уходят с оси и как возвращаются.

   На схеме два места, которые важно различать:
   «болит» — поясница, куда обычно и направляют лечение;
   «причина» — очаг напряжения, откуда тянется компенсация.
   Причина бывает и снизу (стопа), и сверху (голова и шея) — направление
   не фиксировано, поэтому у схемы два сценария.

   Режимы:
   hero    — по кругу: компенсация снимается, начиная с причины; сценарии чередуются;
   diverge — виджет: переключатель «где причина» и ползунок «ограничение»;
   method  — при скролле точки возвращаются на ось, начиная с причины,
             сигнал гаснет последним; сценарий — тот, что выбран в виджете.
   Чистый SVG, без WebGL. Анимация работает только пока схема на экране. */
(function () {
  'use strict';

  // y — высота точки (0 — макушка, 100 — пол)
  var POINTS = [
    { label: 'ухо', y: 8 }, { label: 'плечо', y: 22 }, { label: 'таз', y: 52 },
    { label: 'колено', y: 74 }, { label: 'стопа', y: 96 }
  ];
  // Сценарии: смещение каждой точки от оси при компенсации (+ вперёд) и где очаг
  var SCEN = {
    low:  { dx: [9, 4.5, 6, -3.2, 0],     cause: 4, order: [4, 3, 2, 1, 0] },   // причина внизу, у стопы
    high: { dx: [10.5, 6.5, -2.6, 2.4, 0], cause: 0, order: [0, 1, 2, 3, 4] }   // причина вверху, голова и шея
  };
  var LUMBAR_Y = 43;                                   // зона сигнала — поясница
  var VB = { x: -24, y: -8, w: 48, h: 114 };
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var ease = function (v) { v = clamp(v); return v * v * (3 - 2 * v); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var f = function (p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); };

  // Общее состояние: какой сценарий выбран в виджете (его подхватывает «Метод»)
  var shared = { cause: 'low', listeners: [] };
  function setCause(c) { shared.cause = c; shared.listeners.forEach(function (fn) { fn(c); }); }

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

  function build(root, withTags) {
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
    var link = mk('path', {}, 'pz-link');                  // нагрузка уходит по цепи от причины к месту боли
    var body = mk('path', {}, 'pz-body');
    var focus = mk('circle', { r: 6.5 }, 'pz-focus');     // очаг: зона напряжения вокруг причины
    var cause = mk('circle', { r: 3.6 }, 'pz-cause');
    var halo = mk('circle', { r: 5.5, cy: LUMBAR_Y }, 'pz-halo');
    var pain = mk('circle', { r: 1.6, cy: LUMBAR_Y }, 'pz-pain');
    var dots = POINTS.map(function () { return mk('circle', { r: 1.25 }, 'pz-dot'); });
    root.appendChild(svg);

    POINTS.forEach(function (p) {
      var s = document.createElement('span');
      s.className = 'pz-label';
      s.textContent = p.label;
      s.style.top = ((p.y - VB.y) / VB.h * 100).toFixed(2) + '%';
      root.appendChild(s);
    });

    // подписи прямо на схеме: где болит и где причина
    var tags = null;
    if (withTags) {
      tags = {
        pain: mk2('pz-tag pz-tag--pain', '<b>болит</b><span>сюда обычно направляют лечение</span>'),
        cause: mk2('pz-tag pz-tag--cause', '<b>причина</b><span>очаг напряжения</span>')
      };
    }
    function mk2(cls, html) { var s = document.createElement('span'); s.className = cls; s.innerHTML = html; root.appendChild(s); return s; }

    // координаты точки схемы → пиксели внутри root (схема вписана по высоте, ось по центру)
    function toPx(x, y) {
      var W = root.clientWidth, H = root.clientHeight;
      var k = Math.min(W / VB.w, H / VB.h);
      return [W / 2 + x * k, H / 2 + (y - (VB.y + VB.h / 2)) * k];
    }

    // st: { dx[5] — смещения, cause — индекс очага, painV, causeV }
    return function render(st) {
      var pts = POINTS.map(function (p, i) { return [st.dx[i], p.y]; });
      var lum = [pts[1][0] * 0.27 + pts[2][0] * 0.73 - 0.37 * st.dx[2], LUMBAR_Y];   // прогиб поясницы следует за тазом
      body.setAttribute('d', curve([[pts[0][0] * 0.8 - 0.6, -2], pts[0], pts[1], lum, pts[2], pts[3], pts[4], [pts[4][0], 100]]));
      pts.forEach(function (q, i) {
        dots[i].setAttribute('cx', q[0].toFixed(2));
        dots[i].setAttribute('cy', q[1]);
        ticks[i].setAttribute('x2', q[0].toFixed(2));
        ticks[i].style.opacity = Math.min(1, Math.abs(q[0]) / 2).toFixed(2);
      });
      var c = pts[st.cause];
      cause.setAttribute('cx', c[0].toFixed(2)); cause.setAttribute('cy', c[1]);
      focus.setAttribute('cx', c[0].toFixed(2)); focus.setAttribute('cy', c[1]);
      cause.style.opacity = st.causeV.toFixed(2);
      focus.style.opacity = (0.22 * st.causeV).toFixed(2);
      pain.setAttribute('cx', lum[0].toFixed(2)); halo.setAttribute('cx', lum[0].toFixed(2));
      pain.style.opacity = st.painV.toFixed(2);
      halo.style.opacity = (0.3 * st.painV).toFixed(2);
      halo.classList.toggle('is-live', st.painV > 0.05 && !reduce);
      // дуга связи: от причины к месту боли, обходит линию осанки справа
      var side = 13;
      link.setAttribute('d', 'M' + f([c[0] + 3.6, c[1]]) + 'C' + f([c[0] + side, c[1]]) + ' ' +
        f([lum[0] + side, LUMBAR_Y + (c[1] > LUMBAR_Y ? 4 : -4)]) + ' ' + f([lum[0] + 2.4, LUMBAR_Y]));
      link.style.opacity = (0.9 * Math.min(st.causeV, st.painV)).toFixed(2);
      link.classList.toggle('is-live', Math.min(st.causeV, st.painV) > 0.05 && !reduce);
      if (tags) {
        var pp = toPx(lum[0], LUMBAR_Y), cp = toPx(c[0], c[1]);
        var rx = toPx(side + 2, 0)[0];
        tags.pain.style.left = rx + 'px'; tags.pain.style.top = pp[1] + 'px';
        tags.cause.style.left = rx + 'px'; tags.cause.style.top = cp[1] + 'px';
        tags.pain.style.opacity = st.painV.toFixed(2);
        tags.cause.style.opacity = st.causeV.toFixed(2);
      }
    };
  }

  // Выравнивание, начиная с причины: p — общий прогресс 0…1 → компенсация каждой точки
  function sequential(p, order) {
    var vs = [0, 0, 0, 0, 0];
    order.forEach(function (idx, k) { vs[idx] = 1 - ease((p * 1.3 - k * 0.18) / 0.35); });
    return vs;
  }
  var painAfter = function (p) { return 1 - ease((p * 1.3 - 0.55) / 0.3); };
  function frame(sc, vs, painV, causeV) {
    return { dx: sc.dx.map(function (d, i) { return d * vs[i]; }), cause: sc.cause, painV: painV, causeV: causeV };
  }

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
    var mode = root.dataset.mode;
    var render = build(root, mode === 'diverge');

    if (mode === 'hero') {
      // цикл 11 с: компенсация → снимается, начиная с причины → лёгкость → возвращается;
      // каждый следующий круг — другой сценарий: причина то снизу, то сверху
      var T = 11000, t0 = 0;
      loops.set(root, function (now) {
        if (!t0) t0 = now;
        var n = Math.floor((now - t0) / T), sc = n % 2 ? SCEN.high : SCEN.low;
        var t = ((now - t0) % T) / T * 11, p;
        if (t < 1.5) p = 0;
        else if (t < 5) p = (t - 1.5) / 3.5;
        else if (t < 8.5) p = 1;
        else p = 1 - ease((t - 8.5) / 2.5);
        var vs = sequential(p, sc.order);
        render(frame(sc, vs, painAfter(p), vs[sc.cause]));
      });
      render(reduce ? frame(SCEN.low, [0, 0, 0, 0, 0], 0, 0) : frame(SCEN.low, [1, 1, 1, 1, 1], 1, 1));
    }

    if (mode === 'diverge') {
      var range = document.querySelector('[data-posture-range]');
      var btns = Array.prototype.slice.call(document.querySelectorAll('[data-cause]'));
      var v = reduce ? 0.8 : 0, touched = reduce, demoStart = 0;
      var cur = SCEN.low.dx.slice(), from = cur.slice(), to = cur.slice(), mixAt = 0, causeIdx = SCEN.low.cause;
      var paint = function (now) {
        var t = mixAt ? ease((now - mixAt) / 520) : 1;
        if (t >= 1) mixAt = 0;
        cur = from.map(function (a, i) { return lerp(a, to[i], t); });
        render({ dx: cur.map(function (d) { return d * v; }), cause: causeIdx, painV: ease(v * 1.15), causeV: v });
        if (range) range.value = Math.round(v * 100);
      };
      if (range) range.addEventListener('input', function () { touched = true; v = range.value / 100; paint(performance.now()); });
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          var c = b.getAttribute('data-cause');
          btns.forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
          from = cur.slice(); to = SCEN[c].dx.slice(); causeIdx = SCEN[c].cause;
          mixAt = reduce ? 0 : performance.now();
          if (reduce) from = to.slice();
          if (v < 0.3) { v = 0.85; touched = true; }      // переключили при «нет ограничения» — сразу показываем разницу
          setCause(c);
          paint(performance.now()); wake();
        });
      });
      loops.set(root, function (now) {
        if (mixAt) paint(now);
        if (touched) return;
        if (!demoStart) demoStart = now + 400;
        v = 0.85 * ease((now - demoStart) / 1800);
        paint(now);
        if (v >= 0.849) touched = true;
      });
      window.addEventListener('resize', function () { paint(performance.now()); });
      paint(performance.now());
    }

    if (mode === 'method') {
      var section = root.closest('section');
      var draw = function () {
        var sc = SCEN[shared.cause];
        var r = section.getBoundingClientRect(), vh = window.innerHeight;
        var p = clamp((vh * 0.65 - r.top) / (r.height * 0.6));
        var vs = sequential(p, sc.order);
        render(frame(sc, vs, painAfter(p), vs[sc.cause]));
      };
      loops.set(root, draw);
      shared.listeners.push(draw);
      window.addEventListener('scroll', function () { if (visible.has(root)) wake(); }, { passive: true });
      draw();
    }

    if (io) io.observe(root); else { visible.add(root); wake(); }
  });
})();
