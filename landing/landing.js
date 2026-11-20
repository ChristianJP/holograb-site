import { api, toast, money, loadViewer, drawScanlines, esc, FALLBACK_PLANS } from '/landing/common.js';

// The public website (holograb.com on GitHub Pages, built by deploy/build-site.sh) has no holograb server behind it:
// the build marks the page with <meta name="holograb-static">. There the page makes no server calls, drops "Sign in",
// shows the built-in sample menu, and sends plan and custom-build requests by email.
const STATIC = !!document.querySelector('meta[name="holograb-static"]');
const CONTACT = 'hello@holograb.com';
if (STATIC) document.querySelectorAll('a[href^="/dashboard"]').forEach((a) => a.remove());
const mailto = (subject, body = '') =>
  `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}${body ? '&body=' + encodeURIComponent(body) : ''}`;

drawScanlines(document.querySelector('canvas.scan'), { density: 1.1, seed: 11 });

// hero hologram — a real scanned dish in the brand's light. Loaded after first paint; the stage pauses itself
// when it scrolls out of view or the tab is hidden.
const heroStage = document.getElementById('heroStage');
if (heroStage) {
  const names = { burger: 'Smash Burger', pizza: 'Margherita', ramen: 'Tonkotsu Ramen', sushi: 'Nigiri Selection', cake: 'Chocolate Layer Cake' };
  const cap = document.getElementById('heroDish');
  let capTimer;
  const start = async () => {
    try { for (const c of await api('/assets/demo/catalog.json')) if (names[c.id] && c.name) names[c.id] = c.name; } catch {}
    try {
      const { HoloStage } = await import('/viewer/holo-stage.js');
      await HoloStage.create(heroStage, {
        dishes: Object.keys(names).map((id) => ({ src: `/assets/demo/${id}.splat`, name: names[id], poster: `/assets/demo/${id}.png` })),
        cycleSeconds: 9,
        onDish: (i, d) => {
          if (!cap || cap.textContent === d.name) return;
          cap.style.opacity = '0'; clearTimeout(capTimer);
          capTimer = setTimeout(() => { cap.textContent = d.name; cap.style.opacity = '1'; }, 420);
        },
        onError: () => { if (cap) cap.parentElement.style.opacity = '0'; },   // no dish on stage: no caption under an empty beam
      });
    } catch (e) { console.warn('[holograb] hero stage unavailable', e); }
  };
  requestAnimationFrame(() => setTimeout(start, 0));
}

// reveal on scroll
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
setTimeout(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in')), 2500); // headless / no-scroll safety

// "Customers trust what's on the plate": three of our own templates — the real ones from the Content tab, drawn live —
// all made from the same scanned burger, fanned out under "Posters from the scan"; then that scan under "Make as many
// as you like". Made when the section comes near the screen.
(() => {
  const set = document.getElementById('ourPosters'), scan = document.getElementById('proofScan');
  if (!set || !scan) return;
  // fan order: left, right, then the one in front
  const POSTERS = [
    { id: 'window-price', deal: { price: '£8.99', wasPrice: '£12.50', when: 'Mon–Fri · 12–3pm' } },
    { id: 'editorial', deal: { headline: 'Made to order.' } },
    { id: 'big-type', deal: { headline: 'Lunch sorted', price: '£9.99', includes: 'Burger · Fries · Drink' } },
  ];
  const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  let drawn = false;
  const draw = async () => {
    if (drawn) return;
    drawn = true;
    try {
      const [{ byId }, lib, dish] = await Promise.all([
        import('/studio/templates/index.js'), import('/studio/templates/lib.js'), load('/assets/demo/burger.png')]);
      if (!dish) return;
      for (const p of POSTERS) {
        const t = byId(p.id);
        if (!t || t.id !== p.id) continue;
        const c = document.createElement('canvas');
        c.width = 1080; c.height = 1350;   // Instagram-post shape (4:5), like the AI posters beside them
        c.setAttribute('role', 'img');
        c.setAttribute('aria-label', `${t.name} poster made from the scanned burger`);
        await lib.ensureFonts(t.fonts || []);
        await t.render(c.getContext('2d'), c.width, c.height, {
          restaurant: { name: 'Ember & Salt', phone: '020 7946 0321', address: '14 Cinder Lane, London E8', website: '', accent: '#ff4d2e' },
          dishes: [{ name: 'Smash Burger', price: 12.5, priceLabel: '£12.50', description: '', image: dish }],
          deal: { headline: '', price: '', wasPrice: '', includes: '', when: '', smallPrint: '', ...p.deal },
          qr: null, currency: '£',
        }, lib);
        set.appendChild(c);
      }
    } catch (e) { console.warn('[holograb] posters unavailable', e); }
  };
  // The scan: the same live viewer as the dish section, turning only while it's on screen.
  let el = null, making = false, onScreen = false;
  const spin = () => { if (el) el.toggleAttribute('auto-rotate', onScreen && !document.hidden); };
  const makeScan = async () => {
    if (el || making) return;
    making = true;
    const mod = await loadViewer();
    if (!mod || !customElements.get('holo-splat')) return;
    el = document.createElement('holo-splat');
    el.setAttribute('src', '/assets/demo/burger.splat');
    el.setAttribute('interactive', '');
    el.setAttribute('background', 'transparent');
    el.addEventListener('load', () => setTimeout(() => scan.querySelector('.fallback')?.style.setProperty('opacity', '0'), 400), { once: true });
    scan.insertBefore(el, scan.querySelector('.hg-label'));
    spin();
  };
  if (typeof IntersectionObserver === 'undefined') { draw(); makeScan(); return; }
  new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { draw(); makeScan(); } }, { rootMargin: '400px 0px' }).observe(scan.closest('.cols'));
  new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; spin(); }).observe(scan);
  document.addEventListener('visibilitychange', spin);
})();

