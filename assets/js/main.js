/* AISANCE — минимальный слой поведения: прогресс, появление, отрисовка линий. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- год в футере ---------- */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* ---------- подготовка линий-росчерков ---------- */
  function prime(path) {
    var len;
    try { len = path.getTotalLength(); } catch (e) { return; }
    if (!len) return;
    len = Math.ceil(len * 1.2);           /* запас: viewBox растягивается по ширине */
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = reduce ? 0 : len;
  }
  var swashes = Array.prototype.slice.call(document.querySelectorAll('.swash path, .thread path, .dv-base'));
  swashes.forEach(prime);

  function draw(el) { el.style.strokeDashoffset = 0; }

  /* ---------- появление блоков ---------- */
  var revealTargets = Array.prototype.slice.call(
    document.querySelectorAll('[data-anim], .thread, .diverge, .seq')
  );

  function activate(el) {
    if (el.classList.contains('thread')) {
      el.classList.add('is-drawn');
      var p = el.querySelector('path');
      if (p) draw(p);
      return;
    }
    el.classList.add('is-in');
    if (el.classList.contains('diverge')) {
      var base = el.querySelector('.dv-base');
      if (base) draw(base);
    }
  }

  if (!('IntersectionObserver' in window) || reduce) {
    revealTargets.forEach(activate);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        activate(en.target);
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    revealTargets.forEach(function (el) { io.observe(el); });
  }

  /* ---------- hero: росчерк рисуется сразу ---------- */
  var heroSwash = document.querySelector('.hero__title .swash');
  if (heroSwash) {
    setTimeout(function () {
      heroSwash.classList.add('is-drawn');
      var p = heroSwash.querySelector('path');
      if (p) draw(p);
    }, 140);
  }
  var startSwash = document.querySelector('.swash--start');
  if (startSwash && 'IntersectionObserver' in window && !reduce) {
    var io2 = new IntersectionObserver(function (e) {
      if (!e[0].isIntersecting) return;
      var p = startSwash.querySelector('path');
      if (p) draw(p);
      io2.disconnect();
    }, { threshold: 0.4 });
    io2.observe(startSwash);
  } else if (startSwash) {
    var sp = startSwash.querySelector('path');
    if (sp) draw(sp);
  }

  /* ---------- прогресс чтения + залипание шапки ---------- */
  var bar = document.querySelector('.progress i');
  var railFill = document.querySelector('.rail__track i');
  var topbar = document.querySelector('.topbar');
  var ticking = false;

  function onScroll() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (bar) bar.style.transform = 'scaleX(' + p + ')';
    if (railFill) railFill.style.transform = 'scaleY(' + p + ')';
    if (topbar) topbar.classList.toggle('is-stuck', window.scrollY > window.innerHeight * 0.6);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScroll);
  }, { passive: true });
  onScroll();

  /* ---------- активный раздел в рельсе ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.rail__list a'));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if (sections.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }
})();
