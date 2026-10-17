'use strict';

/* ---------- Speicher ---------- */

const STORAGE_KEY = 'weight-entries-v1';
const DAY = 86400000;

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isValidEntry) : [];
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function isValidEntry(e) {
  return e && typeof e.weight === 'number' && isFinite(e.weight)
    && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && /^\d{2}:\d{2}$/.test(e.time);
}

let entries = loadEntries();

// Bittet iOS, die Daten nicht automatisch zu löschen.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

/* ---------- Hilfsfunktionen ---------- */

const $ = (sel) => document.querySelector(sel);
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtKg = (n, d = 1) => n.toLocaleString('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDelta = (n) => (n > 0 ? '+' : n < 0 ? '−' : '±') + fmtKg(Math.abs(n));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function ts(e) {
  const [y, m, d] = e.date.split('-').map(Number);
  const [h, min] = e.time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime();
}
function fmtDate(dateStr, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('de-CH', opts);
}
function sorted() {
  return [...entries].sort((a, b) => ts(a) - ts(b));
}
function parseWeight(str) {
  const n = parseFloat(String(str).trim().replace(',', '.'));
  return isFinite(n) ? Math.round(n * 10) / 10 : NaN;
}

/* ---------- Navigation ---------- */

const TITLES = { add: 'Eintragen', list: 'Liste', stats: 'Statistik', data: 'Daten' };
let currentView = 'add';

function showView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  $('#view-title').textContent = TITLES[name];
  window.scrollTo(0, 0);
  render();
}
document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

/* ---------- Eintragen ---------- */

let editingId = null;

function resetForm() {
  editingId = null;
  $('#entry-form').reset();
  $('#in-date').value = todayStr();
  $('#in-time').value = nowTime();
  $('#btn-save').textContent = 'Speichern';
  $('#btn-cancel-edit').hidden = true;
  $('#form-error').hidden = true;
}

$('#entry-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const weight = parseWeight($('#in-weight').value);
  const date = $('#in-date').value;
  const time = $('#in-time').value.slice(0, 5);
  const note = $('#in-note').value.trim();
  const err = $('#form-error');

  if (!(weight >= 20 && weight <= 400)) {
    err.textContent = 'Bitte ein gültiges Gewicht zwischen 20 und 400 kg eingeben.';
    err.hidden = false;
    return;
  }
  if (!date || !time) {
    err.textContent = 'Bitte Datum und Uhrzeit angeben.';
    err.hidden = false;
    return;
  }

  if (editingId) {
    const e = entries.find((x) => x.id === editingId);
    if (e) Object.assign(e, { weight, date, time, note, updatedAt: new Date().toISOString() });
  } else {
    entries.push({ id: uid(), weight, date, time, note, createdAt: new Date().toISOString() });
  }
  saveEntries();
  const wasEditing = !!editingId;
  resetForm();
  $('#in-weight').blur();
  if (wasEditing) showView('list');
  else render();
});

$('#btn-cancel-edit').addEventListener('click', () => { resetForm(); showView('list'); });

function startEdit(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  showView('add');
  editingId = id;
  $('#in-weight').value = fmtKg(e.weight);
  $('#in-date').value = e.date;
  $('#in-time').value = e.time;
  $('#in-note').value = e.note || '';
  $('#btn-save').textContent = 'Änderung speichern';
  $('#btn-cancel-edit').hidden = false;
}

function renderSummary() {
  const list = sorted();
  const box = $('#today-summary');
  if (!list.length) { box.innerHTML = ''; return; }
  const last = list[list.length - 1];
  const prev = list.length > 1 ? list[list.length - 2] : null;
  box.innerHTML = `
    <div><div class="label">Letzter Eintrag</div><div class="value">${fmtKg(last.weight)} kg</div>
      <div class="label">${esc(fmtDate(last.date, { day: 'numeric', month: 'short' }))}, ${last.time}</div></div>
    <div><div class="label">Zum vorherigen</div><div class="value">${prev ? fmtDelta(last.weight - prev.weight) + ' kg' : '–'}</div>
      <div class="label">${list.length} Einträge total</div></div>`;
}

/* ---------- Liste ---------- */

const ICON_EDIT = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>';
const ICON_DEL = '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