// live dish
(async () => {
  const view = document.getElementById('dishView');
  let src = '/assets/demo/burger.splat';
  if (!STATIC) try {
    const m = await api('/api/public/ember-and-salt?preview=1');
    const it = m.items.find((i) => i.featured && i.model?.splatUrl) || m.items.find((i) => /burger/i.test(i.name) && i.model?.splatUrl) || m.items.find((i) => i.model?.splatUrl);
    if (it) {
      src = it.model.splatUrl;
      document.getElementById('dishName').textContent = it.name;
      if (it.description) document.getElementById('dishDesc').textContent = it.description;
      document.getElementById('dishPrice').textContent = it.priceLabel || money(it.price);
      // Sample dishes (model.sample) are stand-ins, so they must not claim to be scans; real scans say so.
      document.getElementById('dishCount').textContent = it.model.sample ? 'Sample dish · 3D' : 'Real dish · scanned in 3D';
      const fb = view.querySelector('.fallback'); if (fb && it.model.thumbUrl) fb.src = it.model.thumbUrl;
    }
  } catch {}
  // The live viewer is only made when the section comes near the screen (the hero has its own dish on stage), and it
  // only turns while it is on screen — HoloViewer stops drawing when nothing moves.
  let el = null, making = false;
  const make = async () => {
    if (el || making) return;
    making = true;
    const mod = await loadViewer();
    if (!mod || !customElements.get('holo-splat')) return;
    el = document.createElement('holo-splat');
    el.setAttribute('src', src);
    el.setAttribute('interactive', '');
    el.setAttribute('background', 'transparent');
    // hide the still once the live one has painted something
    el.addEventListener('load', () => setTimeout(() => view.querySelector('.fallback')?.style.setProperty('opacity', '0'), 400), { once: true });
    view.appendChild(el);
    turn();
  };
  let near = false, onScreen = false;
  const turn = () => { if (el) el.toggleAttribute('auto-rotate', onScreen && !document.hidden); };
  if (typeof IntersectionObserver === 'undefined') { near = onScreen = true; make(); return; }
  new IntersectionObserver((es) => { near = es[es.length - 1].isIntersecting; if (near) make(); }, { rootMargin: '300px 0px' }).observe(view);
  new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; turn(); }).observe(view);
  document.addEventListener('visibilitychange', turn);
})();

