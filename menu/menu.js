// holograb public QR menu. Templates: noir | paper | market. Data: /api/public/:slug (or ?api=fixtures).
const { HoloViewer } = await import(new URL('../viewer/holo-viewer.js', import.meta.url).href);

const q = new URLSearchParams(location.search);
const parts = location.pathname.split('/').filter(Boolean);
const mIdx = parts.indexOf('m');
const slug = q.get('slug') || (mIdx >= 0 ? parts[mIdx + 1] : null) || 'ember-and-salt';
let deepItem = q.get('item') || (mIdx >= 0 ? parts[mIdx + 2] : null);
// ?preview=1 (owner signed in on this origin → Bearer token) or ?preview=<signed link token> (SPEC §10 owner preview)
const previewParam = q.get('preview');
const preview = !!previewParam && previewParam !== '0';
const showChrome = q.get('chrome') !== '0'; // chrome=0: marketing thumbnails (landing template cards) — no preview badge
// The public website (holograb.com on GitHub Pages, built by deploy/build-site.sh) has no server: its sample menu
// carries <meta name="holograb-static"> and always shows the built-in sample restaurant.
const useFixtures = q.get('api') === 'fixtures' || !!document.querySelector('meta[name="holograb-static"]');
const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ALLERGEN = { gluten: 'Gluten', milk: 'Milk', eggs: 'Eggs', mustard: 'Mustard', sesame: 'Sesame', celery: 'Celery', crustaceans: 'Crustaceans', fish: 'Fish', lupin: 'Lupin', molluscs: 'Molluscs', nuts: 'Tree nuts', peanuts: 'Peanuts', soya: 'Soya', sulphites: 'Sulphites' };
const FONTS = { grotesk: "var(--hg-font-display)", serif: "'Instrument Serif', 'Playfair Display', Georgia, serif", mono: 'var(--hg-font-mono)' };