function renderList() {
  const asc = sorted();
  const prevById = {};
  asc.forEach((e, i) => { prevById[e.id] = i > 0 ? asc[i - 1] : null; });
  const list = asc.reverse();
  $('#list-empty').hidden = list.length > 0;

  let html = '';
  let lastMonth = '';
  for (const e of list) {
    const month = e.date.slice(0, 7);
    if (month !== lastMonth) {
      html += `<li class="day-head">${esc(fmtDate(e.date, { month: 'long', year: 'numeric' }))}</li>`;
      lastMonth = month;
    }
    const prev = prevById[e.id];
    html += `<li class="entry">
      <div class="main">
        <div class="w">${fmtKg(e.weight)} kg</div>
        <div class="meta">${e.time} Uhr · ${esc(fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' }))}${e.note ? ' · ' + esc(e.note) : ''}</div>
      </div>
      <div class="delta">${prev ? fmtDelta(e.weight - prev.weight) : ''}</div>
      <button type="button" class="icon-btn" data-edit="${e.id}" aria-label="Bearbeiten">${ICON_EDIT}</button>
      <button type="button" class="icon-btn" data-del="${e.id}" aria-label="Löschen">${ICON_DEL}</button>
    </li>`;
  }
  $('#entry-list').innerHTML = html;
}

$('#entry-list').addEventListener('click', (ev) => {
  const edit = ev.target.closest('[data-edit]');
  const del = ev.target.closest('[data-del]');
  if (edit) startEdit(edit.dataset.edit);
  if (del) {
    const e = entries.find((x) => x.id === del.dataset.del);
    if (e && confirm(`Eintrag ${fmtKg(e.weight)} kg vom ${fmtDate(e.date)} löschen?`)) {
      entries = entries.filter((x) => x.id !== e.id);
      saveEntries();
      render();
    }
  }
});

/* ---------- Statistik ---------- */

let range = '30';
try { range = localStorage.getItem('weight-range') || '30'; } catch {}

$('#range-picker').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-range]');
  if (!b) return;
  range = b.dataset.range;
  try { localStorage.setItem('weight-range', range); } catch {}
  render();
});

function inRange(list) {
  if (range === 'all') return list;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const from = start.getTime() - (Number(range) - 1) * DAY;
  return list.filter((e) => ts(e) >= from);
}

// Gleitender 7-Tage-Durchschnitt (über alle Einträge der letzten 7 Tage bis zum Zeitpunkt).
function movingAvg(all) {
  const out = new Map();
  let j = 0, sum = 0;
  for (let i = 0; i < all.length; i++) {
    const t = ts(all[i]);
    sum += all[i].weight;
    while (ts(all[j]) <= t - 7 * DAY) { sum -= all[j].weight; j++; }
    out.set(all[i].id, sum / (i - j + 1));
  }
  return out;
}

// Steigung der Regressionsgeraden in kg pro Woche.
function trendPerWeek(list) {
  if (list.length < 2) return null;
  const xs = list.map((e) => ts(e) / (7 * DAY));
  const ys = list.map((e) => e.weight);
  const mx = xs.reduce((a, b) => a + b) / xs.length;
  const my = ys.reduce((a, b) => a + b) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : null;
}

