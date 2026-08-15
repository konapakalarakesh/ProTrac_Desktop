/* ============================================================
   WEEKLY HISTORY FEATURE (v3)
   - Separate file. Does NOT edit any existing function.
   - Wraps downloadTextReport() and render() at runtime instead
     of touching their code, so the only change needed in
     index.html is the single <script src="weekly-history.js">
     line that loads this file.
   - Archiving happens on download: the week number typed in
     the existing prompt is reused as the storage key, so
     downloading the same week again just overwrites that entry
     (latest download always wins - no duplicates).
   - Any week can be viewed AND edited, exactly like the live
     week. Editing a past week and downloading it again with the
     same week number updates that entry, same as the live flow.
   - Storage key: 'ops_history_v2' - completely separate from
     the app's own 'ops_vFinal_v4' key, so the live current
     week's saved data is never overwritten by this feature.
   - The week picker sits inline, right beside the existing
     "X's Performance Universe" title - nothing else moves.
   ============================================================ */
(function () {
  const HISTORY_KEY = 'ops_history_v2';
  let liveStateBackup = null;   // real live state, kept safe in memory while browsing history
  let originalSave = null;      // real save(), restored when leaving history view
  let viewingWeek = null;       // null = live, otherwise the week key currently shown

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function saveHistoryStore(obj) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(obj)); }
    catch (e) { console.warn('History save skipped:', e); }
  }

  // Computes the Mon-Fri calendar dates (as ISO strings) for the week containing baseDate.
  function getWeekDatesFrom(baseDate) {
    const d = new Date(baseDate);
    const diffToMonday = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
    const monday = new Date(d);
    monday.setDate(d.getDate() - diffToMonday);
    const out = {};
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach((name, i) => {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      out[name] = dt.toISOString();
    });
    return out;
  }

  // "Aug 10" - short form, used in the Weekly Scope table header and the week picker.
  function fmtShort(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // "10 Aug 2026" - full form, matches the app's own NPH date-pill style and the CSV export.
  function fmtFull(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Saves/overwrites one week's snapshot. Same week number = overwrite, not a duplicate.
  // Keeps only the 2 most recently downloaded weeks - older ones are dropped automatically.
  const MAX_WEEKS_KEPT = 2;

  window.archiveWeek = function (wk, s, baseDate) {
    try {
      if (!s || !s.owner) return;
      const key = String(wk).trim();
      if (!key) return;
      const store = getHistory();
      store[key] = {
        weekNumber: key,
        archivedAt: new Date().toISOString(),
        weekDates: getWeekDatesFrom(baseDate || new Date()),
        owner: s.owner,
        hours: JSON.parse(JSON.stringify(s.hours || {})),
        data: JSON.parse(JSON.stringify(s.data || {})),
        active: JSON.parse(JSON.stringify(s.active || {})),
        reasons: JSON.parse(JSON.stringify(s.reasons || {}))
      };

      // Trim to the most recently downloaded MAX_WEEKS_KEPT entries.
      const keysByRecency = Object.keys(store).sort((a, b) =>
        new Date(store[b].archivedAt) - new Date(store[a].archivedAt)
      );
      keysByRecency.slice(MAX_WEEKS_KEPT).forEach(oldKey => { delete store[oldKey]; });

      saveHistoryStore(store);
      renderWeekPickerOptions();
    } catch (e) {
      console.warn('Archive skipped (non-fatal):', e);
    }
  };

  // Computes the Monday of ISO week `week` in `year` - standard ISO-8601 week-date algorithm.
  // This is how "Week 26" gets its real calendar dates automatically, with no need to ask.
  function mondayOfIsoWeek(week, year) {
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const dow = simple.getUTCDay() || 7; // Sunday=0 -> treat as 7
    simple.setUTCDate(simple.getUTCDate() + (1 - dow)); // roll back/forward to that week's Monday
    return simple;
  }

  // Given whatever the user typed as the week number, work out the real Monday it refers to.
  // Pulls the first number out of the string (so "26", "Week 26", "W26" all work the same),
  // and assumes the current year. Falls back to today if nothing numeric is found.
  function dateForWeekNumber(weekKey) {
    const match = String(weekKey).match(/\d+/);
    if (!match) return new Date();
    const weekNum = parseInt(match[0], 10);
    if (!weekNum || weekNum < 1 || weekNum > 53) return new Date();
    return mondayOfIsoWeek(weekNum, new Date().getFullYear());
  }

  // Wraps the existing downloadTextReport() so it (a) always builds the report from whatever
  // is CURRENTLY on screen - live or an edited archived week - even though save() may be a
  // no-op right now, and (b) archives that data under the week number typed, automatically
  // dating it to that week's real Monday-Friday (via dateForWeekNumber) - no extra prompt.
  function wrapDownload() {
    if (typeof window.downloadTextReport !== 'function' || window.downloadTextReport.__historyWrapped) return;
    const original = window.downloadTextReport;

    const wrapped = function () {
      let capturedWk = null;
      const origPrompt = window.prompt;
      window.prompt = function (...args) {
        const result = origPrompt.apply(window, args);
        if (result !== null) capturedWk = result;
        return result;
      };

      const dates = capturedWk ? getWeekDatesFrom(dateForWeekNumber(capturedWk)) : null;

      // The original function reads localStorage directly. While browsing history, localStorage
      // still holds the LIVE week (save() is intentionally disabled then), so we point it at
      // whatever is actually on screen right now for the duration of this one call only.
      const origGetItem = localStorage.getItem.bind(localStorage);
      localStorage.getItem = function (k) {
        if (k === 'ops_vFinal_v4') return JSON.stringify(state);
        return origGetItem(k);
      };

      // The original function writes plain day labels ("Mon", "Tue"...) into the CSV, which is
      // ambiguous once several weeks exist. We intercept the Blob it builds and turn each label
      // into "Mon - 10 Aug 2026" using the week-number-derived date. capturedWk isn't known until
      // the prompt above resolves, so we resolve `dates` lazily at Blob-build time instead.
      const OrigBlob = window.Blob;
      window.Blob = function (parts, opts) {
        try {
          const d = dates || (capturedWk ? getWeekDatesFrom(dateForWeekNumber(capturedWk)) : null);
          let content = Array.isArray(parts) ? parts.join('') : String(parts);
          if (d) {
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(day => {
              if (!d[day]) return;
              const labelled = day + ' - ' + fmtFull(d[day]);
              content = content.replace(new RegExp('^' + day + ',', 'gm'), labelled + ',');
            });
          }
          return new OrigBlob([content], opts);
        } catch (e) {
          return new OrigBlob(parts, opts);
        }
      };

      try { original.apply(this, arguments); }
      finally {
        window.prompt = origPrompt;
        localStorage.getItem = origGetItem;
        window.Blob = OrigBlob;
      }

      if (capturedWk && capturedWk.trim()) {
        try {
          window.archiveWeek(capturedWk.trim(), JSON.parse(JSON.stringify(state)), dateForWeekNumber(capturedWk));
        } catch (e) { /* ignore */ }
      }
    };
    wrapped.__historyWrapped = true;
    window.downloadTextReport = wrapped;
  }

  // Wraps the existing render() so our picker/dates stay in sync, without editing its code.
  function wrapRender() {
    if (typeof window.render !== 'function' || window.render.__historyWrapped) return;
    const original = window.render;
    const wrapped = function () {
      original.apply(this, arguments);
      try { syncWithSummaryPanel(); } catch (e) { /* ignore */ }
      try { injectTableHeaderDates(); } catch (e) { /* ignore */ }
      try { fixNphDatePill(); } catch (e) { /* ignore */ }
    };
    wrapped.__historyWrapped = true;
    window.render = wrapped;
  }

  // Wraps the app's own updateSmartDate() so the existing NPH date pill reflects whichever
  // week is currently on screen, instead of always computing today's real date.
  function wrapUpdateSmartDate() {
    if (typeof window.updateSmartDate !== 'function' || window.updateSmartDate.__historyWrapped) return;
    const original = window.updateSmartDate;
    const wrapped = function () {
      if (!viewingWeek) { original.apply(this, arguments); return; }
      const el = document.getElementById('auto-date-display');
      if (!el) return;
      const dates = currentWeekDates();
      if (!dates[state.day]) { el.innerText = 'Weekly View'; return; }
      el.innerText = fmtFull(dates[state.day]);
    };
    wrapped.__historyWrapped = true;
    window.updateSmartDate = wrapped;
  }

  // Belt-and-braces: also correct the pill right after any render, in case updateSmartDate()
  // was already called earlier in the same render pass before viewingWeek changed.
  function fixNphDatePill() {
    if (!viewingWeek) return;
    const el = document.getElementById('auto-date-display');
    if (!el) return;
    const dates = currentWeekDates();
    el.innerText = dates[state.day] ? fmtFull(dates[state.day]) : 'Weekly View';
  }

  function currentWeekDates() {
    if (viewingWeek) {
      const snap = getHistory()[viewingWeek];
      if (snap && snap.weekDates) return snap.weekDates;
    }
    return getWeekDatesFrom(new Date());
  }

  // Adds the real calendar date under each M/T/W/T/F column in the Weekly Scope table only
  // (not the day-navigation tabs), so it's clear which real dates a week - live or archived -
  // actually covers.
  function injectTableHeaderDates() {
    const dates = currentWeekDates();
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const head = document.getElementById('st-head');
    if (!head) return;
    const ths = head.querySelectorAll('th');
    dayNames.forEach((name, i) => {
      const th = ths[i + 1]; // index 0 is "PROCESS DETAIL"
      if (!th) return;
      th.innerHTML = name.charAt(0) + '<br><span class="wp-date-sub">' + fmtShort(dates[name]) + '</span>';
    });
  }

  function syncWithSummaryPanel() {
    const summaryUi = document.getElementById('summary-ui');
    if (!summaryUi) return;
    if (!summaryUi.classList.contains('hidden')) ensurePickerUI();
  }

  // Injects a one-time stylesheet for the picker (gradient pill + custom dropdown panel).
  function injectStyles() {
    if (document.getElementById('week-picker-styles')) return;
    const style = document.createElement('style');
    style.id = 'week-picker-styles';
    style.textContent = `
      #week-picker-wrap { position: relative; display: inline-flex; align-items: center; }
      #week-picker-btn {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 9px 16px;
        border-radius: 999px;
        border: none;
        background: linear-gradient(135deg, #FF9900, #FF6A00);
        color: #fff;
        font-weight: 800;
        font-size: 11px;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        cursor: pointer;
        outline: none;
        box-shadow: 0 4px 14px rgba(255,153,0,0.4);
        transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.3s ease;
        animation: weekPickerGlow 1.8s ease-in-out 3;
      }
      #week-picker-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,153,0,0.5); }
      #week-picker-btn.viewing-history { background: linear-gradient(135deg, #6366F1, #4F46E5); box-shadow: 0 4px 14px rgba(79,70,229,0.4); animation: none; }
      #week-picker-btn.viewing-history:hover { box-shadow: 0 6px 20px rgba(79,70,229,0.5); }
      #week-picker-btn .wp-arrow { font-size: 9px; transition: transform 0.2s ease; display: inline-block; }
      #week-picker-btn.open .wp-arrow { transform: rotate(180deg); }
      @keyframes weekPickerGlow {
        0%, 100% { box-shadow: 0 4px 14px rgba(255,153,0,0.4), 0 0 0 0 rgba(255,153,0,0.45); }
        50% { box-shadow: 0 4px 14px rgba(255,153,0,0.4), 0 0 0 9px rgba(255,153,0,0); }
      }
      #week-picker-panel {
        position: absolute; top: calc(100% + 8px); left: 0; min-width: 170px;
        background: var(--card, #fff);
        border: 1px solid var(--border, rgba(0,0,0,0.08));
        border-radius: 14px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.18);
        padding: 6px;
        z-index: 60;
        display: none;
        overflow: hidden;
      }
      #week-picker-panel.open { display: block; }
      .wp-option {
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 700;
        color: var(--text, #1E293B);
        cursor: pointer;
        transition: background 0.15s ease, color 0.15s ease;
        white-space: nowrap;
      }
      .wp-option:hover { background: rgba(255,153,0,0.12); }
      .wp-option.selected { background: linear-gradient(135deg, #FF9900, #FF6A00); color: #fff; }
      #back-to-live-link {
        font-size: 11px; font-weight: 800; color: var(--amz); cursor: pointer;
        padding: 6px 12px; border-radius: 999px; background: rgba(255,153,0,0.12);
        transition: background 0.2s ease;
      }
      #back-to-live-link:hover { background: rgba(255,153,0,0.22); }
      .wp-date-sub { display:block; font-size:9px; font-weight:600; opacity:0.6; margin-top:2px; letter-spacing:0.2px; text-transform:none; }
    `;
    document.head.appendChild(style);
  }

  // Injects a small, sleek dropdown inline right beside the "X's Performance Universe" title.
  // Fully custom-built (not a native <select>) so every part of it - including the open
  // dropdown list - can be styled to match the pill, instead of the browser's flat default list.
  function ensurePickerUI() {
    const titleEl = document.getElementById('summary-title');
    if (!titleEl) return;

    if (document.getElementById('week-picker-row')) { renderWeekPickerOptions(); return; }

    injectStyles();

    const row = document.createElement('div');
    row.id = 'week-picker-row';
    row.style.cssText = 'display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:15px;';
    titleEl.parentNode.insertBefore(row, titleEl);
    row.appendChild(titleEl);
    titleEl.style.marginBottom = '0';

    const wrap = document.createElement('div');
    wrap.id = 'week-picker-wrap';

    const btn = document.createElement('button');
    btn.id = 'week-picker-btn';
    btn.type = 'button';
    btn.innerHTML = '<span id="week-picker-label">This Week</span><span class="wp-arrow">▾</span>';
    btn.onclick = function (e) {
      e.stopPropagation();
      const panel = document.getElementById('week-picker-panel');
      const isOpen = panel.classList.contains('open');
      closePicker();
      if (!isOpen) openPicker();
    };
    wrap.appendChild(btn);

    const panel = document.createElement('div');
    panel.id = 'week-picker-panel';
    wrap.appendChild(panel);

    row.appendChild(wrap);

    const backLink = document.createElement('span');
    backLink.id = 'back-to-live-link';
    backLink.textContent = '← Back to Live';
    backLink.style.display = 'none';
    backLink.onclick = function () { window.exitHistoryView(); };
    row.appendChild(backLink);

    // Close the dropdown when clicking anywhere outside it.
    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) closePicker();
    });

    renderWeekPickerOptions();
  }

  function openPicker() {
    const btn = document.getElementById('week-picker-btn');
    const panel = document.getElementById('week-picker-panel');
    if (btn) btn.classList.add('open');
    if (panel) panel.classList.add('open');
  }

  function closePicker() {
    const btn = document.getElementById('week-picker-btn');
    const panel = document.getElementById('week-picker-panel');
    if (btn) btn.classList.remove('open');
    if (panel) panel.classList.remove('open');
  }

  function selectWeek(value) {
    closePicker();
    if (value === 'live') window.exitHistoryView();
    else window.enterHistoryView(value);
  }

  function renderWeekPickerOptions() {
    const panel = document.getElementById('week-picker-panel');
    const label = document.getElementById('week-picker-label');
    if (!panel || !label) return;

    const store = getHistory();
    const weeks = Object.keys(store).sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return nb - na;
      return b.localeCompare(a);
    });

    const current = viewingWeek || 'live';
    const liveDates = getWeekDatesFrom(new Date());
    const options = [{ value: 'live', text: 'This Week', sub: fmtShort(liveDates.Mon) + ' – ' + fmtShort(liveDates.Fri) }].concat(
      weeks.map(w => {
        const snap = store[w];
        const sub = snap && snap.weekDates ? (fmtShort(snap.weekDates.Mon) + ' – ' + fmtShort(snap.weekDates.Fri)) : '';
        return { value: w, text: 'Week ' + w, sub };
      })
    );

    panel.innerHTML = '';
    options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'wp-option' + (opt.value === current ? ' selected' : '');
      item.innerHTML = opt.text + (opt.sub ? '<br><span class="wp-date-sub" style="opacity:0.8;">' + opt.sub + '</span>' : '');
      item.onclick = function () { selectWeek(opt.value); };
      panel.appendChild(item);
    });

    const selected = options.find(o => o.value === current);
    label.textContent = selected ? selected.text : 'This Week';
  }

  function showViewingIndicator(weekKey) {
    const btn = document.getElementById('week-picker-btn');
    const link = document.getElementById('back-to-live-link');
    if (btn) btn.classList.add('viewing-history');
    if (link) link.style.display = 'inline';
  }

  function hideViewingIndicator() {
    const btn = document.getElementById('week-picker-btn');
    const link = document.getElementById('back-to-live-link');
    if (btn) btn.classList.remove('viewing-history');
    if (link) link.style.display = 'none';
  }

  // Swaps the whole dashboard into an archived week, reusing the app's own init()/render().
  // Fully editable - identical to the live week - since save() is only muted, not the UI.
  window.enterHistoryView = function (weekKey) {
    const store = getHistory();
    const snap = store[weekKey];
    if (!snap) { alert('No saved data found for week ' + weekKey); return; }

    if (!liveStateBackup) liveStateBackup = state; // keep the real live state safe in memory

    state = {
      owner: snap.owner || liveStateBackup.owner,
      day: 'Weekly Scope',
      darkMode: liveStateBackup.darkMode,
      lastProd: 0,
      active: snap.active,
      data: snap.data,
      reasons: snap.reasons,
      hours: snap.hours
    };

    if (!originalSave) originalSave = window.save;
    window.save = function () { /* no-op: never persist over your live week while browsing history */ };

    viewingWeek = weekKey;
    init();
    showViewingIndicator(weekKey);
    renderWeekPickerOptions();
  };

  window.exitHistoryView = function () {
    if (liveStateBackup) { state = liveStateBackup; liveStateBackup = null; }
    if (originalSave) { window.save = originalSave; originalSave = null; }
    viewingWeek = null;
    init();
    hideViewingIndicator();
    renderWeekPickerOptions();
  };

  function boot() {
    wrapDownload();
    wrapRender();
    wrapUpdateSmartDate();
    syncWithSummaryPanel(); // in case Weekly Scope tab is already open when this loads
  }

  boot();
})();
