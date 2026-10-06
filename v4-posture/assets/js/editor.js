/* AISANCE · редактор правок (черновой этап).
   Режим правок прямо на странице:
   — клик в текст блока — правка на месте;
   — наведение на блок — кнопка «Команда» (что сделать с блоком);
   — у каждого раздела — «Команда к разделу»;
   — «Скопировать для Claude» собирает все правки и команды в один список.
   Всё хранится только в браузере читателя (localStorage) и никуда не отправляется.
   Перед боевым запуском: убрать подключение editor.js и editor.css из index.html. */
(function () {
  'use strict';

  var KEY = 'aisance.editor.v1';
  var ON_KEY = 'aisance.editor.on';
  var SEL = 'main h2, main h3, main p, main li, main dt, main dd, main figcaption, main .btn span, main .shot__brief, .foot p';
  var SKIP = '.sec__num, .foot__phrase, .posture, label';          // служебное и утверждённая фраза — не правим
  var ALLOWED = { B: 1, STRONG: 1, I: 1, EM: 1, SPAN: 1, BR: 1 };
  var CHIPS = ['Короче', 'Проще', 'Конкретнее', 'Добавить пример', 'Мягче по тону', 'Убрать блок'];

  var S = { edits: {}, notes: {}, sec: {} };
  try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved) S = { edits: saved.edits || {}, notes: saved.notes || {}, sec: saved.sec || {} }; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  /* ---------- безопасная очистка и сравнение разметки ---------- */
  function clean(html) {
    var t = document.createElement('template');
    t.innerHTML = html;
    (function walk(parent) {
      var n = parent.firstChild;
      while (n) {
        var next = n.nextSibling;
        if (n.nodeType === 1) {
          if (!ALLOWED[n.tagName]) {                               // лишний тег — разворачиваем, текст остаётся
            var first = n.firstChild;
            while (n.firstChild) parent.insertBefore(n.firstChild, n);
            parent.removeChild(n);
            n = first || next;
            continue;
          }
          Array.prototype.slice.call(n.attributes).forEach(function (a) { if (a.name !== 'class') n.removeAttribute(a.name); });
          walk(n);
        } else if (n.nodeType !== 3) {
          parent.removeChild(n);
        }
        n = next;
      }
    })(t.content);
    return t.innerHTML;
  }
  var norm = function (el) { return clean(el.innerHTML).replace(/\s+/g, ' ').trim(); };
  function plain(html) {
    var d = document.createElement('div');
    d.innerHTML = html.replace(/<br\s*\/?>/gi, '\n').replace(/><(?!\/)/g, '> <');   // соседние блоки не склеиваем
    return d.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').trim();
  }

  /* ---------- блоки и разделы ---------- */
  var sections = Array.prototype.slice.call(document.querySelectorAll('main > section, footer')).map(function (el) {
    var id = el.id || (el.classList.contains('hero') ? 'hero' : 'footer');
    var num = el.querySelector('.sec__num'), title;
    if (num) {
      var b = num.querySelector('b');
      title = (b ? b.textContent + ' · ' : '') + num.textContent.replace(b ? b.textContent : '', '').trim();
    } else {
      title = id === 'hero' ? 'Первый экран' : 'Футер';
    }
    return { el: el, id: id, title: title, blocks: [] };
  });

  var cands = Array.prototype.slice.call(document.querySelectorAll(SEL)).filter(function (e) {
    return !e.closest(SKIP) && e.textContent.trim();
  });
  var leaves = cands.filter(function (e) {                         // только «листья»: без вложенных блоков
    return !cands.some(function (o) { return o !== e && e.contains(o); });
  });

  var blocks = [], byEl = new Map(), byEid = {};
  leaves.forEach(function (el) {
    var host = el.closest('main > section, footer');
    var sec = sections.filter(function (s) { return s.el === host; })[0];
    if (!sec) return;
    var eid = sec.id + '.' + (sec.blocks.length + 1);
    var b = { el: el, eid: eid, sec: sec, raw: el.innerHTML, orig: norm(el) };
    sec.blocks.push(b); blocks.push(b); byEl.set(el, b); byEid[eid] = b;
  });

  /* применяем сохранённые правки; устаревшие (текст в коде уже другой) не трогаем страницу */
  blocks.forEach(function (b) {
    var r = S.edits[b.eid];
    if (!r) return;
    if (r.o === b.orig) { b.el.innerHTML = r.h; b.el.classList.add('ed-changed'); }
    else if (r.h === b.orig) { delete S.edits[b.eid]; }              // правку уже внесли в код
  });
  save();

  /* ---------- интерфейс ---------- */
  var editing = false;
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  var pill = mk('button', 'ed-pill', 'Правки');
  pill.type = 'button'; pill.id = 'ed-pill'; pill.setAttribute('aria-label', 'Включить режим правок');

  var tb = mk('div', 'ed-tb');
  tb.id = 'ed-tb'; tb.hidden = true; tb.setAttribute('role', 'toolbar'); tb.setAttribute('aria-label', 'Режим правок');
  tb.innerHTML =
    '<div class="ed-tb__row"><span class="ed-tb__title"><i></i>Режим правок</span><span class="ed-tb__cnt" id="ed-cnt"></span></div>' +
    '<p class="ed-tb__hint">Кликните в текст — правьте. Наведите на блок — появится «Команда». Enter абзац не создаёт: для этого оставьте блоку команду.</p>' +
    '<div class="ed-tb__row ed-tb__btns">' +
    '<button type="button" data-act="list">Список правок</button>' +
    '<button type="button" data-act="copy" class="is-main">Скопировать для Claude</button>' +
    '<button type="button" data-act="reset">Сбросить всё</button>' +
    '<button type="button" data-act="off">Готово</button></div>';

  var bar = mk('div', 'ed-bar');
  bar.id = 'ed-bar'; bar.hidden = true;
  bar.innerHTML = '<button type="button" data-act="note">Команда</button><button type="button" data-act="undo" hidden>Сбросить блок</button>';

  var pop = mk('div', 'ed-pop');
  pop.id = 'ed-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog');

  var toast = mk('div', 'ed-toast'); toast.hidden = true; toast.setAttribute('role', 'status');
  document.body.appendChild(pill); document.body.appendChild(tb); document.body.appendChild(bar);
  document.body.appendChild(pop); document.body.appendChild(toast);

  var secBtns = sections.map(function (s) {
    var wrap = s.el.querySelector('.wrap');
    if (!wrap) return null;
    var btn = mk('button', 'ed-sec-btn');
    btn.type = 'button'; btn.hidden = true;
    btn.addEventListener('click', function () { openPop('sec', s.id, s.title, btn.getBoundingClientRect(), btn); });
    wrap.appendChild(btn);
    return { s: s, btn: btn };
  }).filter(Boolean);

  function counts() {
    var e = 0, n = 0;
    blocks.forEach(function (b) {
      var r = S.edits[b.eid], m = S.notes[b.eid];
      if (r && r.o === b.orig) e++;
      if (m && m.o === b.orig) n++;
    });
    var stale = Object.keys(S.edits).length - e + Object.keys(S.notes).length - n;
    return { e: e, n: n + Object.keys(S.sec).length, stale: stale };
  }
  function refresh() {
    var c = counts();
    document.getElementById('ed-cnt').textContent =
      'Правок: ' + c.e + ' · Команд: ' + c.n + (c.stale ? ' · К прежней версии: ' + c.stale : '');
    pill.textContent = 'Правки' + (c.e + c.n ? ' · ' + (c.e + c.n) : '');
    blocks.forEach(function (b) {
      var m = S.notes[b.eid];
      b.el.classList.toggle('ed-noted', !!(m && m.o === b.orig));
    });
    secBtns.forEach(function (x) {
      var has = !!S.sec[x.s.id];
      x.btn.classList.toggle('has', has);
      x.btn.textContent = (has ? '● ' : '') + (x.s.id === 'hero' ? 'Команда к первому экрану' : x.s.id === 'footer' ? 'Команда к футеру' : 'Команда к разделу');
    });
  }

  function say(text) {
    toast.textContent = text; toast.hidden = false;
    clearTimeout(say.t); say.t = setTimeout(function () { toast.hidden = true; }, 2800);
  }

  /* ---------- режим правок ---------- */
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('is-editing', on);
    blocks.forEach(function (b) {
      if (on) { b.el.setAttribute('contenteditable', 'true'); b.el.setAttribute('spellcheck', 'true'); b.el.classList.add('ed-block'); }
      else { b.el.removeAttribute('contenteditable'); b.el.removeAttribute('spellcheck'); b.el.classList.remove('ed-block'); }
    });
    secBtns.forEach(function (x) { x.btn.hidden = !on; });
    tb.hidden = !on; pill.hidden = on;
    hideBar(); closePop();
    try { localStorage.setItem(ON_KEY, on ? '1' : '0'); } catch (e) {}
    refresh();
  }

  /* ---------- правка текста ---------- */
  document.addEventListener('input', function (e) {
    var el = e.target.closest && e.target.closest('.ed-block');
    var b = el && byEl.get(el);
    if (!b) return;
    var cur = norm(b.el);
    if (cur === b.orig) { delete S.edits[b.eid]; b.el.classList.remove('ed-changed'); }
    else { S.edits[b.eid] = { o: b.orig, h: cur }; b.el.classList.add('ed-changed'); }
    save(); refresh(); if (barTarget === b) syncBar();
  });
  document.addEventListener('keydown', function (e) {
    var el = e.target.closest && e.target.closest('.ed-block');
    if (!el) return;
    if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
    if (e.key === 'Escape') el.blur();
  });
  document.addEventListener('paste', function (e) {                // вставляем только текст, без чужого оформления
    var el = e.target.closest && e.target.closest('.ed-block');
    if (!el) return;
    e.preventDefault();
    var t = ((e.clipboardData || window.clipboardData).getData('text/plain') || '').replace(/\s*\n\s*/g, ' ');
    document.execCommand('insertText', false, t);
  });
  document.addEventListener('click', function (e) {                // в режиме правок внешние ссылки не уводят со страницы
    if (!editing) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && !a.closest('.rail') && a.getAttribute('href').charAt(0) !== '#') e.preventDefault();
  }, true);

  /* ---------- плавающая панель блока ---------- */
  var barTarget = null, hideTimer = 0;
  function syncBar() {
    var b = barTarget;
    if (!b) return;
    var m = S.notes[b.eid];
    bar.querySelector('[data-act=note]').textContent = m && m.o === b.orig ? 'Команда ●' : 'Команда';
    bar.querySelector('[data-act=undo]').hidden = !(S.edits[b.eid] && S.edits[b.eid].o === b.orig);
  }
  function placeBar() {
    var b = barTarget;
    if (!b) return;
    var r = b.el.getBoundingClientRect();
    if (r.bottom < 80 || r.top > window.innerHeight) { hideBar(); return; }
    bar.hidden = false;
    var w = bar.offsetWidth;
    bar.style.left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)) + 'px';
    bar.style.top = Math.max(78, r.top - 34) + 'px';
  }
  function showBar(b) {
    if (!editing || !b) return;
    clearTimeout(hideTimer);
    barTarget = b; syncBar(); placeBar();
  }
  function hideBar() { bar.hidden = true; barTarget = null; }

  document.addEventListener('mouseover', function (e) {
    if (!editing) return;
    var el = e.target.closest && e.target.closest('.ed-block');
    if (el) showBar(byEl.get(el));
    else if (e.target.closest && e.target.closest('#ed-bar')) clearTimeout(hideTimer);
  });
  document.addEventListener('mouseout', function (e) {
    if (!editing || !e.target.closest) return;
    if (e.target.closest('.ed-block') || e.target.closest('#ed-bar')) hideTimer = setTimeout(hideBar, 350);
  });
  document.addEventListener('focusin', function (e) {
    var el = editing && e.target.closest && e.target.closest('.ed-block');
    if (el) showBar(byEl.get(el));
  });
  window.addEventListener('scroll', function () {
    if (!barTarget) return;
    if (document.activeElement === barTarget.el) placeBar(); else hideBar();
    if (!pop.hidden) closePop();
  }, { passive: true });

  bar.addEventListener('click', function (e) {
    var act = e.target.getAttribute && e.target.getAttribute('data-act');
    var b = barTarget;
    if (!act || !b) return;
    if (act === 'note') openPop('block', b.eid, plain(b.orig).slice(0, 70), bar.getBoundingClientRect(), b);
    if (act === 'undo') {
      b.el.innerHTML = b.raw; b.el.classList.remove('ed-changed');
      delete S.edits[b.eid]; save(); refresh(); syncBar(); placeBar();
    }
  });

  /* ---------- окно команды ---------- */
  var popCtx = null;
  function openPop(kind, key, label, rect, target) {
    var cur = kind === 'sec' ? S.sec[key] : (S.notes[key] && S.notes[key].o === target.orig ? S.notes[key] : null);
    popCtx = { kind: kind, key: key, target: target };
    pop.innerHTML =
      '<p class="ed-pop__title">' + (kind === 'sec' ? 'Команда к разделу' : 'Команда к блоку') + '</p>' +
      '<p class="ed-pop__sub"></p>' +
      '<textarea rows="3" placeholder="Что сделать: сократить, переписать мягче, добавить пример…"></textarea>' +
      '<div class="ed-pop__chips"></div>' +
      '<div class="ed-pop__btns"><button type="button" data-act="save" class="is-main">Сохранить</button>' +
      '<button type="button" data-act="drop">Удалить</button><button type="button" data-act="close">Закрыть</button></div>';
    pop.querySelector('.ed-pop__sub').textContent = '«' + label + (label.length >= 70 ? '…' : '') + '»';
    var ta = pop.querySelector('textarea');
    ta.value = cur ? cur.t : '';
    var chips = pop.querySelector('.ed-pop__chips');
    CHIPS.forEach(function (c) {
      var x = mk('button', '', c); x.type = 'button';
      x.addEventListener('click', function () { ta.value = (ta.value.trim() ? ta.value.trim() + '. ' : '') + c; ta.focus(); });
      chips.appendChild(x);
    });
    pop.hidden = false;
    var narrow = window.innerWidth < 640;
    pop.classList.toggle('ed-pop--sheet', narrow);
    if (!narrow) {
      var w = pop.offsetWidth, h = pop.offsetHeight;
      pop.style.left = Math.max(8, Math.min(rect.right - w, window.innerWidth - w - 8)) + 'px';
      var top = rect.bottom + 8;
      if (top + h > window.innerHeight - 8) top = Math.max(8, rect.top - h - 8);
      pop.style.top = top + 'px';
    } else { pop.style.left = pop.style.top = ''; }
    ta.focus();
  }
  function closePop() { pop.hidden = true; popCtx = null; }
  pop.addEventListener('click', function (e) {
    var act = e.target.getAttribute && e.target.getAttribute('data-act');
    if (!act || !popCtx) return;
    var c = popCtx, val = pop.querySelector('textarea').value.trim();
    if (act === 'save') {
      if (c.kind === 'sec') { if (val) S.sec[c.key] = { t: val }; else delete S.sec[c.key]; }
      else { if (val) S.notes[c.key] = { t: val, o: c.target.orig }; else delete S.notes[c.key]; }
      save(); refresh(); syncBar(); say(val ? 'Команда сохранена' : 'Команда удалена'); closePop();
    }
    if (act === 'drop') {
      if (c.kind === 'sec') delete S.sec[c.key]; else delete S.notes[c.key];
      save(); refresh(); syncBar(); say('Команда удалена'); closePop();
    }
    if (act === 'close') closePop();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) closePop(); });

  /* ---------- выгрузка для Claude ---------- */
  function exportText() {
    var d = new Date().toLocaleDateString('ru-RU');
    var out = ['# Правки к лендингу AISANCE',
      'Версия: v4-posture · ' + location.origin + location.pathname + ' · ' + d,
      '«Было» — текст на странице. «Стало» — мой вариант. «Команда» — что сделать с блоком. Примени и опубликуй.', ''];
    var any = false;
    sections.forEach(function (s) {
      var lines = [];
      if (S.sec[s.id]) lines.push('Команда к разделу: ' + S.sec[s.id].t, '');
      s.blocks.forEach(function (b) {
        var r = S.edits[b.eid], m = S.notes[b.eid];
        r = r && r.o === b.orig ? r : null; m = m && m.o === b.orig ? m : null;
        if (!r && !m) return;
        lines.push('— «' + plain(b.orig).replace(/\s+/g, ' ').slice(0, 60) + '…»');
        if (r) { lines.push('  Было: ' + plain(b.orig)); lines.push('  Стало: ' + plain(r.h)); }
        else lines.push('  Текст: ' + plain(b.orig));
        if (m) lines.push('  Команда: ' + m.t);
        lines.push('');
      });
      if (lines.length) { any = true; out.push('## ' + s.title + ' (#' + s.id + ')'); out = out.concat(lines); }
    });
    var stale = [];
    Object.keys(S.edits).forEach(function (id) {
      var b = byEid[id], r = S.edits[id];
      if (b && r.o === b.orig) return;
      stale.push('— Было: ' + plain(r.o), '  Стало: ' + plain(r.h), '');
    });
    Object.keys(S.notes).forEach(function (id) {
      var b = byEid[id], m = S.notes[id];
      if (b && m.o === b.orig) return;
      stale.push('— Текст: ' + plain(m.o), '  Команда: ' + m.t, '');
    });
    if (stale.length) { any = true; out.push('## Правки к прежней версии текста (на странице не применены)'); out = out.concat(stale); }
    if (!any) out.push('Правок и команд пока нет.');
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function openModal() {
    var txt = exportText();
    var m = mk('div', 'ed-modal');
    m.innerHTML = '<div class="ed-modal__box" role="dialog" aria-label="Список правок"><p class="ed-pop__title">Список правок</p>' +
      '<textarea readonly></textarea><div class="ed-pop__btns"><button type="button" data-act="copy" class="is-main">Скопировать для Claude</button>' +
      '<button type="button" data-act="dl">Скачать .md</button><button type="button" data-act="close">Закрыть</button></div></div>';
    var ta = m.querySelector('textarea'); ta.value = txt;
    m.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (e.target === m || act === 'close') m.remove();
      if (act === 'copy') copyOut(ta);
      if (act === 'dl') download(txt);
    });
    document.body.appendChild(m);
    ta.focus(); ta.select();
  }
  function copyOut(ta) {
    var txt = ta ? ta.value : exportText();
    var done = function (ok) {
      if (ok) say('Скопировано — вставьте в чат с Claude');
      else if (ta) { ta.focus(); ta.select(); say('Выделено — нажмите Cmd/Ctrl + C'); }
      else openModal();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); });
    else done(false);
  }
  function download(txt) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/markdown;charset=utf-8' }));
    a.download = 'aisance-правки-' + new Date().toISOString().slice(0, 10) + '.md';
    document.body.appendChild(a); a.click(); a.remove();
  }

  tb.addEventListener('click', function (e) {
    var act = e.target.getAttribute && e.target.getAttribute('data-act');
    if (act === 'list') openModal();
    if (act === 'copy') copyOut();
    if (act === 'off') setEditing(false);
    if (act === 'reset') {
      if (!window.confirm('Сбросить все правки и команды? Текст вернётся к версии из кода.')) return;
      blocks.forEach(function (b) { b.el.innerHTML = b.raw; b.el.classList.remove('ed-changed'); });
      S = { edits: {}, notes: {}, sec: {} }; save(); refresh(); say('Всё сброшено');
    }
  });
  pill.addEventListener('click', function () { setEditing(true); });

  /* ---------- старт ---------- */
  var q = /[?&]edit(=([^&]*))?/.exec(location.search), on = false;
  try { on = localStorage.getItem(ON_KEY) === '1'; } catch (e) {}
  if (q) on = q[2] !== '0';
  refresh();
  setEditing(on);
})();
