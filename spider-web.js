/* ============================================================================
   spider-web.js
   Self-contained "Spider Web" theme add-on for the dashboard.

   TO INSTALL: add exactly one line to index.html, right before </body>:
     <script src="spider-web.js"></script>

   TO REMOVE LATER: delete this file from GitHub (and that one line, though
   even leaving the line in is harmless — the browser just won't find the
   file and the rest of the dashboard works exactly as before).

   This file does NOT require any other edits to index.html. It finds what
   it needs (the truck icon, the header, the productivity numbers, dark-mode
   state) purely by looking at the page's existing DOM/CSS, so it stays
   decoupled from the rest of the app's internals.
============================================================================ */
(function () {
  "use strict";

  /* ---------- 1. Inject the header icon (next to the truck icon) ---------- */
  var MENU_HTML =
    '<div id="spider-menu" style="position:relative;display:inline-block;padding-left:10px;border-left:1px solid rgba(255,255,255,0.2);margin-left:10px;">' +
      '<div onclick="document.getElementById(\'spider-panel\').classList.toggle(\'show\')" title="Spider Web Settings" style="cursor:pointer;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;background:linear-gradient(135deg,#ff9900,#e0102a);box-shadow:0 0 8px rgba(224,16,42,.55);">🕷️</div>' +
      '<div id="spider-panel" style="display:none;position:absolute;top:30px;right:-10px;background:var(--card,#1a1a2e);border:1px solid rgba(255,153,0,.2);border-radius:10px;padding:10px 14px;z-index:999;box-shadow:0 4px 16px rgba(0,0,0,.3);white-space:nowrap;">' +
        '<div onclick="toggleWebVis()" style="cursor:pointer;padding:4px 0;font-size:12px;color:var(--text,#fff);"><span id="w-icon">🕷️</span> <span id="w-label">Spider ON</span></div>' +
        '<div onclick="toggleWebSnd()" style="cursor:pointer;padding:4px 0;font-size:12px;color:var(--text,#fff);margin-top:4px;border-top:1px solid rgba(255,255,255,.06);padding-top:8px;"><span id="ws-icon">🔊</span> <span id="ws-label">Sound ON</span></div>' +
      '</div>' +
    '</div>' +
    '<style>#spider-panel.show{display:block!important}</style>';

  var truckMenu = document.getElementById('truck-menu');
  if (truckMenu) {
    truckMenu.insertAdjacentHTML('afterend', MENU_HTML);
  } else {
    var header = document.querySelector('header');
    (header || document.body).insertAdjacentHTML('beforeend', MENU_HTML);
  }

  /* ---------- 2. Inject the full-screen iframe + background song ---------- */
  var OVERLAY_HTML =
    '<div style="position:fixed;inset:0;z-index:45;pointer-events:none;">' +
      '<iframe id="spider-frame" src="theme-realweb.html" style="width:100%;height:100%;border:none;pointer-events:none;"></iframe>' +
    '</div>' +
    /* SPIDER_AUDIO: swap this filename for whatever you named your mp3 on GitHub */
    '<audio id="a-theme" src="spiderman-theme.mp3" loop preload="auto"></audio>';

  document.body.insertAdjacentHTML('beforeend', OVERLAY_HTML);

  var spiderFrameEl = document.getElementById('spider-frame');

  /* ---------- 3. Persisted on/off state (survives refresh) ---------- */
  function readBool(key, def) {
    var v = localStorage.getItem(key);
    return v === null ? def : (v === '1');
  }
  var _webOn = readBool('spiderWebOn', true);
  var _webSndOn = readBool('spiderSoundOn', true);

  function updateSpiderUI() {
    var wi = document.getElementById('w-icon'), wl = document.getElementById('w-label');
    var si = document.getElementById('ws-icon'), sl = document.getElementById('ws-label');
    if (wi) wi.textContent = _webOn ? '🕷️' : '⏹️';
    if (wl) wl.textContent = _webOn ? 'Spider ON' : 'Spider OFF';
    if (si) si.textContent = _webSndOn ? '🔊' : '🔇';
    if (sl) sl.textContent = _webSndOn ? 'Sound ON' : 'Sound OFF';
  }
  updateSpiderUI(); // reflect the saved state immediately, before any click

  /* toggle functions must be global — the injected HTML calls them via onclick="" */
  window.toggleWebVis = function () {
    _webOn = !_webOn;
    localStorage.setItem('spiderWebOn', _webOn ? '1' : '0');
    updateSpiderUI();
    if (spiderFrameEl && spiderFrameEl.contentWindow) {
      spiderFrameEl.contentWindow.postMessage({ cmd: 'toggleTruck', value: _webOn }, '*');
    }
    updateThemeSong();
  };

  window.toggleWebSnd = function () {
    _webSndOn = !_webSndOn;
    localStorage.setItem('spiderSoundOn', _webSndOn ? '1' : '0');
    updateSpiderUI();
    if (spiderFrameEl && spiderFrameEl.contentWindow) {
      spiderFrameEl.contentWindow.postMessage({ cmd: 'toggleSound', value: _webSndOn }, '*');
    }
    updateThemeSong();
  };

  document.addEventListener('click', function (e) {
    var panel = document.getElementById('spider-panel');
    var menu = document.getElementById('spider-menu');
    if (panel && menu && !menu.contains(e.target)) panel.classList.remove('show');
  });

  /* ---------- 4. Theme song: smooth fade in/out, real autoplay permission ---------- */
  var THEME_VOL = 0.35, _themeFadeTimer = null;

  function fadeAudio(el, from, to, ms, onDone) {
    clearInterval(_themeFadeTimer);
    var steps = Math.max(1, Math.round(ms / 50)), stepMs = ms / steps, i = 0;
    _themeFadeTimer = setInterval(function () {
      i++;
      el.volume = Math.min(1, Math.max(0, from + (to - from) * (i / steps)));
      if (i >= steps) { clearInterval(_themeFadeTimer); _themeFadeTimer = null; if (onDone) onDone(); }
    }, stepMs);
  }

  function updateThemeSong() {
    var el = document.getElementById('a-theme');
    if (!el) return;
    var shouldPlay = _webOn && _webSndOn && !document.hidden;
    if (shouldPlay) {
      if (el.paused) {
        el.volume = 0;
        el.play().then(function () {
          fadeAudio(el, 0, THEME_VOL, 1200);
        }).catch(function () {
          // Blocked (no gesture yet) — the listeners below retry on the very next
          // click/key/touch anywhere on the page, so it starts instantly then.
        });
      } else if (el.volume < THEME_VOL) {
        fadeAudio(el, el.volume, THEME_VOL, 800);
      }
    } else {
      if (!el.paused) fadeAudio(el, el.volume, 0, 500, function () { el.pause(); });
    }
  }
  updateThemeSong();
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
    document.addEventListener(evt, updateThemeSong, { passive: true });
  });
  document.addEventListener('visibilitychange', updateThemeSong);

  /* ---------- 5. Dark/light sync — watches the body class, no app-code edits needed ---------- */
  function isDark() { return document.body.classList.contains('dark-mode'); }

  function sendSpiderMode() {
    if (spiderFrameEl && spiderFrameEl.contentWindow) {
      spiderFrameEl.contentWindow.postMessage({ cmd: 'setColorMode', value: isDark() ? 'dark' : 'light' }, '*');
    }
  }
  new MutationObserver(sendSpiderMode).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* ---------- 6. Header/chip height, so the intro image always clears whatever's on screen ---------- */
  function computeHeaderOffset() {
    var header = document.querySelector('header');
    var sel = document.getElementById('sel-area');
    var headerBottom = header ? header.getBoundingClientRect().bottom : 60;
    var selVisible = sel && !sel.classList.contains('hidden') && sel.offsetParent !== null;
    var selBottom = selVisible ? sel.getBoundingClientRect().bottom : headerBottom;
    return Math.max(headerBottom, selBottom) + 20;
  }

  /* ---------- 7. Push the restored state into the iframe the moment it's ready ---------- */
  if (spiderFrameEl) {
    spiderFrameEl.addEventListener('load', function () {
      var f = spiderFrameEl.contentWindow;
      if (!f) return;

      // Safety net: if theme-realweb.html 404'd (wrong path/filename case on GitHub),
      // the iframe silently loads GitHub's own error page instead — which has a solid
      // background and would otherwise blank out the entire dashboard underneath it.
      // Confirm our actual theme content is there before trusting the overlay.
      var loadedOk = false;
      try {
        loadedOk = !!(spiderFrameEl.contentDocument && spiderFrameEl.contentDocument.getElementById('stage'));
      } catch (err) { /* cross-origin — assume ok, browser already enforces same-origin here */ loadedOk = true; }

      if (!loadedOk) {
        console.warn('[spider-web] theme-realweb.html did not load correctly (check the file exists at the same path/case as index.html on GitHub) — hiding the overlay so it does not block the dashboard.');
        var overlay = spiderFrameEl.parentElement;
        if (overlay) overlay.style.display = 'none';
        return;
      }

      f.postMessage({ cmd: 'toggleTruck', value: _webOn }, '*');
      f.postMessage({ cmd: 'toggleSound', value: _webSndOn }, '*');
      f.postMessage({ cmd: 'setColorMode', value: isDark() ? 'dark' : 'light' }, '*');
      f.postMessage({ cmd: 'headerOffset', value: computeHeaderOffset() }, '*');
    });
  }

  /* ---------- 8. Keep the web-frame glued to whichever productivity number is on screen ---------- */
  setInterval(function () {
    var summaryUi = document.getElementById('summary-ui');
    var onWeekly = summaryUi && !summaryUi.classList.contains('hidden');
    var activeProdEl = document.getElementById(onWeekly ? 'week-prod-out' : 'prod-out');
    var p = parseInt((activeProdEl && activeProdEl.textContent) || '0') || 0;

    if (spiderFrameEl && spiderFrameEl.contentWindow) {
      var f = spiderFrameEl.contentWindow;
      f.postMessage(p, '*');
      f.postMessage({ cmd: 'setColorMode', value: isDark() ? 'dark' : 'light' }, '*');
      f.postMessage({ cmd: 'headerOffset', value: computeHeaderOffset() }, '*');
      if (activeProdEl) {
        var r = activeProdEl.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          f.postMessage({ cmd: 'prodRect', rect: { left: r.left, top: r.top, width: r.width, height: r.height } }, '*');
        }
      }
    }
  }, 100);
})();