function menuPath(itemId) {
  if (mIdx >= 0) return `/m/${slug}${itemId ? '/' + itemId : ''}${location.search}`;
  const u = new URLSearchParams(location.search); itemId ? u.set('item', itemId) : u.delete('item');
  return location.pathname + '?' + u.toString();
}
function track(type, itemId) {
  if (useFixtures || preview) return;
  fetch(`/api/public/${encodeURIComponent(slug)}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, itemId }), keepalive: true }).catch(() => {});
}

async function loadData() {
  const url = useFixtures ? new URL('../fixtures/menu.json', import.meta.url).href : `/api/public/${encodeURIComponent(slug)}${preview ? '?preview=' + encodeURIComponent(previewParam) : ''}`;
  const { authHeaders } = await import(new URL('../landing/common.js', import.meta.url).href);
  const res = await fetch(url, { headers: preview ? authHeaders() : {} });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function applyTheme(theme) {
  const t = { ...theme };
  for (const k of ['template', 'font', 'layout']) if (q.get(k)) t[k] = q.get(k);
  if (q.get('accent')) t.accent = '#' + q.get('accent').replace(/^#/, '');
  if (q.has('show3d')) t.show3d = q.get('show3d') !== '0';
  const tpl = ['noir', 'paper', 'market'].includes(t.template) ? t.template : 'noir';
  document.body.className = `t-${tpl} l-${t.layout === 'list' ? 'list' : 'grid'}`;
  const r = document.documentElement.style;
  r.setProperty('--accent', t.accent || '#ff4d2e');
  if (t.font && FONTS[t.font]) r.setProperty('--display', FONTS[t.font]);
  if (t.background) r.setProperty('--bg', t.background);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', tpl === 'paper' ? '#f3efe6' : tpl === 'market' ? (t.accent || '#ff4d2e') : '#0b0b0b');
  return { ...t, template: tpl };
}

function placeholder(item) {
  const initial = esc((item.name || '?').trim()[0] || '?');
  return `<div class="ph" aria-hidden="true"><span class="ph-ring"></span><span class="ph-i">${initial}</span><span class="hg-label ph-l">Scan coming soon</span></div>`;
}
function media(item) {
  if (item.model?.thumbUrl) return `<img class="thumb" src="${esc(item.model.thumbUrl)}" alt="" loading="lazy" decoding="async">`;
  return placeholder(item);
}

function render(data, theme) {
  const { restaurant: r, categories, items } = data;
  document.title = `${r.name} · Menu`;
  const byCat = categories.map((c) => ({ c, items: items.filter((i) => i.category === c) })).filter((g) => g.items.length);
  const loose = items.filter((i) => !categories.includes(i.category));
  if (loose.length) byCat.push({ c: 'More', items: loose });
  const catId = (c) => 'c-' + c.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  app.innerHTML = `
    <header class="hero">
      <div class="hg-scanlines glow"></div>
      <div class="topbar"><span class="hg-label">Menu</span></div>
      ${r.logoUrl ? `<img class="logo" src="${esc(r.logoUrl)}" alt="">` : ''}
      <h1 class="name${r.name.length > 26 ? ' xlong' : r.name.length > 14 ? ' long' : ''}">${esc(r.name)}</h1>
      ${r.tagline ? `<p class="tagline">${esc(r.tagline)}</p>` : ''}
      ${preview && showChrome && !data.publishedAt ? `<span class="hg-label preview-badge">Preview · not yet published</span>` : ''}
    </header>
    <nav class="cats" aria-label="Categories"><div class="cats-in">
      ${byCat.map((g, i) => `<a href="#${catId(g.c)}" data-cat="${catId(g.c)}" class="${i ? '' : 'on'}">${esc(g.c)}</a>`).join('')}
    </div></nav>
    <main>
      ${byCat.map((g) => `
        <section class="cat" id="${catId(g.c)}">
          <h2 class="cat-h"><span>${esc(g.c)}</span><span class="hg-label n">${String(g.items.length).padStart(2, '0')}</span></h2>
          <div class="items">
            ${g.items.map((it) => `
              <article class="item${it.available === false ? ' sold' : ''}${it.featured ? ' feat' : ''}" data-id="${esc(it.id)}" tabindex="0" role="button" aria-label="${esc(it.name)}">
                <div class="media" data-live="${theme.show3d !== false && it.model?.status === 'ready' && it.model?.splatUrl ? '1' : ''}">${media(it)}</div>
                <div class="info">
                  <div class="row"><h3>${esc(it.name)}</h3><span class="price">${esc(it.priceLabel || '')}</span></div>
                  ${it.description ? `<p class="desc">${esc(it.description)}</p>` : ''}
                  <div class="meta">${it.available === false ? '<span class="hg-label sold-l">Sold out</span>' : ''}${(it.tags || []).map((t) => `<span class="tag">${esc(t.replace(/-/g, ' '))}</span>`).join('')}</div>
                </div>
              </article>`).join('')}
          </div>
        </section>`).join('')}
    </main>
    <footer class="foot">
      <p class="foot-t">Real dishes, scanned in 3D with</p>
      <a class="hg-wordmark foot-w" href="/" target="_blank" rel="noopener">holograb<span class="reg">®</span></a>
      ${r.address ? `<p class="hg-label addr">${esc(r.address)}</p>` : ''}
    </footer>
    <div class="sheet" id="sheet" aria-hidden="true" role="dialog" aria-modal="true">
      <div class="sheet-stage"><div class="sheet-3d" id="sheet3d"></div><span class="hg-label hint">Drag to turn · pinch to zoom</span></div>
      <button class="close" id="close" aria-label="Close">Close</button>
      <div class="sheet-body" id="sheetBody"></div>
    </div>`;

  // category nav highlight + smooth scroll
  const nav = app.querySelector('.cats-in');
  app.querySelectorAll('.cats a').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); const el = document.getElementById(a.dataset.cat);
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 64, behavior: 'smooth' });
  }));
  const so = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) {
      app.querySelectorAll('.cats a').forEach((a) => a.classList.toggle('on', a.dataset.cat === en.target.id));
      const on = app.querySelector('.cats a.on'); on && nav.scrollTo({ left: on.offsetLeft - 16, behavior: 'smooth' });
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  app.querySelectorAll('.cat').forEach((s) => so.observe(s));

  // open sheet
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  app.querySelectorAll('.item').forEach((el) => {
    const open = () => openItem(byId[el.dataset.id], true);
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open()));
  });
  app.querySelector('#close').addEventListener('click', () => history.state?.hgItem ? history.back() : closeItem(true));
  addEventListener('keydown', (e) => e.key === 'Escape' && sheetOpen && app.querySelector('#close').click());
  addEventListener('popstate', () => {
    const id = history.state?.hgItem; id && byId[id] ? openItem(byId[id], false) : closeItem(false);
  });

  setupLive(theme);
  if (deepItem && byId[deepItem]) { history.replaceState({ hgItem: deepItem }, '', menuPath(deepItem)); openItem(byId[deepItem], false); }
}

// ---- live 3D on the focused card (1 context) + sheet (1 context) = max 2
let liveViewer = null, liveEl = null, sheetViewer = null, sheetOpen = false, liveSuspended = false;
const vis = new Map();
function setupLive(theme) {
  const medias = [...app.querySelectorAll('.media[data-live="1"]')];
  if (!medias.length) return;
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) vis.set(en.target, en.isIntersecting ? en.intersectionRatio : 0);
    pickLive(theme);
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  medias.forEach((m) => io.observe(m));
  let t; addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => pickLive(theme), 140); }, { passive: true });
}
function pickLive(theme) {
  if (liveSuspended) return;
  let best = null, bestScore = 0;
  const mid = innerHeight * 0.45;
  for (const [el, ratio] of vis) {
    if (ratio < 0.6) continue;
    const r = el.getBoundingClientRect();
    const score = ratio - Math.abs(r.top + r.height / 2 - mid) / innerHeight;
    if (score > bestScore) { bestScore = score; best = el; }
  }
  if (best === liveEl) return;
  stopLive();
  if (!best) return;
  const item = best.closest('.item'); const it = currentData.items.find((i) => i.id === item.dataset.id);
  liveEl = best;
  const host = document.createElement('div'); host.className = 'live';
  best.appendChild(host);
  const v = new HoloViewer(host, { background: 'transparent', interactive: false, autoRotate: theme.autoRotate !== false, autoRotateSpeed: 0.45, pitch: 0.55 });
  liveViewer = v;
  v.load(it.model.splatUrl).then(() => { if (liveViewer === v) best.classList.add('is-live'); }).catch(() => stopLive());
}
function stopLive() {
  if (liveEl) { liveEl.classList.remove('is-live'); const host = liveEl.querySelector('.live'); setTimeout(() => host?.remove(), 400); }
  if (liveViewer) { const v = liveViewer; setTimeout(() => v.destroy(), 380); }
  liveViewer = null; liveEl = null;
}

function openItem(it, push) {
  if (!it) return;
  const sheet = app.querySelector('#sheet'), body = app.querySelector('#sheetBody'), stage = app.querySelector('#sheet3d');
  liveSuspended = true; stopLive();
  const allergens = (it.allergens || []).map((a) => ALLERGEN[a] || a);
  body.innerHTML = `
    <div class="row"><h2>${esc(it.name)}</h2><span class="price">${esc(it.priceLabel || '')}</span></div>
    ${it.available === false ? '<span class="hg-label sold-l">Sold out today</span>' : ''}
    ${it.description ? `<p class="desc">${esc(it.description)}</p>` : ''}
    ${(it.tags || []).length ? `<div class="meta">${it.tags.map((t) => `<span class="tag">${esc(t.replace(/-/g, ' '))}</span>`).join('')}</div>` : ''}
    <p class="hg-label allergens">${allergens.length ? 'Contains · ' + allergens.map(esc).join(' · ') : 'No listed allergens · ask your server'}</p>`;
  if (sheetViewer) { sheetViewer.destroy(); sheetViewer = null; }
  stage.innerHTML = '';
  stage.parentElement.classList.toggle('no-model', !it.model?.splatUrl);
  if (it.model?.splatUrl) {
    if (it.model.thumbUrl) stage.innerHTML = `<img class="sheet-thumb" src="${esc(it.model.thumbUrl)}" alt="">`;
    const host = document.createElement('div'); host.className = 'sheet-live'; stage.appendChild(host);
    const v = new HoloViewer(host, { background: 'transparent', interactive: true, autoRotate: true, autoRotateSpeed: 0.3, pitch: 0.5 });
    sheetViewer = v;
    v.load(it.model.splatUrl).then(() => { if (sheetViewer === v) { stage.classList.add('is-live'); window.__holoReady = true; } }).catch(() => {});
  } else stage.innerHTML = placeholder(it);
  stage.classList.remove('is-live');
  sheet.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('locked'); sheetOpen = true;
  if (push) history.pushState({ hgItem: it.id }, '', menuPath(it.id));
  track('item_open', it.id);
}
function closeItem(replace) {
  const sheet = app.querySelector('#sheet'); if (!sheet || !sheetOpen) return;
  sheet.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('locked'); sheetOpen = false;
  const v = sheetViewer; sheetViewer = null; setTimeout(() => v?.destroy(), 420);
  if (replace) history.replaceState({}, '', menuPath(null));
  liveSuspended = false; setTimeout(() => pickLive(currentTheme), 450);
}

let currentData = null, currentTheme = {};
try {
  const data = await loadData();
  if (data.notFound) {
    applyTheme({ template: q.get('template') || 'noir' });
    app.innerHTML = `<div class="state"><h1 class="name">Menu not found</h1><p class="hg-label">This menu isn’t published yet</p></div>`;
  } else {
    currentData = data; currentTheme = applyTheme(data.restaurant.theme || {});
    render(data, currentTheme);
    track('view');
    if (!deepItem) setTimeout(() => (window.__holoReady = true), 1500);
  }
} catch (e) {
  app.innerHTML = `<div class="state"><h1 class="name">Can’t reach the menu</h1><p class="hg-label">Check your connection and try again</p></div>`;
  console.error(e);
}
document.body.classList.remove('is-loading');