// templates
const tpls = document.getElementById('tpls');
const T = [
  { id: 'noir', name: 'Noir', note: 'Dark, quiet, dish-first' },
  { id: 'paper', name: 'Paper', note: 'Cream stock, serif' },
  { id: 'market', name: 'Market', note: 'Bold, colourful, loud' },
];
// On the public website the sample menu is the built-in copy at /m/ember-and-salt/ (no server, no preview mode).
const sampleMenu = (extra) => (STATIC ? `/m/ember-and-salt/?${extra}` : `/m/ember-and-salt?preview=1&${extra}`);
tpls.innerHTML = T.map((t) => `
  <a class="tpl reveal" href="${sampleMenu(`template=${t.id}`)}" target="_blank" rel="noopener">
    <div class="frame"><div class="ph"><span class="hg-label">${t.name}</span></div>
      <iframe loading="lazy" tabindex="-1" title="${t.name} template preview" src="${sampleMenu(`chrome=0&template=${t.id}`)}"></iframe></div>
    <div class="cap"><span class="hg-label" style="color:var(--hg-fg)">${t.name}</span><span class="hg-label">${t.note}</span></div>
  </a>`).join('');
tpls.querySelectorAll('.tpl').forEach((el) => io.observe(el));
const fitFrames = () => tpls.querySelectorAll('.frame').forEach((f) => {
  const ifr = f.querySelector('iframe'); ifr.style.transform = `scale(${f.clientWidth / 390})`;
});
fitFrames(); addEventListener('resize', fitFrames);
// if the menu route 404s (static testing), keep the placeholder visible
tpls.querySelectorAll('iframe').forEach((ifr) => ifr.addEventListener('load', () => {
  try { const d = ifr.contentDocument; if (d && /404|not found/i.test(d.title + (d.body?.innerText || '').slice(0, 80))) ifr.remove(); } catch {}
}));

// plans
(async () => {
  let plans = FALLBACK_PLANS;
  if (!STATIC) try { const p = await api('/api/plans'); if (Array.isArray(p) && p.length) plans = p; } catch {}
  const start = (p) => (STATIC ? mailto(`holograb — ${p.name} plan`, `Hi holograb,\n\nI'd like to start with the ${p.name} plan.\n\nRestaurant:\nPhone:\n`)
    : '/dashboard?signup=1&plan=' + encodeURIComponent(p.id));
  document.getElementById('plans').innerHTML = plans.map((p) => {
    const from = p.id === 'custom' || p.from;
    return `<div class="plan ${p.highlight ? 'hi' : ''} reveal">
      <h3>${esc(p.name)} ${p.highlight ? '<span class="hg-label">Most chosen</span>' : ''}</h3>
      <div class="fee">${from ? '<small style="margin:0 6px 0 0">from</small>' : ''}${money(p.setupFee, p.currency || 'GBP')}<small>setup</small></div>
      <div class="mo">+ ${money(p.monthly, p.currency || 'GBP')} / month</div>
      <ul>${(p.features || []).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      <a class="hgx-btn ${p.highlight ? '' : 'ghost'}" href="${from ? '#custom' : esc(start(p))}">${from ? 'Talk to us' : 'Start with ' + esc(p.name)}</a>
    </div>`;
  }).join('');
  document.querySelectorAll('#plans .reveal').forEach((el) => io.observe(el));
})();

// custom build form
document.getElementById('customForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  const body = { restaurantId: null, contact: fd.get('contact'), budget: fd.get('budget'), notes: `${fd.get('restaurant')}\n${fd.get('notes') || ''}`.trim() };
  if (STATIC) {
    // No server here: hand the request to the visitor's email app, already written.
    location.href = mailto(`Custom build — ${fd.get('restaurant') || 'my restaurant'}`,
      `Restaurant: ${fd.get('restaurant') || ''}\nContact: ${fd.get('contact') || ''}\nBudget: ${fd.get('budget') || ''}\n\n${fd.get('notes') || ''}\n`);
    toast('Opening your email app…', 2600);
    btn.disabled = false;
    return;
  }
  try {
    await api('/api/custom-builds', { method: 'POST', json: body });
    e.target.reset();
    toast('Thanks — we’ll be in touch within a day.', 3200);
  } catch {
    toast('Couldn’t send just now — please try again.', 3200);
  } finally { btn.disabled = false; }
});
