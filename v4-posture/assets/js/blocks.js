/* AISANCE · вариант 4 — живые блоки страницы.
   «Метод»: пять направлений по кругу — не очередь, а набор. Маршрут для человека
            рисуется поверх круга и меняется от примера к примеру.
   «Кому»:  карточки «отметьте, что про вас» — после первой отметки появляется
            подсказка, с чего начать. Ничего не сохраняется и никуда не отправляется. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var editing = function () { return document.body.classList.contains('is-editing'); };

  /* ---------- «Метод»: круг направлений ---------- */
  var ring = document.querySelector('[data-kit-ring]');
  if (ring) {
    var NAMES = ['Мобильность', 'Стабилизация', 'Контроль', 'Интеграция', 'Закрепление'];
    var ROUTES = [
      { nodes: [1, 2, 3, 4], caption: 'Подвижности хватает — мобилизировать бесполезно. Начинаем со стабилизации, мобильность в маршрут не входит.' },
      { nodes: [0, 1, 2, 3, 4], caption: 'Диапазона не хватает — начинаем с мобильности и проходим все пять направлений.' }
    ];
    var R = 40, LR = 57;
    var pos = NAMES.map(function (_, k) {
      var a = (-90 + k * 72) * Math.PI / 180;
      return { x: R * Math.cos(a), y: R * Math.sin(a), lx: LR * Math.cos(a), ly: LR * Math.sin(a) };
    });
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '-72 -72 144 144');
    svg.setAttribute('aria-hidden', 'true');
    var mk = function (tag, attrs, cls, parent) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (cls) e.setAttribute('class', cls);
      (parent || svg).appendChild(e);
      return e;
    };
    mk('circle', { r: R }, 'kit-orbit');
    var route = mk('path', {}, 'kit-route');
    var nodes = pos.map(function (p) { return mk('circle', { cx: p.x, cy: p.y, r: 4.2 }, 'kit-node'); });
    var nums = pos.map(function (p) {
      var t = mk('text', { x: p.x, y: p.y + 1.6, 'text-anchor': 'middle' }, 'kit-num');
      return t;
    });
    ring.appendChild(svg);
    var center = document.createElement('span');
    center.className = 'kit-center';
    center.innerHTML = 'порядок —<br>под человека';
    ring.appendChild(center);
    var names = pos.map(function (p, k) {
      var s = document.createElement('span');
      s.className = 'kit-name';
      s.textContent = NAMES[k];
      s.style.left = (50 + p.lx / 144 * 100).toFixed(2) + '%';
      s.style.top = (50 + p.ly / 144 * 100).toFixed(2) + '%';
      ring.appendChild(s);
      return s;
    });

    var caption = document.querySelector('[data-kit-caption]');
    var switches = Array.prototype.slice.call(document.querySelectorAll('[data-route]'));
    var items = Array.prototype.slice.call(document.querySelectorAll('.kit__list li[data-k]'));
    var current = 0, auto = !reduce, timer = 0;

    function show(i) {
      current = i;
      var r = ROUTES[i];
      var d = r.nodes.map(function (k, j) { return (j ? 'L' : 'M') + pos[k].x.toFixed(2) + ' ' + pos[k].y.toFixed(2); }).join('');
      route.setAttribute('d', d);
      if (!reduce) {                                       // маршрут прорисовывается заново
        var len = route.getTotalLength();
        route.style.transition = 'none';
        route.style.strokeDasharray = len; route.style.strokeDashoffset = len;
        route.getBoundingClientRect();
        route.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.22,.61,.36,1)';
        route.style.strokeDashoffset = 0;
      }
      nodes.forEach(function (n, k) {
        var j = r.nodes.indexOf(k);
        n.classList.toggle('is-on', j >= 0);
        n.classList.toggle('is-first', j === 0);
        nums[k].textContent = j >= 0 ? String(j + 1) : '';
        names[k].classList.toggle('is-off', j < 0);
        if (items[k]) items[k].classList.toggle('is-off', j < 0);
      });
      if (caption) caption.textContent = r.caption;
      switches.forEach(function (b, k) { b.setAttribute('aria-checked', String(k === i)); });
    }
    switches.forEach(function (b, k) {
      b.addEventListener('click', function () { auto = false; clearInterval(timer); show(k); });
    });
    items.forEach(function (li) {
      var k = +li.getAttribute('data-k');
      var on = function () { nodes[k].classList.add('is-hl'); names[k].classList.add('is-hl'); };
      var off = function () { nodes[k].classList.remove('is-hl'); names[k].classList.remove('is-hl'); };
      li.addEventListener('mouseenter', on); li.addEventListener('mouseleave', off);
      li.addEventListener('focusin', on); li.addEventListener('focusout', off);
    });
    show(0);
    // пока блок на экране и читатель ничего не выбрал — примеры сменяются сами
    if (auto && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          clearInterval(timer);
          if (e.isIntersecting && auto) timer = setInterval(function () { if (auto && !editing()) show((current + 1) % ROUTES.length); }, 7000);
        });
      }, { threshold: 0.4 }).observe(ring);
    }
  }

  /* ---------- «Кому»: отметьте, что про вас ---------- */
  var cards = Array.prototype.slice.call(document.querySelectorAll('.who-card'));
  var cta = document.querySelector('.who__cta');
  function toggle(card) {
    if (editing()) return;                                 // в режиме правок клик — это правка текста
    var on = card.getAttribute('aria-checked') !== 'true';
    card.setAttribute('aria-checked', String(on));
    if (cta) cta.hidden = !cards.some(function (c) { return c.getAttribute('aria-checked') === 'true'; });
  }
  cards.forEach(function (card) {
    card.addEventListener('click', function () { toggle(card); });
    card.addEventListener('keydown', function (e) {
      if (e.target !== card) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(card); }
    });
  });
})();