function renderTiles(list) {
  const tiles = $('#stat-tiles');
  if (!list.length) {
    tiles.innerHTML = '<div class="tile" style="grid-column:1/-1"><div class="label">Keine Einträge in diesem Zeitraum.</div></div>';
    return;
  }
  const ws = list.map((e) => e.weight);
  const first = list[0], last = list[list.length - 1];
  const min = list.reduce((a, b) => (b.weight < a.weight ? b : a));
  const max = list.reduce((a, b) => (b.weight > a.weight ? b : a));
  const avg = ws.reduce((a, b) => a + b) / ws.length;
  const trend = trendPerWeek(list);
  const short = { day: 'numeric', month: 'short' };
  const tile = (label, value, sub = '') =>
    `<div class="tile"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;
  tiles.innerHTML = [
    tile('Aktuell', `${fmtKg(last.weight)} kg`, esc(fmtDate(last.date, short)) + ', ' + last.time),
    tile('Veränderung', `${fmtDelta(last.weight - first.weight)} kg`, 'seit ' + esc(fmtDate(first.date, short))),
    tile('Durchschnitt', `${fmtKg(avg)} kg`, `${list.length} Einträge`),
    tile('Tendenz', trend == null ? '–' : `${fmtDelta(trend)} kg`, 'pro Woche (Regression)'),
    tile('Minimum', `${fmtKg(min.weight)} kg`, esc(fmtDate(min.date, short))),
    tile('Maximum', `${fmtKg(max.weight)} kg`, esc(fmtDate(max.date, short))),
  ].join('');
}

function niceStep(span, target) {
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function yScaleFor(values, H, padT, padB) {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1) { const m = (hi + lo) / 2; lo = m - 0.5; hi = m + 0.5; }
  const step = niceStep(hi - lo, 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { y, ticks, step };
}

function chartFrame(el) {
  const W = Math.max(280, el.clientWidth || 320);
  return { W, H: 220, padL: 40, padR: 12, padT: 10, padB: 26 };
}

function xTicks(t0, t1, W, padL, padR) {
  const span = Math.max(t1 - t0, DAY);
  const n = Math.max(2, Math.min(5, Math.floor((W - padL - padR) / 70)));
  const out = [];
  for (let i = 0; i < n; i++) out.push(t0 + (span * i) / (n - 1));
  return out;
}

function placeTooltip(tip, card, px, py) {
  tip.hidden = false;
  const cw = card.clientWidth;
  const tw = tip.offsetWidth;
  let left = px + 12;
  if (left + tw > cw - 8) left = px - tw - 12;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = Math.max(8, py - tip.offsetHeight - 8) + 'px';
}

function renderLineChart(list, avgMap) {
  const el = $('#chart');
  const tip = $('#chart-tooltip');
  tip.hidden = true;
  const { W, H, padL, padR, padT, padB } = chartFrame(el);
  $('#chart-legend').innerHTML = list.length
    ? '<span><i style="background:var(--series-1)"></i>Gewicht</span><span><i style="background:var(--series-2)"></i>7-Tage-Schnitt</span>'
    : '';

  if (!list.length) {
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><text class="empty" x="${W / 2}" y="${H / 2}" text-anchor="middle">Noch keine Daten</text></svg>`;
    return;
  }

  const times = list.map(ts);
  let t0 = times[0], t1 = times[times.length - 1];
  if (t1 - t0 < DAY) { t0 -= DAY / 2; t1 += DAY / 2; }
  const x = (t) => padL + ((t - t0) / (t1 - t0)) * (W - padL - padR);
  const avgs = list.map((e) => avgMap.get(e.id));
  const { y, ticks } = yScaleFor([...list.map((e) => e.weight), ...avgs], H, padT, padB);

  const grid = ticks.map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>`).join('');
  const yLabels = ticks.map((v) => `<text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${fmtKg(v, v % 1 ? 1 : 0)}</text>`).join('');
  const xs = xTicks(t0, t1, W, padL, padR);
  const xLabels = xs.map((t, i) => {
    const anchor = i === 0 ? 'start' : i === xs.length - 1 ? 'end' : 'middle';
    const d = new Date(t);
    return `<text x="${x(t)}" y="${H - 6}" text-anchor="${anchor}">${d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' })}</text>`;
  }).join('');

  const path = (vals) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(times[i]).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const showDots = list.length <= 60;
  const dots = showDots
    ? list.map((e, i) => `<circle cx="${x(times[i])}" cy="${y(e.weight)}" r="4" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"/>`).join('')
    : '';

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf, ${list.length} Einträge">
    <g class="grid">${grid}</g>
    <g class="axis">${yLabels}${xLabels}</g>
    <path d="${path(avgs)}" fill="none" stroke="var(--series-2)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 4"/>
    <path d="${path(list.map((e) => e.weight))}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <line class="crosshair" y1="${padT}" y2="${H - padB}" visibility="hidden"/>
    <circle class="hover-dot" r="6" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2" visibility="hidden"/>
    <rect x="${padL}" y="0" width="${W - padL - padR}" height="${H}" fill="transparent"/>
  </svg>`;

  const svg = el.querySelector('svg');
  const cross = svg.querySelector('.crosshair');
  const hdot = svg.querySelector('.hover-dot');
  const card = el.closest('.chart-card');

  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < times.length; i++) if (Math.abs(x(times[i]) - sx) < Math.abs(x(times[best]) - sx)) best = i;
    const e = list[best];
    const cx = x(times[best]), cy = y(e.weight);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    hdot.setAttribute('cx', cx); hdot.setAttribute('cy', cy); hdot.setAttribute('visibility', 'visible');
    tip.innerHTML = `<div class="t">${esc(fmtDate(e.date))}, ${e.time}</div>
      <div><i style="background:var(--series-1)"></i>Gewicht <b>${fmtKg(e.weight)} kg</b></div>
      <div><i style="background:var(--series-2)"></i>7-Tage-Schnitt <b>${fmtKg(avgs[best])} kg</b></div>
      ${e.note ? `<div class="t">${esc(e.note)}</div>` : ''}`;
    const scale = r.width / W;
    placeTooltip(tip, card, el.offsetLeft + cx * scale, el.offsetTop + cy * scale);
  };
  const leave = () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); hdot.setAttribute('visibility', 'hidden'); };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', leave);
}

// Wochen beginnen am Montag.
function weekStart(e) {
  const [y, m, d] = e.date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return dt;
}

function renderWeekly(list) {
  const el = $('#weekly');
  const tip = $('#weekly-tooltip');
  tip.hidden = true;
  const { W, H, padL, padR, padT, padB } = chartFrame(el);

  const groups = new Map();
  for (const e of list) {
    const k = weekStart(e).getTime();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e.weight);
  }
  const weeks = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([k, ws]) => ({
    start: k,
    avg: ws.reduce((a, b) => a + b) / ws.length,
    min: Math.min(...ws),
    max: Math.max(...ws),
    n: ws.length,
  }));

  if (!weeks.length) {
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}"><text class="empty" x="${W / 2}" y="${H / 2}" text-anchor="middle">Noch keine Daten</text></svg>`;
    return;
  }

  const { y, ticks } = yScaleFor(weeks.flatMap((w) => [w.min, w.max]), H, padT, padB);
  const band = (W - padL - padR) / weeks.length;
  const cx = (i) => padL + band * (i + 0.5);

  const grid = ticks.map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/>`).join('');
  const yLabels = ticks.map((v) => `<text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${fmtKg(v, v % 1 ? 1 : 0)}</text>`).join('');
  const every = Math.ceil(weeks.length / Math.max(2, Math.floor((W - padL - padR) / 60)));
  const xLabels = weeks.map((w, i) => (i % every ? '' :
    `<text x="${cx(i)}" y="${H - 6}" text-anchor="middle">${new Date(w.start).toLocaleDateString('de-CH', { day: 'numeric', month: 'numeric' })}</text>`)).join('');
  const marks = weeks.map((w, i) => `
    <g class="wk" data-i="${i}">
      <line x1="${cx(i)}" x2="${cx(i)}" y1="${y(w.max)}" y2="${y(w.min)}" stroke="var(--series-1)" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>
      <circle cx="${cx(i)}" cy="${y(w.avg)}" r="5" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"/>
      <rect x="${padL + band * i}" y="${padT}" width="${band}" height="${H - padT - padB}" fill="transparent"/>
    </g>`).join('');

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Wochenschnitt mit Spannweite">
    <g class="grid">${grid}</g><g class="axis">${yLabels}${xLabels}</g>${marks}</svg>`;

  const svg = el.querySelector('svg');
  const card = el.closest('.chart-card');
  const show = (ev) => {
    const g = ev.target.closest('.wk');
    if (!g) return;
    const i = Number(g.dataset.i);
    const w = weeks[i];
    const end = new Date(w.start + 6 * DAY);
    const f = { day: 'numeric', month: 'short' };
    tip.innerHTML = `<div class="t">Woche ${new Date(w.start).toLocaleDateString('de-CH', f)} – ${end.toLocaleDateString('de-CH', f)}</div>
      <div>Ø <b>${fmtKg(w.avg)} kg</b></div>
      <div class="t">Min ${fmtKg(w.min)} · Max ${fmtKg(w.max)} · ${w.n} Einträge</div>`;
    const scale = svg.getBoundingClientRect().width / W;
    placeTooltip(tip, card, el.offsetLeft + cx(i) * scale, el.offsetTop + y(w.avg) * scale);
  };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
}

