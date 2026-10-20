/* ============================================================================
   jailer-theme.js  ·  JAILER 2 theme add-on  (works exactly like spider-web.js)

   INSTALL : keep this line in index.html, AFTER spider-web.js, before </body>
               <script src="jailer-theme.js"></script>
   FILES   : put these next to index.html (names are case-sensitive on GitHub)
               jailer-thalaivar.png   <- your picture (transparent PNG looks best)
               jailer-theme.mp3       <- theme music
   REMOVE  : delete this file. Nothing else in the app depends on it.

   It never edits your HTML/JS. It only:
     - adds a class "jailer" on <body> (all styling is scoped to body.jailer)
     - adds two fixed background layers behind everything (picture + stars)
     - adds a 🐯 icon in the header, next to the 🕷️
   ============================================================================ */
(function () {
  'use strict';

  /* ---------- CONFIG ---------- */
  var IMAGE_SRC  = 'jailer-thalaivar.png';   /* your picture, shown static below the chips */
  var AUDIO_SRC  = 'jailer-theme.mp3';
  var MAX_VOLUME = 0.4;

  var K_THEME  = 'jailer_theme_on';
  var K_MUSIC  = 'jailer_music_on';
  var K_SPIDER = 'jailer_paused_spider';
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var body = document.body;
  var isOn = function () { return body.classList.contains('jailer'); };
  var isDark = function () { return body.classList.contains('dark-mode'); };

  /* ---------- 1. STYLES (everything scoped to body.jailer) ---------- */
  var css = '' +
  /* LIGHT mode palette: warm cream + tiger gold + crimson */
  'body.jailer{--amz:#D4920A;--bg:#FBF8EF;--card:rgba(255,253,248,.66);--text:#1C1608;' +
    '--border:rgba(180,125,10,.25);--slate:#7A6B4A;--dot:rgba(190,130,10,.30);--jl-red:#C1121F}' +
  /* DARK mode palette: near-black + tiger gold + crimson */
  'body.jailer.dark-mode{--amz:#F5B301;--bg:#08080B;--card:rgba(16,13,8,.64);--text:#F6F0E0;' +
    '--border:rgba(245,179,1,.20);--slate:#A9A292;--dot:rgba(245,179,1,.14)}' +

  /* replace the blue aurora with a gold/crimson one */
  'body.jailer::before{background:' +
    'radial-gradient(circle at 15% 15%,rgba(245,179,1,.12) 0%,transparent 40%),' +
    'radial-gradient(circle at 85% 85%,rgba(193,18,31,.12) 0%,transparent 40%)}' +

  /* header: always black-gold, with a slow gold shine line */
  'body.jailer header{background:linear-gradient(90deg,#08080b,#17120a 50%,#08080b);border-bottom:2px solid var(--amz)}' +
  'body.jailer header::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:2px;pointer-events:none;' +
    'background:linear-gradient(90deg,transparent,#fff3bf,transparent) no-repeat;background-size:28% 100%;' +
    'animation:jl-shine 5s linear infinite}' +
  '@keyframes jl-shine{from{background-position:-40% 0}to{background-position:140% 0}}' +

  /* small accents only */
  'body.jailer .tab.active{background:linear-gradient(135deg,#F5B301,#FFD966)!important;color:#1a1200!important}' +
  'body.jailer .chip.a-active{background:#F5B301;border-color:#F5B301;color:#1a1200}' +
  'body.jailer .chip.v-active{background:var(--jl-red);border-color:var(--jl-red);color:#fff}' +
  'body.jailer .card,body.jailer .magic-score{transition:border-color .3s}' +
  'body.jailer .card:hover{border-color:var(--amz)}' +
  'body.jailer.dark-mode .prod-val{text-shadow:0 0 28px rgba(245,179,1,.30)}' +

  /* background layers (behind all content, never clickable) */
  '#jl-fx{position:fixed;inset:0;z-index:-1;pointer-events:none;display:none;overflow:hidden}' +
  'body.jailer #jl-fx{display:block}' +
  '#jl-fx canvas{position:absolute;inset:0;width:100%;height:100%}' +

  /* Picture: sits BELOW the audit/verification chips, face to feet fully visible.
     The top edge glides (transition) so the size never jumps when you change tabs. */
  '#jl-hero{position:absolute;left:50%;top:300px;bottom:10px;width:min(72vw,760px);transform:translateX(-50%)}' +
  '#jl-hero.jl-ready{transition:top .8s cubic-bezier(.22,.61,.36,1)}' +
  '#jl-hero img{width:100%;height:100%;display:block;object-fit:contain;object-position:center bottom}' +
  '#jl-hero img.jl-missing{display:none}' +
  'body.jailer.dark-mode #jl-hero img{opacity:.42}' +
  'body.jailer:not(.dark-mode) #jl-hero img{opacity:.38}' +
  /* screen-size tuning: laptop = tighter + fills to the bottom edge, big desktop = roomier + larger */
  '@media (max-width:1500px),(max-height:800px){#jl-hero{bottom:0;width:min(78vw,620px)}}' +
  '@media (min-width:1900px) and (min-height:900px){#jl-hero{bottom:24px;width:min(60vw,980px)}}' +

  /* tiny intro: black fade + gold title, click to skip */
  '#jl-intro{position:fixed;inset:0;z-index:60000;background:#000;display:flex;align-items:center;justify-content:center;' +
    'flex-direction:column;cursor:pointer;opacity:1;transition:opacity .6s}' +
  '#jl-intro.out{opacity:0;pointer-events:none}' +
  '#jl-intro h1{margin:0;font:900 clamp(40px,10vw,100px) Montserrat,sans-serif;letter-spacing:.16em;padding-left:.16em;' +
    'background:linear-gradient(100deg,#8a6200 20%,#FFE08A 45%,#fff 50%,#FFE08A 55%,#8a6200 80%) 100% 0/250% 100%;' +
    '-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 24px rgba(245,179,1,.4));' +
    'animation:jl-title 1.6s ease-out both}' +
  '#jl-intro h1 b{-webkit-text-fill-color:#E01A2B}' +
  '#jl-intro small{margin-top:12px;font:600 12px "Plus Jakarta Sans",sans-serif;letter-spacing:.5em;color:#cdbf95;opacity:0;animation:jl-fade 1s .7s forwards}' +
  /* credit line: clean, upright, thin gold rule above it */
  '#jl-intro em{margin-top:30px;padding-top:16px;padding-left:.4em;font:500 12px Montserrat,"Plus Jakarta Sans",sans-serif;font-style:normal;' +
    'letter-spacing:.4em;text-transform:uppercase;color:#E3B84A;opacity:0;animation:jl-fade 1.2s 1.3s forwards;' +
    'position:relative}' +
  '#jl-intro em::before{content:"";position:absolute;top:0;left:50%;width:46px;height:1px;margin-left:-23px;background:#E3B84A;opacity:.7}' +
  '@keyframes jl-title{from{opacity:0;letter-spacing:.5em;background-position:100% 0}to{opacity:1;letter-spacing:.16em;background-position:0 0}}' +
  '@keyframes jl-fade{to{opacity:1}}' +

  '@media (prefers-reduced-motion:reduce){body.jailer header::after{animation:none}}' +

  /* header menu bits */
  '#jl-panel.show{display:block!important}#jl-icon-btn:hover{transform:scale(1.12)}' +
  'body.jailer #jl-icon-btn{box-shadow:0 0 0 2px rgba(245,179,1,.45)}';

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- 2. BACKGROUND LAYERS: picture below chips + stars/dots ---------- */
  var fx = document.createElement('div');
  fx.id = 'jl-fx';
  fx.innerHTML = '<div id="jl-hero"><img alt="" src="' + IMAGE_SRC + '"></div><canvas></canvas>';
  body.appendChild(fx);

  var heroImg = fx.querySelector('#jl-hero img');
  heroImg.addEventListener('error', function () {
    heroImg.classList.add('jl-missing');
    console.warn('[jailer-theme] "' + IMAGE_SRC + '" not found. Put it next to index.html (same name and letter case).');
  });

  /* Keep the picture just below the chips (auto-detects the chips' bottom edge).
     Smooth on tab change: positions are in page coordinates, the last position is kept
     when the chips are hidden (Weekly tabs), a new position must be seen twice in a row,
     and real changes glide with a CSS transition instead of jumping. */
  var heroBox = fx.querySelector('#jl-hero');
  var heroTop = -1, pendingTop = -1;

  function chipsBottom() {
    var bottom = 0, seen = false, chips = document.querySelectorAll('.chip');
    var sy = window.pageYOffset || 0;
    for (var i = 0; i < chips.length; i++) {
      var r = chips[i].getBoundingClientRect();
      if (r.height > 0 && r.width > 0 && (r.top + sy) < innerHeight * 0.6) {
        bottom = Math.max(bottom, r.bottom + sy);
        seen = true;
      }
    }
    return seen ? bottom : null;
  }

  function placeHero(immediate) {
    var t = chipsBottom();
    if (t === null) {
      if (heroTop >= 0) return;                       /* chips hidden: stay where we are */
      var h = document.querySelector('header');
      t = h ? h.getBoundingClientRect().bottom + (window.pageYOffset || 0) : 0;
    }
    var laptop = innerWidth <= 1500 || innerHeight <= 800;      /* laptop screens */
    var big    = innerWidth >= 1900 && innerHeight >= 900;      /* large desktop monitors */
    var gap    = big ? 24 : (laptop ? 8 : 16);                  /* space between chips and picture */
    var maxTop = innerHeight * (laptop ? 0.55 : 0.6);           /* always leave enough height to show him */
    t = Math.round(Math.min(Math.max(t + gap, 0), maxTop));
    if (heroTop >= 0 && Math.abs(t - heroTop) < 8) { pendingTop = -1; return; }
    if (!immediate && heroTop >= 0) {
      if (Math.abs(t - pendingTop) > 2) { pendingTop = t; return; }
    }
    pendingTop = -1;
    heroTop = t;
    heroBox.style.top = t + 'px';
    if (!heroBox.classList.contains('jl-ready')) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { heroBox.classList.add('jl-ready'); }); });
    }
  }
  addEventListener('resize', function () { placeHero(true); });
  addEventListener('load', function () { placeHero(true); });
  setInterval(function () { if (isOn()) placeHero(false); }, 350);
  placeHero(true);

  var canvas = fx.querySelector('canvas'), g = canvas.getContext('2d');
  var stars = [], raf = 0, W = 0, H = 0, D = 1;

  function makeStar(anywhere) {
    var sparkle = Math.random() < 0.18;               /* 18% are 4-point sparkles, rest are dots */
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 10,
      r: (sparkle ? Math.random() * 2.2 + 2 : Math.random() * 1.4 + .5) * D,
      v: (Math.random() * .25 + .06) * D,             /* slow upward drift */
      p: Math.random() * 6.28,                        /* twinkle phase */
      s: Math.random() * .03 + .012,                  /* twinkle speed */
      sparkle: sparkle
    };
  }
  function sizeCanvas() {
    D = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.width = innerWidth * D;
    H = canvas.height = innerHeight * D;
    var n = Math.max(24, Math.min(70, Math.round(innerWidth / 24)));
    stars = [];
    for (var i = 0; i < n; i++) stars.push(makeStar(true));
  }
  function drawStar(s, a, rgb) {
    g.fillStyle = 'rgba(' + rgb + ',' + a + ')';
    if (s.sparkle) {
      var r = s.r * (0.8 + 0.4 * Math.sin(s.p));
      g.strokeStyle = 'rgba(' + rgb + ',' + a + ')';
      g.lineWidth = Math.max(1, D * .9);
      g.beginPath();
      g.moveTo(s.x - r * 2, s.y); g.lineTo(s.x + r * 2, s.y);
      g.moveTo(s.x, s.y - r * 2); g.lineTo(s.x, s.y + r * 2);
      g.stroke();
    }
    g.beginPath(); g.arc(s.x, s.y, s.r * (s.sparkle ? .45 : 1), 0, 6.283); g.fill();
  }
  function frame(animate) {
    g.clearRect(0, 0, W, H);
    var dark = isDark();
    g.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    var rgb = dark ? '255,205,80' : '176,112,6';
    var peak = dark ? .9 : .55;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      if (animate) {
        s.y -= s.v; s.p += s.s;
        if (s.y < -10) { stars[i] = s = makeStar(false); }
      }
      drawStar(s, peak * (.25 + .75 * (.5 + .5 * Math.sin(s.p))), rgb);
    }
  }
  function loop() { frame(true); raf = requestAnimationFrame(loop); }
  function startFx() {
    if (raf) return;
    sizeCanvas();
    if (reduceMotion) { frame(false); raf = -1; return; }
    raf = requestAnimationFrame(loop);
  }
  function stopFx() {
    if (raf > 0) cancelAnimationFrame(raf);
    raf = 0; g.clearRect(0, 0, W, H);
  }
  addEventListener('resize', function () { if (raf) { sizeCanvas(); if (raf === -1) frame(false); } });
  document.addEventListener('visibilitychange', function () {
    if (!isOn() || reduceMotion) return;
    if (document.hidden) stopFx(); else startFx();
  });
  /* repaint static stars if the user flips dark/light in reduced-motion mode */
  new MutationObserver(function () { if (raf === -1) frame(false); })
    .observe(body, { attributes: true, attributeFilter: ['class'] });

  /* ---------- 3. MUSIC (fade in/out, retries on first click like spider-web.js) ---------- */
  var audio = new Audio(AUDIO_SRC);
  audio.loop = true; audio.preload = 'auto'; audio.volume = 0;
  var musicOn = localStorage.getItem(K_MUSIC) !== '0';
  var fadeId = 0;

  function fadeTo(target, done) {
    clearInterval(fadeId);
    fadeId = setInterval(function () {
      var step = .03, v = audio.volume;
      audio.volume = Math.max(0, Math.min(1, v + (target > v ? step : -step)));
      if (Math.abs(audio.volume - target) < step) {
        audio.volume = target; clearInterval(fadeId);
        if (done) done();
      }
    }, 60);
  }
  function shouldPlay() { return isOn() && musicOn && !document.hidden; }
  function syncMusic() {
    if (shouldPlay()) {
      if (audio.paused) {
        audio.volume = 0;
        var p = audio.play();
        if (p && p.then) p.then(function () { fadeTo(MAX_VOLUME); }).catch(function () { /* waits for next click/key/touch */ });
      } else if (audio.volume < MAX_VOLUME) fadeTo(MAX_VOLUME);
    } else if (!audio.paused) {
      fadeTo(0, function () { audio.pause(); });
    }
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (e) {
    document.addEventListener(e, function () { if (shouldPlay() && audio.paused) syncMusic(); }, { passive: true });
  });
  document.addEventListener('visibilitychange', syncMusic);

  /* ---------- 4. TINY INTRO (only when you switch it on by hand) ---------- */
  function playIntro() {
    if (reduceMotion) return;
    var el = document.createElement('div');
    el.id = 'jl-intro';
    el.innerHTML = '<h1>JAILER <b>2</b></h1><small>TIGER MUTHUVEL PANDIAN</small><em>A Rakesh Konapakala creation</em>';
    body.appendChild(el);
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      el.classList.add('out'); setTimeout(function () { el.remove(); }, 800);
    }
    setTimeout(close, 3200);
    el.onclick = close;
  }

  /* ---------- 5. ON / OFF  (mutually exclusive with the Spider theme) ---------- */
  var spiderOn = function () { return localStorage.getItem('spiderWebOn') !== '0'; };

  function pauseSpider() {
    if (typeof window.toggleWebVis === 'function' && spiderOn()) {
      window.toggleWebVis();                    /* spider-web.js switches itself off */
      localStorage.setItem(K_SPIDER, '1');      /* remember to bring it back */
    }
  }
  function resumeSpider() {
    if (localStorage.getItem(K_SPIDER) !== '1') return;
    localStorage.removeItem(K_SPIDER);
    if (typeof window.toggleWebVis === 'function' && !spiderOn()) window.toggleWebVis();
  }

  function on(withIntro) {
    body.classList.add('jailer');
    localStorage.setItem(K_THEME, '1');
    pauseSpider(); startFx(); syncMusic(); placeHero(true);
    if (withIntro !== false) playIntro();
    refreshMenu();
  }
  function off(keepSpiderOff) {
    body.classList.remove('jailer');
    localStorage.setItem(K_THEME, '0');
    stopFx(); syncMusic();
    if (keepSpiderOff !== true) resumeSpider();
    refreshMenu();
  }
  function toggle() { isOn() ? off() : on(); }
  function setMusic(v) {
    musicOn = v; localStorage.setItem(K_MUSIC, v ? '1' : '0');
    syncMusic(); refreshMenu();
  }
  window.JailerTheme = { on: on, off: off, toggle: toggle };

  /* If the user switches Spider ON while Jailer is active, Jailer steps aside */
  if (typeof window.toggleWebVis === 'function') {
    var spiderToggle = window.toggleWebVis;
    window.toggleWebVis = function () {
      var r = spiderToggle.apply(this, arguments);
      if (spiderOn() && isOn()) { localStorage.removeItem(K_SPIDER); off(true); }
      return r;
    };
  }

  /* ---------- 6. HEADER ICON (next to 🕷️, same look) ---------- */
  var menuHTML =
    '<div id="jl-menu" style="position:relative;display:inline-block;padding-left:10px;border-left:1px solid rgba(255,255,255,0.2);margin-left:10px;">' +
      '<div id="jl-icon-btn" title="Jailer 2 Theme" style="cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;background:linear-gradient(135deg,#F5B301,#C1121F);border:1.5px solid rgba(255,255,255,.65);transition:transform .15s ease,box-shadow .3s;">🐯</div>' +
      '<div id="jl-panel" style="display:none;position:absolute;top:34px;right:-10px;background:var(--card,#1a1a2e);border:1px solid rgba(245,179,1,.25);border-radius:10px;padding:10px 14px;z-index:999;box-shadow:0 4px 16px rgba(0,0,0,.3);white-space:nowrap;">' +
        '<div id="jl-row-theme" style="cursor:pointer;padding:4px 0;font-size:12px;color:var(--text,#fff);"></div>' +
        '<div id="jl-row-music" style="cursor:pointer;margin-top:4px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06);font-size:12px;color:var(--text,#fff);"></div>' +
      '</div>' +
    '</div>';

  var anchor = document.getElementById('spider-menu') || document.getElementById('truck-menu');
  if (anchor) anchor.insertAdjacentHTML('afterend', menuHTML);
  else (document.querySelector('header') || body).insertAdjacentHTML('beforeend', menuHTML);

  var menu = document.getElementById('jl-menu'),
      panel = document.getElementById('jl-panel'),
      themeRow = document.getElementById('jl-row-theme'),
      musicRow = document.getElementById('jl-row-music');
  document.getElementById('jl-icon-btn').onclick = function () { panel.classList.toggle('show'); };
  themeRow.onclick = toggle;
  musicRow.onclick = function () { setMusic(!musicOn); };
  document.addEventListener('click', function (e) {
    if (!menu.contains(e.target)) panel.classList.remove('show');
  });

  function refreshMenu() {
    themeRow.textContent = isOn() ? '🐯 Jailer 2 ON' : '🐯 Jailer 2 OFF';
    musicRow.textContent = musicOn ? '🔊 Music ON' : '🔇 Music OFF';
  }
  refreshMenu();

  /* ---------- 7. RESTORE LAST CHOICE (no intro on refresh) ---------- */
  if (localStorage.getItem(K_THEME) === '1') on(false);
})();
