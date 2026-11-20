/* Live Auction House · shared behaviour for AWS Capstone Project 19 (three pages). Plain JS, no network. */
(function () {
  'use strict';
  var doc = document;
  doc.documentElement.classList.add('js');
  var RM = false;
  try { RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function el(tag, attrs, kids) {
    var n = doc.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return n;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var mem = {};
  var store = {
    get: function (k) { try { var v = localStorage.getItem(k); return v === null ? (mem[k] === undefined ? null : mem[k]) : v; } catch (e) { return mem[k] === undefined ? null : mem[k]; } },
    set: function (k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} }
  };
  window.LAH = { sims: {} };

  /* ---------- copy buttons ---------- */
  function copyText(text, done, fail) {
    function fallback() {
      try {
        var ta = el('textarea', { 'aria-hidden': 'true', readonly: '' });
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; ta.style.left = '-999px';
        doc.body.appendChild(ta); ta.select();
        var ok = doc.execCommand('copy');
        doc.body.removeChild(ta);
        ok ? done() : fail();
      } catch (e) { fail(); }
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  function selectNode(n) {
    try { var r = doc.createRange(); r.selectNodeContents(n); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
  }
  function initCopy() {
    $$('button.copy').forEach(function (btn) {
      var live = el('span', { class: 'sr-only', 'aria-live': 'polite' });
      btn.parentNode.insertBefore(live, btn.nextSibling);
      btn.addEventListener('click', function () {
        var spec = btn.getAttribute('data-copy'), target = null, text = '';
        if (spec === 'this-pre') { var d = btn.closest('details'); target = d && $('pre', d); }
        else if (spec) target = $(spec);
        else { var cb = btn.closest('.codebox'); target = cb && $('pre', cb); }
        if (!target) return;
        var lines = $$('.l', target);
        text = lines.length ? lines.map(function (l) { return l.textContent; }).join('\n') : target.textContent;
        var label = btn.getAttribute('data-label') || btn.textContent;
        btn.setAttribute('data-label', label);
        copyText(text, function () {
          btn.textContent = 'Copied ✓'; btn.classList.add('ok'); live.textContent = 'Copied';
          setTimeout(function () { btn.textContent = label; btn.classList.remove('ok'); live.textContent = ''; }, 1600);
        }, function () {
          btn.textContent = 'Press Ctrl+C'; selectNode(target);
          setTimeout(function () { btn.textContent = label; }, 2400);
        });
      });
    });
  }

  /* ---------- toc, progress bar ---------- */
  function initToc() {
    var bar = $('#progress');
    function onScroll() {
      if (!bar) return;
      var h = doc.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, window.scrollY / h * 100) : 0) + '%';
    }
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    var links = $$('nav.toc a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { var t = $(a.getAttribute('href')); if (t) map[a.getAttribute('href').slice(1)] = { a: a, t: t }; });
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id; if (!map[id]) return;
        if (current) current.classList.remove('active');
        current = map[id].a; current.classList.add('active');
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    Object.keys(map).forEach(function (k) { io.observe(map[k].t); });
  }

  /* ---------- checkpoints and progress ring ---------- */
  var CIRC = 2 * Math.PI * 18;
  function ensureRings() {
    $$('nav.toc, details.mobile-toc').forEach(function (host) {
      if ($('.toc-progress', host)) return;
      var svg = '<svg class="ring" viewBox="0 0 44 44" aria-hidden="true"><circle class="bg" cx="22" cy="22" r="18"></circle><circle class="fg" cx="22" cy="22" r="18" stroke-dasharray="' + CIRC.toFixed(2) + '" stroke-dashoffset="' + CIRC.toFixed(2) + '"></circle></svg>';
      host.appendChild(el('div', { class: 'toc-progress', html: svg + '<span class="ringText">0 of 0 checks</span>' }));
    });
  }
  function updateRing() {
    var all = $$('.checkpoint input[type=checkbox]');
    var on = all.filter(function (c) { return c.checked; }).length, n = all.length;
    $$('.toc-progress').forEach(function (p) {
      var fg = $('.fg', p), tx = $('.ringText', p);
      if (fg) fg.setAttribute('stroke-dashoffset', (CIRC * (1 - (n ? on / n : 0))).toFixed(2));
      if (tx) tx.textContent = (n && on === n) ? 'Part done' : on + ' of ' + n + ' checks';
      p.classList.toggle('done', !!n && on === n);
    });
  }
  function initCheckpoints() {
    ensureRings();
    $$('.checkpoint').forEach(function (ck) {
      var key = 'lah:v1:' + (ck.getAttribute('data-ck') || 'x');
      var boxes = $$('input[type=checkbox]', ck), cnt = $('.ck-count', ck);
      var saved = [];
      try { saved = JSON.parse(store.get(key) || '[]') || []; } catch (e) { saved = []; }
      boxes.forEach(function (b) { b.checked = saved.indexOf(b.getAttribute('data-id')) > -1; });
      function save() {
        store.set(key, JSON.stringify(boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.getAttribute('data-id'); })));
        if (cnt) cnt.textContent = boxes.filter(function (b) { return b.checked; }).length + ' / ' + boxes.length;
        updateRing();
      }
      boxes.forEach(function (b) { b.addEventListener('change', save); });
      var reset = $('.ck-reset', ck);
      if (reset) reset.addEventListener('click', function () { boxes.forEach(function (b) { b.checked = false; }); save(); });
      if (cnt) cnt.textContent = boxes.filter(function (b) { return b.checked; }).length + ' / ' + boxes.length;
    });
    updateRing();
  }

  /* ---------- quiz ---------- */
  function initQuiz() {
    $$('.quiz').forEach(function (qz) {
      var qs = $$('fieldset.q', qz), score = $('.quiz-score', qz);
      function tally() {
        var done = qs.filter(function (q) { return q.getAttribute('data-done'); });
        var right = done.filter(function (q) { return q.getAttribute('data-done') === 'right'; }).length;
        if (score) score.textContent = done.length === qs.length ? 'You got ' + right + ' of ' + qs.length : 'Answered ' + done.length + ' of ' + qs.length;
      }
      qs.forEach(function (q) {
        $$('input[type=radio]', q).forEach(function (r) {
          r.addEventListener('change', function () {
            if (q.getAttribute('data-done')) return;
            var ans = q.getAttribute('data-answer'), ok = r.value === ans;
            $$('input[type=radio]', q).forEach(function (x) {
              x.disabled = true;
              var lab = x.closest('label');
              if (x.value === ans) lab.classList.add('right');
              else if (x === r) lab.classList.add('wrong');
            });
            q.setAttribute('data-done', ok ? 'right' : 'wrong');
            var fb = $('.q-fb', q), why = $('.q-why', q);
            if (fb) { fb.textContent = ok ? 'Right.' : 'Not quite: the right answer is highlighted in green.'; fb.hidden = false; }
            if (why) why.hidden = false;
            tally();
          });
        });
      });
      var reset = $('.quiz-reset', qz);
      if (reset) reset.addEventListener('click', function () {
        qs.forEach(function (q) {
          q.removeAttribute('data-done');
          $$('input[type=radio]', q).forEach(function (x) { x.checked = false; x.disabled = false; x.closest('label').classList.remove('right', 'wrong'); });
          var fb = $('.q-fb', q), why = $('.q-why', q);
          if (fb) { fb.hidden = true; fb.textContent = ''; } if (why) why.hidden = true;
        });
        tally();
      });
      tally();
    });
  }

  /* ---------- tabs (agents, os) ---------- */
  function initTabs(root, tabSel, panelSel, key, onChange) {
    var tabs = $$(tabSel, root), panels = $$(panelSel, root);
    if (!tabs.length) return null;
    function select(i, focus) {
      tabs.forEach(function (t, j) {
        t.setAttribute('aria-selected', j === i ? 'true' : 'false');
        t.tabIndex = j === i ? 0 : -1;
        if (panels[j]) panels[j].hidden = j !== i;
      });
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i); if (onChange) onChange(t.getAttribute('data-key') || String(i)); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') n = (i + tabs.length - 1) % tabs.length;
        else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1;
        if (n === null) return;
        e.preventDefault(); select(n, true); if (onChange) onChange(tabs[n].getAttribute('data-key') || String(n));
      });
    });
    return { select: function (keyName) {
      for (var i = 0; i < tabs.length; i++) if ((tabs[i].getAttribute('data-key') || String(i)) === keyName) { select(i); return true; }
      return false; }, init: function (i) { select(i || 0); } };
  }
  function initAgentsOs() {
    var groups = [];
    $$('.agents').forEach(function (a) { var t = initTabs(a, '.ag-tabs [role=tab]', '.ag-panel', 'agent', function (k) { store.set('lah:v1:agent', k); groups.forEach(function (g) { if (g.root !== a && g.root.classList.contains('agents')) g.t.select(k); }); }); if (t) { groups.push({ root: a, t: t }); } });
    $$('.tabs-os').forEach(function (a) { var t = initTabs(a, '.os-tabs [role=tab]', '.os-panel', 'os', function (k) { store.set('lah:v1:os', k); groups.forEach(function (g) { if (g.root !== a && g.root.classList.contains('tabs-os')) g.t.select(k); }); }); if (t) { groups.push({ root: a, t: t }); } });
    var ag = store.get('lah:v1:agent'), os = store.get('lah:v1:os');
    if (!os) { try { os = /win/i.test(navigator.platform || '') ? 'win' : 'mac'; } catch (e) { os = 'mac'; } }
    groups.forEach(function (g) {
      if (g.root.classList.contains('agents')) { if (!(ag && g.t.select(ag))) g.t.init(0); }
      else if (!g.t.select(os)) g.t.init(0);
    });
  }

  /* ---------- architecture diagram ---------- */
  var ARCH = {
    1: { n: 'web api db', a: 'a1 a2', c: 'Part 1: browser → API → database. One health check proves the path.' },
    2: { n: 'web api db', a: 'a1 a2', c: 'Part 2: real tables for users, auctions and bids, behind the same three boxes.' },
    3: { n: 'api db', a: 'a2', c: 'Part 3: nothing new to see. The change is inside the database call: a transaction and a row lock.' },
    4: { n: 'socket redis web api', a: 'a3 a4 a5', c: 'Part 4: after a bid commits, the API tells every open page through Socket.IO, with Redis linking API copies.' },
    5: { n: 'api db', a: 'a2', c: 'Part 5: a planted bug in the same database call. No new boxes; a new kind of work: review.' },
    6: { n: 'close mq notify db redis', a: 'a6 a7 a8 a9', c: 'Part 6: two background workers joined by RabbitMQ close the auction and send the pop-ups.' },
    7: { n: 'stripe api db', a: 'a10 a11', c: 'Part 7: the winner pays on a mock Stripe page; only a signed webhook marks it paid.' },
    8: { n: 'jaeger api close notify stripe', a: 'a12', c: 'Part 8: every service sends spans to Jaeger, so one auction can be followed end to end.' },
    all: { n: 'web api db redis socket close mq notify stripe jaeger', a: 'a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 a12', c: 'Everything, as it runs at the end of Part 8.' }
  };
  function initArch() {
    $$('[data-arch]').forEach(function (box) {
      var btns = $$('button[data-part]', box), cap = $('.arch-cap', box);
      function show(p) {
        var m = ARCH[p]; if (!m) return;
        var ns = m.n.split(' '), as = m.a.split(' ');
        $$('.nd', box).forEach(function (n) { n.classList.toggle('on', ns.indexOf((n.id || '').replace('n-', '')) > -1); });
        $$('.ar', box).forEach(function (a) {
          var ids = (a.getAttribute('data-ar') || '').split(' ');
          a.classList.toggle('on', ids.some(function (i) { return as.indexOf(i) > -1; }));
        });
        btns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-part') === String(p) ? 'true' : 'false'); });
        if (cap) cap.textContent = m.c;
      }
      btns.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-part')); }); });
      show(box.getAttribute('data-arch-part') || 'all');
    });
  }

  /* ---------- generic stepper for simulators ---------- */
  function stepper(sim, total, render, opts) {
    opts = opts || {};
    var i = 0, timer = null;
    var bBack = el('button', { type: 'button', class: 'btn ghost', text: '◀ Back' });
    var bStep = el('button', { type: 'button', class: 'btn', text: 'Step ▶' });
    var bPlay = el('button', { type: 'button', class: 'btn ghost', text: '▶ Play', 'aria-pressed': 'false' });
    var bReset = el('button', { type: 'button', class: 'btn ghost', text: 'Reset' });
    var count = el('span', { class: 'sim-count', 'aria-live': 'off' });
    var bar = el('div', { class: 'sim-controls row' }, [bBack, bStep, bPlay, bReset, count]);
    function stop() { if (timer) { clearInterval(timer); timer = null; } bPlay.textContent = '▶ Play'; bPlay.setAttribute('aria-pressed', 'false'); }
    function go(n) {
      i = Math.max(0, Math.min(total(), n));
      bBack.disabled = i === 0; bStep.disabled = i >= total();
      count.textContent = 'Step ' + i + ' / ' + total();
      render(i);
      if (i >= total()) stop();
    }
    bBack.addEventListener('click', function () { stop(); go(i - 1); });
    bStep.addEventListener('click', function () { stop(); go(i + 1); });
    bReset.addEventListener('click', function () { stop(); if (opts.onReset) opts.onReset(); go(0); });
    bPlay.addEventListener('click', function () {
      if (timer) { stop(); return; }
      if (i >= total()) go(0);
      bPlay.textContent = '❚❚ Pause'; bPlay.setAttribute('aria-pressed', 'true');
      timer = setInterval(function () { go(i + 1); }, 1600);
    });
    sim.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); stop(); go(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); go(i - 1); }
    });
    return { bar: bar, go: go, stop: stop, get: function () { return i; } };
  }
  function sayBox() { return el('p', { class: 'sim-say', 'aria-live': 'polite' }); }

  /* ---------- Simulator 1 · grill-me ---------- */
  var GRILL = [
    { q: 'Who is using the site? There is no login yet. Do you want real accounts now, or demo users?', rec: 1, opts: [
      { t: 'Real sign-up and login with passwords', push: 'That adds password storage, sessions and reset emails before anyone can place a bid. Most of that has nothing to do with auctions. I’d defer it.', line: '- Actors: real accounts with login (adds auth work to Part 2) ⚠' },
      { t: 'Ten seeded demo users, a switcher in the footer, no login', line: '- Actors: 10 seeded demo users; footer switcher; no auth; each tab keeps its own user' },
      { t: 'Anyone can bid without a name', push: 'Then we can’t stop a seller bidding on their own item, or show who is winning. We need at least a demo identity.', line: '- Actors: anonymous bidders (no seller rule possible) ⚠' }] },
    { q: 'How should money be stored?', rec: 1, opts: [
      { t: 'Float dollars, like 101.5', push: 'Floats can’t hold most decimal amounts exactly: 0.1 + 0.2 is 0.30000000000000004. Over many bids, that drift becomes a wrong total.', line: '- Money: float dollars (rounding risk) ⚠' },
      { t: 'Integer cents, like 10150 for $101.50', line: '- Money: USD, integer cents ($101.50 = 10150)' },
      { t: 'A decimal string, like "101.50"', push: 'Strings work for display but every comparison needs parsing, and the database can’t check ‘is this bid higher?’ for you.', line: '- Money: decimal strings (parse on every comparison) ⚠' }] },
    { q: 'How much higher than the current price must a new bid be, and who enforces it?', rec: 1, opts: [
      { t: 'Any amount higher; the bid form checks it', push: 'A form check is a hint, not a rule. Anyone can send a request straight to the API and skip the form. The API must enforce it.', line: '- Minimum raise: any amount; checked in the browser only ⚠' },
      { t: 'At least $1 more, enforced by the API (the form shows the minimum too)', line: '- Minimum bid: current price + $1 (100 cents); the API rejects anything lower' },
      { t: 'At least 5% more', push: 'Fine for a real site, but percentages on cents need a rounding rule, and you haven’t asked for one. A flat $1 is simpler to test.', line: '- Minimum bid: +5% (rounding rule still open) ⚠' }] },
    { q: 'Two people could click Bid at the same instant. Do we solve that now?', rec: 1, opts: [
      { t: 'Yes, make it bullet-proof in this part', push: 'We can, but it doubles this part. Getting ordinary bidding right first, then proving the race with a test, teaches more. I’d defer it to Part 3.', line: '- Concurrency: handled in Part 2 (larger slice) ⚠' },
      { t: 'No. Part 2 handles one bid at a time; locking comes in Part 3', line: '- Concurrency: sequential only in Part 2; simultaneous bids deferred to Part 3' },
      { t: 'Ignore it', push: 'Then nobody will remember it. Let’s write it down as known and deferred, so it can’t be lost.', line: '- Concurrency: not considered ⚠' }] }
  ];
  function simGrill(sim) {
    var qi = 0, phase = 'ask', ans = [], pick = null, newest = -1, slices = false;
    var counter = el('span', { class: 'gr-q' });
    var bBack = el('button', { type: 'button', class: 'btn ghost', text: 'Back' });
    var bReset = el('button', { type: 'button', class: 'btn ghost', text: 'Reset' });
    var top = el('div', { class: 'sim-controls row' }, [counter, el('span', { class: 'grow' }), bBack, bReset]);
    top.firstChild.style.margin = '0';
    var agent = el('div', { class: 'gr-agent', role: 'group' });
    var left = el('div', { class: 'panel' }, [el('h5', { text: 'Agent' }), agent]);
    var md = el('pre', { class: 'gr-md', 'aria-live': 'polite', 'aria-label': 'GRILL.md, live' });
    var right = el('div', { class: 'panel' }, [el('h5', { text: 'part-2-create-auction-and-bid/GRILL.md' }), md]);
    var grid = el('div', { class: 'gr-grid' }, [left, right]);
    var say = sayBox();
    sim.appendChild(top); sim.appendChild(grid); sim.appendChild(say);
    var START = 'The agent reads the repo first, then interviews you. Answer four questions and watch GRILL.md fill in.';
    function warnCount() { return ans.filter(function (a) { return a && /⚠/.test(a.line); }).length; }
    function drawMd() {
      var h = '# GRILL.md · Part 2: create auctions and bid\n## Decisions\n';
      ans.forEach(function (a, i) {
        if (!a) return;
        var t = esc(a.line).replace('⚠', '⚠ trade-off accepted');
        h += (i === newest ? '<span class="newl">' + t + '</span>' : t) + '\n';
      });
      if (slices) h += '\n## Slices\n1. Catalogue from the database + demo-user switcher\n2. Post an auction as the active user\n3. Place, validate and list bids\n';
      if (phase !== 'done') h += '<span class="cursor">▍</span>';
      md.innerHTML = h;
    }
    function render(focusSel) {
      agent.innerHTML = ''; agent.classList.remove('push');
      var label = el('span', { class: 'who', text: '🤖 Agent' });
      agent.appendChild(label);
      if (phase === 'slices' || phase === 'done') {
        counter.textContent = phase === 'done' ? 'Done' : 'Plan';
        agent.appendChild(el('p', { text: phase === 'done' ? 'Plan approved. Slice 1 is next, one slice at a time.' : 'I have what I need. Here is the work as three slices. Each one ends with something you can click. Approve them and I’ll build Slice 1 only, then stop.' }));
        if (phase === 'slices') {
          var ap = el('button', { type: 'button', class: 'btn violet', text: 'Approve the plan' });
          ap.addEventListener('click', function () {
            phase = 'done'; newest = -1; drawMd(); render();
            var w = warnCount();
            say.textContent = 'That’s grilling. No feature code was written. The decisions are on disk, so a fresh chat (or a teammate) can pick them up.' + (w ? ' You kept ' + w + ' trade-off' + (w > 1 ? 's' : '') + '. That’s allowed: it’s your product. It’s now written down.' : '');
          });
          agent.appendChild(el('div', { class: 'gr-actions' }, [ap]));
        }
        return;
      }
      var Q = GRILL[qi];
      counter.textContent = 'Question ' + (qi + 1) + ' of 4';
      var qid = 'gr-q-' + qi + '-' + Math.random().toString(36).slice(2, 6);
      agent.setAttribute('aria-labelledby', qid);
      agent.appendChild(el('p', { id: qid, text: Q.q }));
      if (phase === 'ask') {
        var g = el('div', { class: 'gr-opts' });
        Q.opts.forEach(function (o, k) {
          var b = el('button', { type: 'button', class: 'btn ghost' }, [o.t, k === Q.rec ? el('span', { class: 'rec', text: '★ recommended' }) : null]);
          b.addEventListener('click', function () { choose(k); });
          g.appendChild(b);
        });
        agent.appendChild(g);
      } else {
        var o = Q.opts[pick];
        agent.appendChild(el('p', { class: 'gr-you', text: '🧑 You: “' + o.t + '”' }));
        if (phase === 'push') {
          agent.classList.add('push');
          label.textContent = '🤖 Agent pushes back';
          agent.appendChild(el('p', { text: o.push }));
          var keep = el('button', { type: 'button', class: 'btn ghost', text: 'Keep my choice' });
          var take = el('button', { type: 'button', class: 'btn', text: 'Take the recommendation' });
          keep.addEventListener('click', function () { commit(pick); });
          take.addEventListener('click', function () { pick = Q.rec; commit(pick); });
          agent.appendChild(el('div', { class: 'gr-actions' }, [keep, take]));
          if (focusSel) keep.focus();
        } else {
          var nx = el('button', { type: 'button', class: 'btn', text: qi === 3 ? 'See the plan →' : 'Next question →' });
          nx.addEventListener('click', function () {
            newest = -1;
            if (qi === 3) { phase = 'slices'; slices = true; say.textContent = 'The agent proposes slices. Approve them to finish.'; drawMd(); render(); }
            else { qi++; phase = 'ask'; pick = null; say.textContent = 'Next question.'; drawMd(); render(); }
          });
          agent.appendChild(el('div', { class: 'gr-actions' }, [nx]));
          if (focusSel) nx.focus();
        }
      }
    }
    function choose(k) {
      var o = GRILL[qi].opts[k]; pick = k;
      if (o.push) { phase = 'push'; say.textContent = 'The agent pushes back. Keep your choice or take its recommendation.'; render(true); }
      else commit(k);
    }
    function commit(k) {
      var o = GRILL[qi].opts[k]; pick = k; ans[qi] = { line: o.line }; newest = qi; phase = 'chosen';
      say.textContent = 'Written to GRILL.md. Press the button when you are ready to move on.';
      drawMd(); render(true);
      setTimeout(function () { newest = -1; }, 2000);
    }
    function back() {
      if (phase === 'done') { phase = 'slices'; }
      else if (phase === 'slices') { slices = false; qi = 3; ans[3] = null; phase = 'ask'; pick = null; }
      else if (phase === 'chosen' || phase === 'push') { ans[qi] = null; phase = 'ask'; pick = null; }
      else if (phase === 'ask' && qi > 0) { qi--; ans[qi] = null; phase = 'ask'; pick = null; }
      newest = -1; say.textContent = START; drawMd(); render();
    }
    function reset() { qi = 0; phase = 'ask'; ans = []; pick = null; newest = -1; slices = false; say.textContent = START; drawMd(); render(); }
    bBack.addEventListener('click', back); bReset.addEventListener('click', reset);
    reset();
  }

  /* ---------- Simulator 2 · bidding war ---------- */
  var BW = {
    off: {
      label: 'Lock off',
      ben: ['read current price → $101', 'check 102 ≥ 101 + 1', 'INSERT $102', 'result: 201 Accepted'],
      chen: ['read current price → $101', 'check 102 ≥ 101 + 1', 'INSERT $102', 'result: 201 Accepted'],
      steps: [
        ['pppp', 'pppp', -1, -1, '', '', 'A', '$102', 'Asha leads at $101. Ben and Chen both type $102 and click Bid in the same second. Press Step.'],
        ['dppp', 'pppp', 0, -1, '', '', 'A', '$102', 'Ben’s request reads the highest bid: $101.'],
        ['dppp', 'dppp', 0, 0, '', '', 'A', '$102', 'Chen’s request reads it a few milliseconds later. Nothing has changed yet, so it also sees $101.'],
        ['ddpp', 'dppp', 1, 0, '', '', 'A', '$102', 'Ben’s bid passes the rule: at least $1 more than $101.'],
        ['ddpp', 'ddpp', 1, 1, '', '', 'A', '$102', 'Chen’s bid passes the same check, against the same old price.'],
        ['dddp', 'ddpp', 2, 1, '', '', 'AB', '$103', 'Ben’s bid is saved.'],
        ['dddp', 'dddp', 2, 2, '', '', 'ABC', '$103', 'Chen’s bid is saved too. Two accepted $102 bids. Who is winning? The rule said every bid must beat the last one by $1, and this one didn’t.'],
        ['dddd', 'dddd', 3, 3, '', '', 'ABC', '$103', 'Both bidders were told they’re winning. This is the race. Each request was correct on its own; together they broke the rule.']
      ]
    },
    on: {
      label: 'Lock on · FOR UPDATE',
      ben: ['BEGIN; SELECT … FOR UPDATE', 'read current price → $101', 'check 102 ≥ 102', 'INSERT $102', 'COMMIT → 201 Accepted'],
      chen: ['BEGIN; SELECT … FOR UPDATE', 'read current price → $102', 'check 102 ≥ 103', 'ROLLBACK → 409 BID_TOO_LOW'],
      steps: [
        ['ppppp', 'pppp', -1, -1, '', '', 'A', '$102', 'Same moment, same $102 bids. This time each request opens a transaction and locks the auction row first.'],
        ['dpppp', 'pppp', 0, -1, '🔒 Ben', '', 'A', '$102', 'Ben’s transaction reaches the auction row first and takes the row lock.'],
        ['dpppp', 'wppp', 0, 0, '🔒 Ben', 'Chen waiting', 'A', '$102', 'Chen’s transaction asks for the same lock and has to wait. It hasn’t read the price yet.'],
        ['dddpp', 'wppp', 2, 0, '🔒 Ben', 'Chen waiting', 'A', '$102', 'Inside the lock, Ben reads $101 and his $102 passes.'],
        ['ddddp', 'wppp', 3, 0, '🔒 Ben', 'Chen waiting', 'AB', '$102', 'Ben’s bid is written, still inside his transaction.'],
        ['ddddd', 'dppp', 4, 0, '🔒 Chen', '', 'AB', '$102', 'Ben commits. The lock is released and Chen’s transaction finally gets it.'],
        ['ddddd', 'ddpp', 4, 1, '🔒 Chen', '', 'AB', '$103', 'Now Chen reads the price, after the lock. It’s $102, Ben’s bid.'],
        ['ddddd', 'ddrr', 4, 3, 'none', '', 'AB', '$103', 'Chen’s $102 is too low. The API answers 409 with the new minimum, $103. Chen’s page refreshes and keeps ‘102.00’ in the box so Chen can decide.'],
        ['ddddd', 'ddrr', 4, 3, 'none', '', 'AB', '$103', 'One $102 bid, one clear leader. The fix was not a cleverer check; it was making the read and the write happen one auction at a time.']
      ]
    },
    share: {
      label: 'Shared lock · FOR SHARE',
      ben: ['BEGIN; SELECT … FOR SHARE', 'read current price → $101', 'check 102 ≥ 102', 'INSERT $102', 'COMMIT → 201 Accepted'],
      chen: ['BEGIN; SELECT … FOR SHARE', 'read current price → $101', 'check 102 ≥ 102', 'INSERT $102', 'COMMIT → 201 Accepted'],
      steps: [
        ['ppppp', 'ppppp', -1, -1, '', '', 'A', '$102', 'Same moment, same $102 bids. This time the transaction asks for a lock, but a different kind.'],
        ['dpppp', 'ppppp', 0, -1, 'shared: Ben', '', 'A', '$102', 'Ben takes a shared lock on the auction row.'],
        ['dpppp', 'dpppp', 0, 0, 'shared: Ben + Chen', '', 'A', '$102', 'Chen asks for a shared lock too. Shared locks don’t block each other, so Chen walks straight in.'],
        ['dddpp', 'dddpp', 2, 2, 'shared: Ben + Chen', '', 'A', '$102', 'Both read $101, and both pass the check against the same old price.'],
        ['ddddp', 'dddpp', 3, 2, 'shared: Ben + Chen', '', 'AB', '$102', 'Ben’s bid is saved.'],
        ['ddddp', 'ddddp', 3, 3, 'shared: Ben + Chen', '', 'ABC', '$102', 'Chen’s bid is saved too. Two accepted $102 bids again.'],
        ['ddddd', 'ddddd', 4, 4, 'none', '', 'ABC', '$103', 'Both commit and both are told 201 Accepted. Same race as Part 2. Every remaining test still passes, because the test that would catch it was deleted. One word changed.']
      ]
    }
  };
  function simBidwar(sim) {
    var modes = (sim.getAttribute('data-modes') || 'off,on').split(',');
    var mode = modes[0], inst = {};
    var modeBtns = modes.map(function (m) {
      var b = el('button', { type: 'button', class: 'btn ghost', 'aria-pressed': 'false', text: BW[m].label });
      b.addEventListener('click', function () { setMode(m); });
      return b;
    });
    var mrow = el('div', { class: 'row', role: 'group', 'aria-label': 'Locking mode' }, [el('b', { text: 'Mode:' })].concat(modeBtns));
    var laneBen = el('div', { class: 'panel lane ben' }), laneChen = el('div', { class: 'panel lane chen' }), db = el('div', { class: 'panel bw-db' });
    var stage = el('div', { class: 'sim-stage bw-grid' }, [laneBen, db, laneChen]);
    var say = sayBox();
    var st = stepper(sim, function () { return BW[mode].steps.length - 1; }, render);
    sim.appendChild(mrow); sim.appendChild(st.bar); sim.appendChild(stage); sim.appendChild(say);
    function lane(box, name, lines, states, cur, who) {
      box.innerHTML = '';
      box.appendChild(el('h5', { text: name + ' · bids $102' }));
      var ol = el('ol');
      var show = cur < 0 ? 0 : cur;
      lines.forEach(function (t, k) {
        var s = states.charAt(k) || 'p';
        var li = el('li', { class: ({ p: '', d: 'done', w: 'wait', r: 'rej' })[s] + (k === cur ? ' cur' : '') + ((k === show || k === show - 1) ? '' : ' hide'), text: (k + 1) + ' ' + t });
        if (k === cur) li.setAttribute('aria-current', 'step');
        ol.appendChild(li);
      });
      box.appendChild(ol);
      var d = el('details', null, [el('summary', { text: 'show all steps' })]);
      d.addEventListener('toggle', function () { box.classList.toggle('all', d.open); });
      if (box.classList.contains('all')) d.open = true;
      box.appendChild(d);
    }
    function render(i) {
      var M = BW[mode], S = M.steps[i];
      lane(laneBen, 'Ben', M.ben, S[0], S[2]);
      lane(laneChen, 'Chen', M.chen, S[1], S[3]);
      var dup = S[6] === 'ABC';
      var rows = '<tr><td>Asha</td><td>$101</td><td>accepted</td></tr>';
      if (S[6].indexOf('B') > -1) rows += '<tr class="' + (dup ? 'dup' : '') + '"><td>Ben</td><td>$102</td><td>accepted' + (dup ? '<span class="pill">DUPLICATE</span>' : '') + '</td></tr>';
      if (S[6].indexOf('C') > -1) rows += '<tr class="' + (dup ? 'dup' : '') + '"><td>Chen</td><td>$102</td><td>accepted' + (dup ? '<span class="pill">DUPLICATE</span>' : '') + '</td></tr>';
      var lockTxt = S[4] || 'none', on = lockTxt !== 'none';
      db.innerHTML = '<h5>PostgreSQL</h5><div class="bw-row"><b>Used GPU</b>starting $100 · ends 6:00 pm<br><span class="lock' + (on ? ' on' : '') + '">lock: ' + esc(lockTxt) + '</span>' + (S[5] ? '<span class="chip">' + esc(S[5]) + '</span>' : '') + '</div>' +
        '<table class="bids"><thead><tr><th scope="col">Bidder</th><th scope="col">Amount</th><th scope="col">Status</th></tr></thead><tbody>' + rows + '</tbody></table><p class="minbid">minimum next bid: ' + esc(S[7]) + '</p>';
      say.textContent = S[8];
    }
    function setMode(m) {
      if (!BW[m] || modes.indexOf(m) < 0) return;
      mode = m; st.stop();
      modeBtns.forEach(function (b, k) { b.setAttribute('aria-pressed', modes[k] === m ? 'true' : 'false'); });
      st.go(0);
    }
    inst.setMode = setMode;
    sim._lah = inst;
    setMode(mode);
  }

  /* ---------- Simulator 3 · auction close ---------- */
  var CL_NODES = ['⏱ Close worker', '🐘 PostgreSQL', '🐇 RabbitMQ', '🔔 Notify worker', '🔌 Socket.IO', '🌐 Browsers'];
  var CL_CRASH_LABEL = ['Crash the close worker at this step', 'Crash the database step: after commit, before publishing', 'Crash RabbitMQ step: after the broker confirmed, before marking published', 'Crash the notification worker: deliveries saved, before emitting or acknowledging', 'Crash the Socket.IO step: Chen’s pop-up sent, before it was marked sent'];
  var H = {
    1: { lit: 0, say: 'Within a second, the close worker polls. It finds the auction past its deadline with no close row, and claims it with <code>FOR UPDATE SKIP LOCKED</code>, so a second worker would skip it instead of closing it twice.', mut: function (s) { s.clock = '6:00:00 pm'; s.claimed = true; } },
    2: { lit: 1, say: 'In <b>one</b> transaction it writes the close (winner Chen, $107) and an <code>AuctionClosed</code> event into the outbox table. Both rows commit together, or neither does.', mut: function (s) { s.claimed = false; s.closes = 1; s.outbox = 1; s.pub = 'no'; } },
    3: { lit: 2, say: 'The publisher sends the event to RabbitMQ and waits for the broker’s confirm. Only then does it mark the outbox row published.', mut: function (s) { s.sent = 1; s.pub = 'yes'; } },
    4: { lit: 3, say: 'The notification worker receives the message and inserts one delivery per person. A unique key on (event, person) means a repeat insert does nothing.', mut: function (s) { s.deliveries = 2; } },
    5: { lit: 4, say: 'It sends each delivery to that person’s Socket.IO room through Redis, using the delivery’s ID as the notification ID.', mut: function (s) { s.emitted = true; } },
    6: { lit: 5, say: 'Dana sees: “Your auction for Used GPU ended. Chen won with $107.” Chen sees: “You won Used GPU with a bid of $107.” Then the worker acknowledges the message.', mut: function (s) { s.popD = 1; s.popC = 1; s.modalD = true; s.modalC = true; } }
  };
  var CL_SCEN = {
    1: [H[1], { lit: 0, crash: 0, say: '💥 The worker crashes after claiming the auction but before committing. The transaction is rolled back: no close row, no outbox row. The row lock is released.', mut: function (s) { s.claimed = false; s.clock = '6:00:00 pm'; } },
      { lit: 0, say: 'The worker restarts (or another copy is running). On its next poll, one second later, it finds the same auction still unclosed and claims it again.', mut: function (s) { s.claimed = true; s.clock = '6:00:01 pm'; } }, H[2], H[3], H[4], H[5], H[6]],
    2: [H[1], H[2], { lit: 1, crash: 1, say: '💥 The close and the outbox row are committed, then the worker dies before talking to RabbitMQ. Without an outbox, this is where the notification would be lost forever.' },
      { lit: 1, say: 'On restart the publisher looks for outbox rows with <code>published_at</code> still empty. It finds this one.', mut: function (s) { s.clock = '6:00:02 pm'; } }, H[3], H[4], H[5], H[6]],
    3: [H[1], H[2], { lit: 2, say: 'The publisher sends the event to RabbitMQ and the broker confirms. The next line of code would mark the outbox row published.', mut: function (s) { s.sent = 1; } },
      { lit: 2, crash: 2, say: '💥 RabbitMQ confirmed the message, but the worker crashed before saving ‘published’. The row still looks unpublished.' },
      { lit: 2, say: 'On restart it publishes the same event again. RabbitMQ now holds two copies with the same message ID.', mut: function (s) { s.sent = 2; s.dupMsg = true; s.pub = 'yes'; s.clock = '6:00:02 pm'; } },
      { lit: 2, say: 'This is ‘at-least-once’ delivery: you may get a message twice, never zero times. The next steps must cope.' }, H[4], H[5], H[6],
      { lit: 3, say: 'Copy 2 arrives. The delivery insert hits the unique key and does nothing. There are no un-sent deliveries left, so nothing is emitted. The worker acknowledges it. Pop-ups stay at 1 each.' }],
    4: [H[1], H[2], H[3], H[4], { lit: 3, crash: 3, say: '💥 The worker saved both deliveries, then crashed before sending them or acknowledging the message.' },
      { lit: 3, say: 'RabbitMQ never got an acknowledgement, so it delivers the message again to the restarted worker.' },
      { lit: 3, say: 'The inserts do nothing (the rows exist). The worker selects deliveries not yet sent, finds both, and sends them with their original IDs.' }, H[5], H[6]],
    5: [H[1], H[2], H[3], H[4], { lit: 4, crash: 4, say: '💥 Chen’s notification went out, but the worker crashed before marking it sent.', mut: function (s) { s.popC = 1; s.modalC = true; } },
      { lit: 4, say: 'The message is redelivered. The worker finds Chen’s delivery still marked unsent and sends it again, with the same notification ID.' },
      { lit: 5, say: 'Chen’s browser tab has already handled that ID, so it ignores the repeat. No second pop-up. Dana’s is sent normally. Pop-ups: Dana 1 · Chen 1.', mut: function (s) { s.toastC = true; s.popD = 1; s.modalD = true; s.emitted = true; } }]
  };
  function clBuild(scen) {
    var s = { clock: '5:59:59 pm', claimed: false, closes: 0, outbox: 0, pub: 'no', deliveries: 0, emitted: false, sent: 0, dupMsg: false, popD: 0, popC: 0, modalD: false, modalC: false, toastC: false };
    var frames = [{ s: JSON.parse(JSON.stringify(s)), lit: -1, crash: -1, banner: false, say: 'Chen’s $107 is the highest bid. The clock is about to pass 6:00 pm. Bids already stop at 6:00 because of the Part 3 clock check; closing is a separate job.' }];
    var ops = scen ? CL_SCEN[scen] : [H[1], H[2], H[3], H[4], H[5], H[6]];
    ops.forEach(function (op, k) {
      if (op.mut) op.mut(s);
      frames.push({ s: JSON.parse(JSON.stringify(s)), lit: op.lit, crash: op.crash === undefined ? -1 : op.crash, say: op.say, banner: !!scen && k === ops.length - 1 });
    });
    return frames;
  }
  function simClose(sim) {
    var frames = clBuild(0), scen = 0, hid = {};
    var clock = el('p', { class: 'cl-clock' });
    var say = sayBox();
    var st = stepper(sim, function () { return frames.length - 1; }, render, { onReset: function () { scen = 0; frames = clBuild(0); lastIdx = -1; } });
    var pipe = el('ol', { class: 'cl-pipe', 'aria-label': 'The close pipeline' });
    var nodes = CL_NODES.map(function (n, k) {
      var box = el('div', { class: 'nd', text: n });
      var li = el('li', null, [box]);
      if (k < 5) {
        var b = el('button', { type: 'button', class: 'btn danger', text: 'Crash here', 'aria-label': CL_CRASH_LABEL[k] });
        b.addEventListener('click', function () { st.stop(); scen = k + 1; frames = clBuild(scen); var idx = 0; frames.forEach(function (f, j) { if (!idx && f.crash === k) idx = j; }); st.go(idx); });
        li.appendChild(b);
      }
      pipe.appendChild(li); return box;
    });
    var dbp = el('div', { class: 'panel cl-rows' }), cnt = el('div', { class: 'panel' });
    var mid = el('div', { class: 'cl-mid' }, [dbp, cnt]);
    var wD = el('div', { class: 'win-w' }), wC = el('div', { class: 'win-w' });
    var wins = el('div', { class: 'cl-wins' }, [wD, wC]);
    var banner = el('div', { class: 'banner', hidden: '' });
    var noCrash = el('button', { type: 'button', class: 'btn ghost', text: 'No crash' });
    noCrash.addEventListener('click', function () { st.stop(); scen = 0; frames = clBuild(0); lastIdx = -1; st.go(0); });
    st.bar.insertBefore(noCrash, st.bar.querySelector('.sim-count'));
    sim.appendChild(clock); sim.appendChild(st.bar); sim.appendChild(pipe); sim.appendChild(mid); sim.appendChild(wins); sim.appendChild(banner); sim.appendChild(say);
    function win(box, title, name, shown, key, toast, text) {
      box.innerHTML = '<div class="bar">' + title + '</div>';
      var body = el('div', { class: 'body' });
      if (shown && !hid[key]) {
        var m = el('div', { class: 'modal-c', role: 'dialog', 'aria-label': name + ' notification' }, [el('p', { text: text, style: 'margin:0' })]);
        var v = el('button', { type: 'button', class: 'btn ghost', text: 'View auction' }), d = el('button', { type: 'button', class: 'btn ghost', text: 'Dismiss' });
        v.addEventListener('click', function () { hid[key] = 'view'; render(st.get()); });
        d.addEventListener('click', function () { hid[key] = 'dismiss'; render(st.get()); });
        m.appendChild(el('div', { class: 'row' }, [v, d]));
        body.appendChild(m);
      } else if (shown && hid[key] === 'view') body.appendChild(el('p', { class: 'muted small', text: '(this would open the auction page)' }));
      else body.appendChild(el('p', { class: 'muted small', text: shown ? 'Pop-up dismissed.' : 'No pop-up yet.' }));
      if (toast) body.appendChild(el('span', { class: 'toast', text: 'duplicate ignored' }));
      box.appendChild(body);
    }
    var lastIdx = -1;
    function render(i) {
      var f = frames[i], s = f.s;
      if (i !== lastIdx) { hid = {}; lastIdx = i; }
      clock.textContent = '⏱ Clock ' + s.clock + (s.claimed ? '  ·  claimed: Used GPU' : '');
      nodes.forEach(function (n, k) { n.className = 'nd' + (f.crash === k ? ' crash' : (f.lit === k ? ' lit' : '')); n.textContent = (f.crash === k ? '💥 ' : '') + CL_NODES[k]; });
      dbp.innerHTML = '<h5>Database rows</h5><p>auction_closes: ' + s.closes + (s.closes ? ' (Chen, $107)' : '') + '</p><p>outbox_events: ' + s.outbox + (s.outbox ? ' · published: ' + s.pub : '') + '</p><p>notification_deliveries: ' + s.deliveries + (s.deliveries ? ' (Dana · seller, Chen · winner)' : '') + (s.emitted ? ' · emitted' : '') + '</p>';
      cnt.innerHTML = '<h5>Counters</h5><div class="cl-cnt"><span>Closes recorded</span><b>' + s.closes + '</b></div><div class="cl-cnt"><span>Messages sent</span><b' + (s.dupMsg ? ' class="dup"' : '') + '>' + s.sent + (s.dupMsg ? ' (duplicate)' : '') + '</b></div><div class="cl-cnt"><span>Pop-ups shown</span><b>Dana ' + s.popD + ' · Chen ' + s.popC + '</b></div>';
      win(wD, 'Dana · seller', 'Dana', s.modalD, 'D', false, 'Your auction for Used GPU ended. Chen won with $107.');
      win(wC, 'Chen · winner', 'Chen', s.modalC, 'C', s.toastC, 'You won Used GPU with a bid of $107.');
      banner.hidden = !f.banner; banner.textContent = 'Recovered: 1 close, 1 pop-up each, nothing lost.';
      say.innerHTML = f.say;
    }
    st.go(0);
  }

  /* ---------- Simulator 4 · trace explorer ---------- */
  var SVC = { 'auction-api': '#3FA7F5', 'auction-close-worker': '#F2A93B', 'notification-worker': '#7E6CF2', 'mock-stripe': '#5FBF6A' };
  var SP = [
    { n: 1, d: 0, name: 'auction.bid.accept', svc: 'auction-api', start: 0, dur: 38, seg: 0, off: 0, startLabel: '5:59:58.412 pm', tags: ['auction.slug=used-gpu', 'auction.bidder_user.id=3', 'auction.bid.amount_cents=10700', 'auction.bid.outcome=accepted', 'auction.id=7', 'auction.bid.id=42'], why: 'Chen’s winning bid. It starts as <code>auction.bid</code> and is renamed <code>.accept</code> or <code>.reject</code> once the outcome is known. Rejected bids are recorded as <code>auction.bid.reject</code> with an outcome tag, not as errors: a too-low bid is a normal business event. Its trace ID is saved on the auction row so later work can join this trace.' },
    { n: 2, d: 1, name: 'pg.query:INSERT auction_part_8', svc: 'auction-api', start: 6, dur: 4, seg: 0, off: 6, startLabel: '+6 ms', tags: ['db.system=postgresql (no SQL text)'], why: 'A useful database span is kept, but the SQL text is stripped before export. BEGIN/COMMIT and connection spans are dropped as noise.' },
    { gap: 'gap1', text: '≈ 2.5 s wait', msg: '≈ 2.5 s: the auction was still open. The close worker polls every second.' },
    { n: 3, d: 1, name: 'auction.close', svc: 'auction-close-worker', start: 2569, dur: 41, seg: 1, off: 0, startLabel: '6:00:00.981 pm', tags: ['auction.id=7', 'auction.close.outcome=winner_selected', 'auction.winning_bid.id=42', 'auction.winning_bid.amount_cents=10700', 'messaging.message.id=…'], why: 'A different process, 2.5 seconds later, continues the same trace. The close worker read the saved <code>traceparent</code> from the auction row and used it as the parent. The gap before it is the deadline, not slow code.' },
    { n: 4, d: 2, name: 'auction.closed.publish', svc: 'auction-close-worker', start: 2613, dur: 12, seg: 1, off: 44, startLabel: '+44 ms', tags: ['messaging.destination.name=auction.events', 'messaging.operation.name=publish', 'messaging.message.id=…'], why: 'A PRODUCER span. The trace context is put into the RabbitMQ message headers here; this is where work crosses into another service.' },
    { n: 5, d: 3, name: 'auction.closed.consume', svc: 'notification-worker', start: 2671, dur: 19, seg: 1, off: 102, startLabel: '+58 ms', tags: ['messaging.destination.name=auction.notifications', 'messaging.operation.name=consume', 'notification.delivery.count=2', 'event auction.outcome.emitted ×2'], why: 'A CONSUMER span in a third process. It extracted the context from the message headers. Its events show the two pop-ups sent (Dana and Chen).' },
    { gap: 'gap2', text: '≈ 2 min wait', msg: '≈ 2 min: a human was reading and typing. No span is open during this gap.' },
    { n: 6, d: 2, name: 'winner.checkout.start', svc: 'auction-api', start: 131888, dur: 96, seg: 2, off: 0, startLabel: '6:02:10.300 pm', tags: ['auction.id=7', 'auction.winning_bidder_user.id=3', 'winner.checkout.outcome=session_created'], why: 'Chen clicked Complete purchase two minutes later. The API read the <code>traceparent</code> saved on the close row, so checkout joins the same trace.' },
    { n: 7, d: 3, name: 'mock-stripe.checkout.create', svc: 'mock-stripe', start: 131919, dur: 9, seg: 2, off: 31, startLabel: '+31 ms', tags: ['purchase.id=…', 'purchase.amount_cents=10700'], why: 'The payment provider (our mock) records the session and keeps the trace context with it, so the later payment page continues the trace without holding a span open while Chen types.' },
    { n: 8, d: 3, name: 'mock-stripe.payment.attempt (declined)', svc: 'mock-stripe', start: 152638, dur: 7, seg: 2, off: 20750, startLabel: '6:02:31.050 pm', tags: ['payment.session.id=…', 'mock_stripe.payment.outcome=declined'], why: 'Chen tried the decline test card first. This is <b>not</b> an error span: a declined card is a business outcome, recorded as a tag.' },
    { n: 9, d: 3, name: 'mock-stripe.payment.attempt (paid)', svc: 'mock-stripe', start: 170288, dur: 52, seg: 2, off: 38400, startLabel: '6:02:48.700 pm', tags: ['payment.session.id=…', 'mock_stripe.payment.outcome=paid'], why: 'The second attempt with 4242… succeeds. The mock signs a webhook and sends it to the API.' },
    { n: 10, d: 4, name: 'winner.purchase.mark-paid', svc: 'auction-api', start: 170306, dur: 14, seg: 2, off: 38418, startLabel: '+18 ms', tags: ['messaging.message.id=<webhook event id>', 'payment.session.id=…', 'purchase.amount_cents=10700', 'winner.purchase.outcome=paid'], why: 'The signed webhook arrives; the API verifies it and marks the purchase paid. Its parent context came in the webhook’s HTTP headers.' }
  ];
  var SEGS = [{ len: 44, from: 0, w: 22 }, { len: 125, from: 26, w: 22 }, { len: 38500, from: 52, w: 48 }];
  var TOUR = [[1, 'Start where the business story starts: an accepted bid.'], [3, '2.5 seconds later, in another process, the close. Same trace, because the bid’s trace ID was stored in the database.'], [4, 'Here the work leaves this process: the event goes to RabbitMQ with the trace in its headers.'], [5, 'A third service picks it up and sends the pop-ups.'], [6, 'Two minutes pass. Nothing is running; Chen is reading the pop-up. Then checkout joins the trace.'], [8, 'A declined card. Notice: not red. It’s an outcome, not a failure of our system.'], [10, 'The signed webhook marks the purchase paid. One trace, four services, from bid to payment.']];
  function fmtDur(ms) { return ms + ' ms'; }
  function simTrace(sim) {
    var say = sayBox(), det = el('div', { class: 'tr-det', 'aria-live': 'polite' });
    var filt = null, sel = 0, tour = -1;
    var head = el('p', { class: 'tr-head', html: '<b>Trace 4bf9…</b> · auction-api: auction.bid.accept · 10 spans · 4 services · 2 min 50 s · timeline 5:59:58 → 6:02:50' });
    var fbar = el('div', { class: 'row tr-filter', role: 'group', 'aria-label': 'Filter by service' });
    var fbtns = [];
    ['All'].concat(Object.keys(SVC)).forEach(function (s) {
      var b = el('button', { type: 'button', class: 'btn ghost', 'aria-pressed': s === 'All' ? 'true' : 'false', text: s });
      b.addEventListener('click', function () { filt = s === 'All' ? null : s; fbtns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); drawList(); });
      fbtns.push(b); fbar.appendChild(b);
    });
    var tourBtn = el('button', { type: 'button', class: 'btn', text: 'Guided tour' });
    var tBack = el('button', { type: 'button', class: 'btn ghost', text: '◀ Back', hidden: '' }), tNext = el('button', { type: 'button', class: 'btn', text: 'Next ▶', hidden: '' });
    var hidBtn = el('button', { type: 'button', class: 'btn ghost', text: 'Show what we don’t export', 'aria-pressed': 'false' });
    var hid = el('p', { class: 'tr-hid', hidden: '', text: 'Not exported: health checks, catalogue refreshes, worker polling, Redis, DNS, connection and BEGIN/COMMIT spans, SQL text, request bodies, card data, names.' });
    var ctrl = el('div', { class: 'sim-controls row' }, [tourBtn, tBack, tNext, hidBtn]);
    var list = el('div', { class: 'tr-list', role: 'list' });
    sim.appendChild(head); sim.appendChild(fbar); sim.appendChild(ctrl); sim.appendChild(hid); sim.appendChild(list); sim.appendChild(det); sim.appendChild(say);
    hidBtn.addEventListener('click', function () { var o = hid.hidden; hid.hidden = !o; hidBtn.setAttribute('aria-pressed', o ? 'true' : 'false'); });
    function barFor(p) {
      var S = SEGS[p.seg], left = S.from + p.off / S.len * S.w, w = Math.max(p.dur / S.len * S.w, 0);
      var bar = el('span', { class: 'tr-bar', 'aria-hidden': 'true' });
      SEGS.slice(0, 2).forEach(function (g, k) { bar.appendChild(el('u', { style: 'position:absolute;top:0;bottom:0;left:' + (g.from + g.w) + '%;width:' + (SEGS[k + 1].from - g.from - g.w) + '%;background:repeating-linear-gradient(45deg,var(--line),var(--line) 3px,transparent 3px,transparent 6px);opacity:.7' })); });
      var i = el('i', { style: 'left:' + left.toFixed(2) + '%;width:max(' + w.toFixed(2) + '%,4px)' });
      bar.appendChild(i); return bar;
    }
    function drawList() {
      list.innerHTML = '';
      SP.forEach(function (p, idx) {
        if (p.gap) {
          var g = el('button', { type: 'button', class: 'tr-gap', text: p.text, 'aria-label': p.msg });
          g.addEventListener('click', function () { det.textContent = p.msg; });
          list.appendChild(g); return;
        }
        var row = el('button', { type: 'button', class: 'tr-row' + (filt && filt !== p.svc ? ' dim' : ''), role: 'listitem', 'aria-pressed': sel === idx ? 'true' : 'false', 'aria-label': p.name + ', ' + p.svc + ', ' + p.dur + ' milliseconds', 'data-i': idx, style: '--sc:' + SVC[p.svc] });
        var nm = el('span', { class: 'tr-name', style: 'padding-left:' + (p.d * 14) + 'px' }, [el('span', { class: 'tr-dot' }), (p.d ? '└ ' : '') + p.name]);
        var wrap = el('span', { style: 'min-width:0;display:block' }, [nm, el('span', { class: 'tr-meta', text: p.svc + ' · ' + fmtDur(p.dur) + ' · ' + p.startLabel })]);
        row.appendChild(wrap); row.appendChild(barFor(p));
        row.addEventListener('click', function () { select(idx); });
        row.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          var rows = $$('.tr-row', list), at = rows.indexOf(row), nx = rows[at + (e.key === 'ArrowDown' ? 1 : -1)];
          if (nx) nx.focus();
        });
        list.appendChild(row);
      });
    }
    function select(idx) {
      sel = idx; var p = SP[idx];
      $$('.tr-row', list).forEach(function (r) { r.setAttribute('aria-pressed', r.getAttribute('data-i') === String(idx) ? 'true' : 'false'); });
      var rel = (p.start / 1000).toFixed(2);
      det.innerHTML = '<p><b>' + esc(p.name) + '</b> · ' + esc(p.svc) + ' · ' + p.dur + ' ms · starts +' + rel + ' s after the trace began</p><p class="chips2">' + p.tags.map(function (t) { return '<code>' + esc(t) + '</code>'; }).join(' ') + '</p><p><b>Why it exists:</b> ' + p.why + '</p>';
    }
    function tourGo(n) {
      tour = Math.max(0, Math.min(TOUR.length - 1, n));
      var idx = TOUR[tour][0] - 1; var real = 0;
      SP.forEach(function (p, k) { if (p.n === TOUR[tour][0]) real = k; });
      select(real); say.textContent = (tour + 1) + '/' + TOUR.length + ' · ' + TOUR[tour][1];
      tBack.disabled = tour === 0; tNext.disabled = tour === TOUR.length - 1;
    }
    tourBtn.addEventListener('click', function () { tBack.hidden = false; tNext.hidden = false; tourGo(0); });
    tBack.addEventListener('click', function () { tourGo(tour - 1); });
    tNext.addEventListener('click', function () { tourGo(tour + 1); });
    drawList(); select(0);
    say.textContent = 'Click a span to see its tags and why it exists, or press Guided tour. The hatched bars are waiting, not code running.';
  }

  /* ---------- Mini game · spot the bug ---------- */
  var SB = [
    ['283', '        `SELECT id::text, seller_user_id, ends_at, starting_price_cents'],
    ['284', '         FROM auctions'],
    ['285', '         WHERE slug = $1'],
    ['286', '         FOR UPDATE`,', '         FOR SHARE`,'],
    ['287', '        [params.data.slug],'],
    ['288', '      );']
  ];
  function simSpot(sim) {
    var tries = 0, found = false;
    var intro = el('p', { class: 'sim-intro', text: 'One line in Part 5 differs from Part 4. Click it.' });
    var say = sayBox();
    function codebox(title) { return el('div', { class: 'codebox' }, [el('div', { class: 'codebar' }, [el('span', { class: 'fname', text: title })])]); }
    var L = codebox('Part 4 · app.ts lines 283–288'), R = codebox('Part 5 · app.ts lines 283–288');
    var lpre = el('pre', { class: 'sb-code' }), rpre = el('pre', { class: 'sb-code' });
    var lrows = [], rrows = [];
    SB.forEach(function (r) {
      var l = el('span', { class: 'ln2', text: r[0] + '  ' + r[1] }); lpre.appendChild(l); lrows.push(l);
      var b = el('button', { type: 'button', class: 'line', 'aria-label': 'Line ' + r[0] + ': ' + (r[2] || r[1]).trim(), text: r[0] + '  ' + (r[2] || r[1]) });
      b.addEventListener('click', function () { pick(b, !!r[2], r[0]); });
      rpre.appendChild(b); rrows.push(b);
    });
    L.appendChild(lpre); R.appendChild(rpre);
    var reset = el('button', { type: 'button', class: 'btn ghost', text: 'Reset' });
    var attempts = el('span', { class: 'sim-count', text: 'Attempts: 0' });
    var link = el('a', { class: 'btn', href: '#sim-share', text: 'Show me in the simulator', hidden: '' });
    var bar = el('div', { class: 'sim-controls row' }, [reset, link, attempts]);
    if (!$('.sim-intro', sim)) sim.appendChild(intro); sim.appendChild(el('div', { class: 'sb-grid' }, [L, R])); sim.appendChild(bar); sim.appendChild(say);
    function pick(b, ok, n) {
      if (found) return;
      if (!ok) {
        tries++; attempts.textContent = 'Attempts: ' + tries; b.classList.add('bad');
        say.textContent = 'Not this one: it’s the same in both.' + (tries >= 3 ? ' Hint: look at how the auction row is locked.' : '');
        setTimeout(function () { b.classList.remove('bad'); }, 1200);
      } else {
        found = true; b.classList.add('good'); lrows[3].classList.add('hot'); link.hidden = false;
        say.innerHTML = 'Found it. <code>FOR UPDATE</code> became <code>FOR SHARE</code>. Run the bidding-war simulator below in Shared mode to see why that one word brings the race back.';
      }
    }
    function doReset() { tries = 0; found = false; attempts.textContent = 'Attempts: 0'; link.hidden = true; lrows.forEach(function (x) { x.classList.remove('hot'); }); rrows.forEach(function (x) { x.classList.remove('bad', 'good'); }); say.textContent = ''; }
    reset.addEventListener('click', doReset);
    link.addEventListener('click', function () {
      var t = $('#sim-share'); if (t && t._lah) t._lah.setMode('share');
    });
  }

  /* ---------- init ---------- */
  function initSims() {
    var map = { grill: simGrill, bidwar: simBidwar, close: simClose, trace: simTrace, spotbug: simSpot };
    $$('[data-sim]').forEach(function (s) {
      var f = map[s.getAttribute('data-sim')];
      if (f) { try { f(s); } catch (e) { if (window.console) console.error(e); } }
    });
  }
  function initFigures() {
    $$('figure.wire svg, .diagram svg').forEach(function (svg) {
      if (svg.closest('.figscroll')) return;
      var w = el('div', { class: 'figscroll' });
      svg.parentNode.insertBefore(w, svg); w.appendChild(svg);
      w.parentNode.insertBefore(el('div', { class: 'scrollhint', 'aria-hidden': 'true', text: 'scroll \u2192' }), w.nextSibling);
    });
  }
  function init() {
    initFigures(); initCopy(); initToc(); initCheckpoints(); initQuiz(); initAgentsOs(); initArch(); initSims();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