function renderMonthTable(list) {
  const groups = new Map();
  for (const e of list) {
    const k = e.date.slice(0, 7);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e.weight);
  }
  const rows = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, ws]) => {
    const avg = ws.reduce((a, b) => a + b) / ws.length;
    return `<tr><td>${esc(fmtDate(k + '-01', { month: 'short', year: 'numeric' }))}</td>
      <td>${fmtKg(avg)}</td><td>${fmtKg(Math.min(...ws))}</td><td>${fmtKg(Math.max(...ws))}</td><td>${ws.length}</td></tr>`;
  });
  $('#month-table tbody').innerHTML = rows.join('') || '<tr><td colspan="5" class="muted">Keine Daten</td></tr>';
}

function renderStats() {
  document.querySelectorAll('#range-picker button').forEach((b) =>
    b.setAttribute('aria-checked', String(b.dataset.range === range)));
  const all = sorted();
  const avgMap = movingAvg(all);
  const list = inRange(all);
  renderTiles(list);
  renderLineChart(list, avgMap);
  renderWeekly(list);
  renderMonthTable(list);
}

/* ---------- Export / Import ---------- */

function csvField(v) {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV() {
  const lines = ['datum,uhrzeit,gewicht_kg,notiz,erfasst_am'];
  for (const e of sorted()) lines.push([e.date, e.time, e.weight.toFixed(1), e.note || '', e.createdAt || ''].map(csvField).join(','));
  return lines.join('\n') + '\n';
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

async function shareOrDownload(filename, content, type) {
  const blob = new Blob([content], { type });
  const file = new File([blob], filename, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const stamp = () => todayStr().replace(/-/g, '');
$('#btn-export-csv').addEventListener('click', () => shareOrDownload(`gewicht-${stamp()}.csv`, toCSV(), 'text/csv'));
$('#btn-export-json').addEventListener('click', () =>
  shareOrDownload(`gewicht-${stamp()}.json`, JSON.stringify({ version: 1, entries: sorted() }, null, 2), 'application/json'));

$('#in-import').addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  const msg = $('#data-msg');
  try {
    const text = await f.text();
    let incoming = [];
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      const data = JSON.parse(text);
      incoming = (Array.isArray(data) ? data : data.entries || []).map((e) => ({ ...e, weight: Number(e.weight) }));
    } else {
      const rows = parseCSV(text);
      const start = /\d/.test(rows[0]?.[0] || '') ? 0 : 1;
      incoming = rows.slice(start).map((r) => ({
        date: r[0]?.trim(), time: (r[1] || '').trim().slice(0, 5), weight: parseWeight(r[2]),
        note: (r[3] || '').trim(), createdAt: (r[4] || '').trim() || new Date().toISOString(),
      }));
    }
    const valid = incoming.filter(isValidEntry);
    const key = (e) => `${e.date} ${e.time} ${e.weight}`;
    const existing = new Set(entries.map(key));
    let added = 0;
    for (const e of valid) {
      if (existing.has(key(e))) continue;
      entries.push({ id: uid(), weight: e.weight, date: e.date, time: e.time, note: e.note || '', createdAt: e.createdAt || new Date().toISOString() });
      existing.add(key(e));
      added++;
    }
    saveEntries();
    msg.textContent = `${added} Einträge importiert, ${valid.length - added} Duplikate übersprungen, ${incoming.length - valid.length} ungültig.`;
    render();
  } catch {
    msg.textContent = 'Import fehlgeschlagen: Datei konnte nicht gelesen werden.';
  }
});

$('#btn-clear').addEventListener('click', () => {
  if (!entries.length) return;
  if (confirm(`Wirklich alle ${entries.length} Einträge löschen? Dies kann nicht rückgängig gemacht werden.`)) {
    entries = [];
    saveEntries();
    $('#data-msg').textContent = 'Alle Einträge gelöscht.';
    render();
  }
});

/* ---------- Start ---------- */

function render() {
  if (currentView === 'add') renderSummary();
  if (currentView === 'list') renderList();
  if (currentView === 'stats') renderStats();
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (currentView === 'stats') renderStats(); }, 150);
});

// Beim Zurückkehren zur App Uhrzeit aktualisieren, falls nichts eingetippt wurde.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !editingId && !$('#in-weight').value) {
    $('#in-date').value = todayStr();
    $('#in-time').value = nowTime();
  }
});

resetForm();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
