/* =============================================================================
   WARREN — luxury practice template
   app.js

   No framework, no build step. Loaded with `defer` from index.html.
   ============================================================================= */
'use strict';

/* -----------------------------------------------------------------------------
   CONSTANTS — behaviour only.
   Copy lives in index.html, where search engines and screen readers reach it.
   -------------------------------------------------------------------------- */
const CLINIC = {

  /* REQUIRED BEFORE LAUNCH.
     Formspree, Basin, Netlify Forms — anything that accepts a POST.
     Leave this empty and the form still validates and confirms, but the lead
     goes nowhere and nobody finds out for three weeks. */
  FORM_ENDPOINT: '',

  CURSOR:          true,  // dot + ring. Desktop, fine pointers only.
  MAGNET_STRENGTH: 0.12,  // 0 disables. Above ~0.2 the button escapes the cursor.
  MARK_DRIFT:      40,    // px of scroll drift on the hero construction. 0 disables.
  SECTION_INDEX:   true,  // the fixed section label, bottom-left, desktop only
  TOAST_MS:        4200,  // how long a notification stays up

  /* What a tap on the map does.
     'open' — leaves for Google Maps. One finger, one tap, always works.
     'arm'  — unlocks the embed for in-page panning. Google forces two-finger
              panning inside an <iframe> embed and there is no URL parameter to
              change it, so 'arm' cannot give one-finger control. */
  MAP_TAP:         'open' 
};

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE    = window.matchMedia('(pointer: fine)').matches;
const lerp = (a, b, t) => a + (b - a) * t;

/* -----------------------------------------------------------------------------
   1. REVEALS
   Headlines split on the author's own <br>. The DOM text stays intact, so
   search engines, screen readers and copy-paste all still work. Splitting by
   word rewrites innerHTML and breaks all three.
   -------------------------------------------------------------------------- */
function splitLines(el){
  // The hero headline ships pre-split in the markup so CSS can animate it with
  // no JS in the path. Re-wrapping it would nest one mask inside another and
  // break the layout — this guard is what makes that safe.
  if (el.querySelector('.ln')) return;
  const parts = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = parts
    .map((p, i) => `<span class="ln"><span class="ln__i" style="transition-delay:${i * 0.09}s">${p}</span></span>`)
    .join('');
}

function observe(nodes, threshold, rootMargin){
  if (!nodes.length) return;
  if (REDUCED || !('IntersectionObserver' in window)){
    nodes.forEach(el => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { threshold: threshold, rootMargin: rootMargin || '0px' });
  nodes.forEach(el => io.observe(el));
}

function initReveals(){
  if (!REDUCED) document.querySelectorAll('[data-reveal="lines"]').forEach(splitLines);
  observe(Array.from(document.querySelectorAll('[data-reveal]')), 0.15, '0px 0px -8% 0px');
  observe(Array.from(document.querySelectorAll('[data-portrait]')), 0.2);
  observe(Array.from(document.querySelectorAll('[data-shade]')), 0.35);
  observe(Array.from(document.querySelectorAll('[data-spine]')), 0.2);
  observe(Array.from(document.querySelectorAll('[data-plate]')), 0.2);
  observe(Array.from(document.querySelectorAll('[data-figmark]')), 0.05);
}

/* -----------------------------------------------------------------------------
   2. CURSOR — dot and ring, different lag.
   The dot tracks almost exactly; the ring trails, which is what reads as
   crafted rather than mechanical. Difference-blending inverts both over the
   dark sections, so a single colour works everywhere.

   `cursor:none` is set here, after both elements exist. It is never in the
   stylesheet: if this script fails, the visitor keeps a normal pointer.
   -------------------------------------------------------------------------- */
function initCursor(){
  if (!CLINIC.CURSOR || !FINE || REDUCED) return;

  const dot  = document.getElementById('cur-dot');
  const ring = document.getElementById('cur-ring');
  if (!dot || !ring) return;

  const root = document.documentElement;
  const hide = document.createElement('style');
  hide.textContent = 'html, html *{cursor:none!important} ::-webkit-scrollbar, ::-webkit-scrollbar-track, ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-button, ::-webkit-scrollbar-corner{cursor:none!important}';
  document.head.appendChild(hide);

  let live    = false;  // custom cursor currently on screen
  let off     = false;  // permanently stood down (touch device)
  let blocked = false;  // over something the page cannot draw on (an iframe)

  /* One class controls both the pointer and the visibility, so the two can
     never disagree — there is exactly one cursor on screen at any moment.
     `blocked` outranks everything, so a stray show(true) from the document
     mouseover handler cannot bring the cursor back over a map. */
  const show = (state) => {
    const want = (off || blocked) ? false : state;
    if (want === live) return;
    live = want;
    root.classList.toggle('cursor-on', want);
  };

  /* THE SCROLLBAR.
     It is drawn by the operating system, so `cursor:none` cannot reach it and
     the system arrow always appears there. Worse, mousemove stops firing the
     moment the pointer crosses onto it, so our cursor would freeze at its last
     position — two pointers on screen at once. The answer is to stand down:
     inside the gutter the OS has the cursor, and ours is gone. */
  let edgeX = 0, edgeY = 0;
  const measure = () => { edgeX = root.clientWidth; edgeY = root.clientHeight; };
  measure();
  window.addEventListener('resize', measure);

  const EDGE = 3;  // catches the last sample before the pointer crosses over
  const inGutter = (x, y) =>
    (window.innerWidth  > edgeX && x >= edgeX - EDGE) ||
    (window.innerHeight > edgeY && y >= edgeY - EDGE);

  const m = { x: -100, y: -100 };
  const d = { x: -100, y: -100 };
  const r = { x: -100, y: -100 };
  let raf = null;

  const tick = () => {
    measure();
    d.x = lerp(d.x, m.x, 0.85);  d.y = lerp(d.y, m.y, 0.85);
    r.x = lerp(r.x, m.x, 0.14);  r.y = lerp(r.y, m.y, 0.14);

    dot.style.transform  = `translate(${d.x.toFixed(2)}px, ${d.y.toFixed(2)}px) translate(-50%,-50%)`;
    ring.style.transform = `translate(${r.x.toFixed(2)}px, ${r.y.toFixed(2)}px) translate(-50%,-50%)`;

    const settled = Math.abs(m.x - r.x) < 0.1 && Math.abs(m.y - r.y) < 0.1;
    raf = settled ? null : requestAnimationFrame(tick);
  };

  window.addEventListener('mousemove', (e) => {
    if (off) return;
    if (inGutter(e.clientX, e.clientY)){ show(false); return; }
    m.x = e.clientX; m.y = e.clientY;
    show(true);
    if (!raf) raf = requestAnimationFrame(tick);
  }, { passive: true });

  /* A select-like control is something you click, not something you type into,
     so it gets the ring — never the I-beam. The I-beam is only for real text
     entry. [role=option] is listed so the cursor survives inside the open
     listbox, which a native <option> popup could never allow. */
  const CLICKY = 'a, button, [role="radio"], [role="option"], [role="combobox"], label, summary, [data-magnetic]';
  const TEXTY  = 'input:not([type="hidden"]), textarea';

  const setState = (el) => {
    const texty  = el && el.closest(TEXTY);
    const clicky = !texty && el && el.closest(CLICKY);
    dot.classList.toggle('is-text', !!texty);
    ring.classList.toggle('is-text', !!texty);
    dot.classList.toggle('is-over', !!clicky);
    ring.classList.toggle('is-over', !!clicky);
  };

  /* A null relatedTarget means the pointer left the page content entirely —
     the window edge, or the scrollbar on a fast flick that outran mousemove. */
  document.addEventListener('mouseover', (e) => { setState(e.target); show(true); });
  document.addEventListener('mouseout',  (e) => { if (!e.relatedTarget){ setState(null); show(false); } });
  document.addEventListener('mouseleave', () => show(false));

  /* An <iframe> is a separate document. `cursor:none` stops at its border, so
     the system arrow appears inside it while ours would sit frozen at the
     edge — the scrollbar problem again. Stand down at the boundary. */
  document.querySelectorAll('[data-cursor-off]').forEach(el => {
    el.addEventListener('mouseenter', () => { blocked = true;  show(false); });
    el.addEventListener('mouseleave', () => { blocked = false; show(true);  });
  });

  // a touch on a hybrid device means the pointer is not in use — stand down
  window.addEventListener('touchstart', () => {
    off = true;
    show(false);
    hide.remove();
  }, { once: true, passive: true });
}

/* -----------------------------------------------------------------------------
   3. HERO MARK — draws on load (it is above the fold), then drifts on scroll
   -------------------------------------------------------------------------- */
function initMark(){
  const mark = document.getElementById('mark');
  const hero = document.getElementById('top');
  if (!mark) return;

  requestAnimationFrame(() => requestAnimationFrame(() => mark.classList.add('is-in')));
  if (REDUCED || !CLINIC.MARK_DRIFT || !hero) return;

  /* offsetHeight inside the scroll frame forced a synchronous layout on every
     tick — 89ms of it across a Lighthouse run. The hero's height only changes
     on resize, so measure it there instead. */
  let heroH = window.innerHeight;
  const measureHero = () => { heroH = hero.offsetHeight || window.innerHeight; };
  // measured off the boot path — reading offsetHeight during init forced a
  // synchronous layout while styles were still settling
  requestAnimationFrame(measureHero);
  window.addEventListener('resize', measureHero, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureHero);

  let ticking = false;
  const update = () => {
    const progress = Math.min(Math.max(window.scrollY / heroH, 0), 1);
    mark.style.setProperty('--drift', (progress * CLINIC.MARK_DRIFT).toFixed(1) + 'px');
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking){ requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}

/* -----------------------------------------------------------------------------
   4. SHADE LADDER
   It looked interactive, so it is. Proper radiogroup: click or tap to select,
   arrow keys to move, Home and End to jump. Roving tabindex, so the group is
   one stop in the tab order rather than nine.
   -------------------------------------------------------------------------- */
function initShade(){
  const group = document.getElementById('shade-ladder');
  const label = document.getElementById('shade-selected');
  if (!group) return;

  const chips = Array.from(group.querySelectorAll('[role="radio"]'));
  if (!chips.length) return;

  const prefix = (label && label.textContent.split(':')[0]) || 'Selected';

  const select = (el, focus) => {
    chips.forEach(c => {
      const on = c === el;
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
    });
    if (label) label.textContent = `${prefix}: ${el.dataset.code}`;
    if (focus) el.focus();
  };

  group.addEventListener('click', (e) => {
    const chip = e.target.closest('[role="radio"]');
    if (chip) select(chip, false);
  });

  group.addEventListener('keydown', (e) => {
    const i = chips.indexOf(document.activeElement);
    if (i === -1) return;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = chips[(i + 1) % chips.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = chips[(i - 1 + chips.length) % chips.length];
    else if (e.key === 'Home') next = chips[0];
    else if (e.key === 'End') next = chips[chips.length - 1];
    else if (e.key === ' ' || e.key === 'Enter') next = chips[i];
    else return;
    e.preventDefault();
    select(next, true);
  });
}

/* -----------------------------------------------------------------------------
   5. CUSTOM LISTBOX
   ARIA 1.2 combobox pattern: focus never leaves the button, the active option
   is announced through aria-activedescendant. Full keyboard support, and a
   hidden input carries the value so FormData picks it up unchanged.
   -------------------------------------------------------------------------- */
function initSelects(){
  document.querySelectorAll('[data-select]').forEach(sel => {
    const btn   = sel.querySelector('[role="combobox"]');
    const list  = sel.querySelector('[role="listbox"]');
    const value = sel.querySelector('.sel__value');
    const store = sel.querySelector('input[type="hidden"]');
    if (!btn || !list || !value || !store) return;

    const opts = Array.from(list.querySelectorAll('[role="option"]'));
    if (!opts.length) return;

    let open = false;
    let active = -1;
    let closeTimer = null;

    const setActive = (i) => {
      active = i;
      opts.forEach((o, n) => o.classList.toggle('is-active', n === i));
      if (i > -1){
        btn.setAttribute('aria-activedescendant', opts[i].id);
        opts[i].scrollIntoView({ block: 'nearest' });
      } else {
        btn.removeAttribute('aria-activedescendant');
      }
    };

    const setOpen = (state) => {
      open = state;
      sel.dataset.open = String(state);
      btn.setAttribute('aria-expanded', String(state));
      window.clearTimeout(closeTimer);
      if (state){
        list.hidden = false;
        requestAnimationFrame(() => requestAnimationFrame(() => { sel.dataset.open = 'true'; }));
        setActive(Math.max(0, opts.findIndex(o => o.getAttribute('aria-selected') === 'true')));
        // on a phone the field is often near the bottom of the screen and the
        // list would open off-canvas. Nudge just enough to bring it in.
        const over = list.getBoundingClientRect().bottom - window.innerHeight + 16;
        if (over > 0) window.scrollBy({ top: over, behavior: REDUCED ? 'auto' : 'smooth' });
      } else {
        setActive(-1);
        closeTimer = window.setTimeout(() => { list.hidden = true; }, REDUCED ? 0 : 190);
      }
    };

    const choose = (i) => {
      const opt = opts[i];
      if (!opt) return;
      opts.forEach(o => o.setAttribute('aria-selected', String(o === opt)));
      value.textContent = opt.dataset.value;
      value.removeAttribute('data-empty');
      store.value = opt.dataset.value;
      store.dispatchEvent(new Event('input', { bubbles: true }));
      setOpen(false);
      btn.focus();
    };

    btn.addEventListener('click', () => setOpen(!open));

    btn.addEventListener('keydown', (e) => {
      if (!open){
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)){ e.preventDefault(); setOpen(true); }
        return;
      }
      if (e.key === 'Escape'){ e.preventDefault(); setOpen(false); return; }
      if (e.key === 'Tab'){ setOpen(false); return; }
      if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); choose(active); return; }
      if (e.key === 'ArrowDown'){ e.preventDefault(); setActive((active + 1) % opts.length); return; }
      if (e.key === 'ArrowUp'){ e.preventDefault(); setActive((active - 1 + opts.length) % opts.length); return; }
      if (e.key === 'Home'){ e.preventDefault(); setActive(0); return; }
      if (e.key === 'End'){ e.preventDefault(); setActive(opts.length - 1); return; }
      if (e.key.length === 1){
        const hit = opts.findIndex(o => o.dataset.value.toLowerCase().startsWith(e.key.toLowerCase()));
        if (hit > -1){ e.preventDefault(); setActive(hit); }
      }
    });

    list.addEventListener('click', (e) => {
      const opt = e.target.closest('[role="option"]');
      if (opt) choose(opts.indexOf(opt));
    });
    list.addEventListener('mousemove', (e) => {
      const opt = e.target.closest('[role="option"]');
      if (opt) setActive(opts.indexOf(opt));
    });

    document.addEventListener('click', (e) => { if (open && !sel.contains(e.target)) setOpen(false); });
    document.addEventListener('focusin', (e) => { if (open && !sel.contains(e.target)) setOpen(false); });
  });
}

/* -----------------------------------------------------------------------------
   6. MAP SHIELD
   On touch, an embedded map will happily eat a scroll gesture: you swipe past
   it and end up zooming instead of scrolling. A transparent button sits over
   the iframe and takes the first tap; only then does the map become live.
   Scrolling the map out of view puts the shield back, so the trap cannot
   reappear further down the page. A fine pointer never sees any of this — the
   shield is display:none under (hover:hover) and (pointer:fine).
   -------------------------------------------------------------------------- */
function initMap(){
  document.querySelectorAll('[data-map]').forEach(map => {
    const shield = map.querySelector('[data-map-shield]');
    const frame  = map.querySelector('iframe');
    if (!shield) return;

    /* An unarmed map is covered and must not be a keyboard trap: the embed is
       full of focusable Google controls that a Tab user would fall into
       without ever seeing focus. */
    const arm = (live) => {
      map.dataset.armed = String(live);
      if (frame) frame.setAttribute('tabindex', live ? '0' : '-1');
    };
    arm(false);

    shield.addEventListener('click', () => {
      if (CLINIC.MAP_TAP === 'open'){
        const link = map.closest('.loc__map, section')?.querySelector('a[data-c="map.directions"]');
        const href = link ? link.href : (frame ? frame.src : null);
        if (href) window.open(href, '_blank', 'noopener,noreferrer');
        return;
      }
      arm(true);
    });

    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (!e.isIntersecting) arm(false); });
    }, { threshold: 0 });
    io.observe(map);
  });
}

/* -----------------------------------------------------------------------------
   7. TOASTS
   -------------------------------------------------------------------------- */
const ICON_ALERT = '<svg class="ico toast__ico" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.6 15 14H1Z"/><path d="M8 6.2v3.4M8 11.6v.1"/></svg>';
const ICON_OK    = '<svg class="ico toast__ico" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8.4 6.3 12.2 13.5 4.4"/></svg>';

function showToast(message, type){
  const host = document.getElementById('toasts');
  if (!host) return;

  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast--error' : '');
  el.innerHTML = (type === 'error' ? ICON_ALERT : ICON_OK) + '<span></span>';
  el.querySelector('span').textContent = message;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast__x';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '\u00D7';
  el.appendChild(close);

  host.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));

  let timer = null;
  const dismiss = () => {
    window.clearTimeout(timer);
    el.classList.remove('is-in');
    window.setTimeout(() => el.remove(), 600);
  };
  close.addEventListener('click', dismiss);
  timer = window.setTimeout(dismiss, CLINIC.TOAST_MS);
}

/* -----------------------------------------------------------------------------
   8. MAGNETIC CTA — restrained. 0.12, not 0.45.
   -------------------------------------------------------------------------- */
function initMagnetic(){
  if (!FINE || REDUCED || !CLINIC.MAGNET_STRENGTH) return;

  document.querySelectorAll('[data-magnetic]').forEach(el => {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = null, active = false;

    const run = () => {
      cx = lerp(cx, tx, 0.14);
      cy = lerp(cy, ty, 0.14);
      el.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      if (active || Math.abs(cx) > 0.1 || Math.abs(cy) > 0.1){
        raf = requestAnimationFrame(run);
      } else {
        el.style.transform = '';
        raf = null;
      }
    };

    el.addEventListener('mouseenter', () => { active = true; if (!raf) raf = requestAnimationFrame(run); });
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - (r.left + r.width / 2)) * CLINIC.MAGNET_STRENGTH;
      ty = (e.clientY - (r.top + r.height / 2)) * CLINIC.MAGNET_STRENGTH;
    });
    el.addEventListener('mouseleave', () => { active = false; tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(run); });
  });
}

/* -----------------------------------------------------------------------------
   9. NAV
   -------------------------------------------------------------------------- */
function initNav(){
  const nav  = document.getElementById('nav');
  const bar  = document.getElementById('progress');
  const menu = document.getElementById('menu');
  if (!nav) return;

  let last = 0, ticking = false;

  const update = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-stuck', y > 40);

    const menuOpen = menu && menu.dataset.open === 'true';
    if (!menuOpen){
      if (y > last + 8 && y > 260) nav.classList.add('is-hidden');
      else if (y < last - 8 || y < 120) nav.classList.remove('is-hidden');
    }

    if (bar){
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
    }

    last = y;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking){ requestAnimationFrame(update); ticking = true; }
  }, { passive: true });

  update();
}

/* -----------------------------------------------------------------------------
   10. MENU
   -------------------------------------------------------------------------- */
function initMenu(){
  const menu  = document.getElementById('menu');
  const open  = document.getElementById('menu-open');
  const close = document.getElementById('menu-close');
  if (!menu || !open || !close) return;

  let lastFocus = null;

  const setOpen = (state) => {
    menu.dataset.open = String(state);
    menu.setAttribute('aria-hidden', String(!state));
    open.setAttribute('aria-expanded', String(state));
    document.body.style.overflow = state ? 'hidden' : '';
    if (state){
      lastFocus = document.activeElement;
      window.setTimeout(() => close.focus(), 60);
    } else if (lastFocus){
      lastFocus.focus();
    }
  };

  open.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.dataset.open === 'true') setOpen(false);
  });

  menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || menu.dataset.open !== 'true') return;
    const f = menu.querySelectorAll('a[href], button');
    if (!f.length) return;
    const first = f[0], lastEl = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl){ e.preventDefault(); first.focus(); }
  });
}

/* -----------------------------------------------------------------------------
   11. SECTION INDEX + dark inversion
   -------------------------------------------------------------------------- */
function initIndex(){
  const label = document.getElementById('index');
  const brandName = document.querySelector('.brand__name')?.textContent?.trim() || 'Top';
  const map = [
    ['top',        brandName],
    ['doctor',     'The Dentist'],
    ['treatments', 'Treatments'],
    ['approach',   'Approach'],
    ['words',      'Patients'],
    ['trust',      'Standards'],
    ['book',       'Consultation'],
    ['location',   'Location']
  ];
  const sections = map
    .map(([id, name]) => ({ el: document.getElementById(id), name }))
    .filter(s => s.el);
  if (!sections.length) return;

  const darkEls = Array.from(document.querySelectorAll('[data-dark]'));

  /* Every read happens before every write. Writing innerHTML and then calling
     getBoundingClientRect() forces a synchronous layout on each scroll frame. */
  let ticking = false;
  const update = () => {
    // ---- reads ----
    const vh = window.innerHeight;
    const line = window.scrollY + vh * 0.4;
    let current = sections[0];
    sections.forEach(s => { if (s.el.offsetTop <= line) current = s; });
    const dark = darkEls.some(el => {
      const r = el.getBoundingClientRect();
      return r.top < vh * 0.92 && r.bottom > vh * 0.78;
    });

    // ---- writes ----
    if (label && CLINIC.SECTION_INDEX && label.dataset.name !== current.name){
      label.dataset.name = current.name;
      label.innerHTML = '\u2014 <b></b>';
      label.querySelector('b').textContent = current.name;
    }
    document.body.classList.toggle('dark-active', dark);

    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (!ticking){ requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
}

/* -----------------------------------------------------------------------------
   12. FORM
   Inline field errors AND a toast. The toast is easy to notice; the inline
   error is the one that tells you which field is wrong. Neither alone is
   enough, which is why both are here.
   -------------------------------------------------------------------------- */
function initForm(){
  const form = document.getElementById('form');
  const sent = document.getElementById('sent');
  const btn  = document.getElementById('submit');
  const lbl  = document.getElementById('submit-label');
  if (!form) return;

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const MESSAGES = {
    first:     'Enter your first name.',
    last:      'Enter your last name.',
    email:     'Enter an email we can reply to.',
    phone:     'Enter a number we can reach you on.',
    treatment: 'Choose a treatment, or select "not sure yet".'
  };

  const validate = (input) => {
    const v = input.value.trim();
    if ((input.hasAttribute('required') || input.hasAttribute('data-required')) && !v) return false;
    if (input.type === 'email' && v && !EMAIL.test(v)) return false;
    if (input.type === 'tel' && v && v.replace(/\D/g, '').length < 7) return false;
    return true;
  };

  const mark = (input, ok) => {
    const field = input.closest('[data-field]');
    if (!field) return;
    field.dataset.invalid = String(!ok);
    input.setAttribute('aria-invalid', String(!ok));
  };

  form.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('blur', () => { if (input.value.trim()) mark(input, validate(input)); });
    input.addEventListener('input', () => {
      const field = input.closest('[data-field]');
      if (field && field.dataset.invalid === 'true' && validate(input)) mark(input, true);
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    let firstBad = null;
    form.querySelectorAll('input, select, textarea').forEach(input => {
      const ok = validate(input);
      mark(input, ok);
      if (!ok && !firstBad) firstBad = input;
    });

    if (firstBad){
      showToast(MESSAGES[firstBad.name] || 'Check the highlighted field.', 'error');
      // a hidden input cannot take focus — send it to its visible control
      const target = firstBad.dataset.focus
        ? document.querySelector(firstBad.dataset.focus)
        : firstBad;
      (target || firstBad).focus();
      return;
    }

    const first = (form.elements.first && form.elements.first.value.trim()) || '';
    const done = () => {
      form.dataset.off = 'true';
      if (sent) sent.dataset.on = 'true';
      showToast(first ? `Thank you, ${first}. Reception will be in touch.` : 'Request received.', 'success');
    };

    if (!CLINIC.FORM_ENDPOINT){
      console.warn('CLINIC.FORM_ENDPOINT is empty — this submission was not sent anywhere.');
      done();
      return;
    }

    btn.disabled = true;
    if (lbl) lbl.textContent = 'Sending';

    fetch(CLINIC.FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form)
    })
      .then(r => { if (!r.ok) throw new Error('Request failed'); done(); })
      .catch(() => {
        btn.disabled = false;
        if (lbl) lbl.textContent = 'Send again';
        showToast('That did not send. Check your connection and try again, or call the practice.', 'error');
      });
  });
}

/* -----------------------------------------------------------------------------
   13. ANCHORS
   -------------------------------------------------------------------------- */
function initAnchors(){
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({ top: top, behavior: REDUCED ? 'auto' : 'smooth' });
      history.replaceState(null, '', '#' + id);
    });
  });
}

/* -----------------------------------------------------------------------------
   BOOT
   -------------------------------------------------------------------------- */
function boot(){
  /* Signals the inline head script that the page is safe. If anything below
     throws, the catch drops `.js` so the reveal styles cannot hide the page. */
  document.documentElement.classList.add('js-ready');
  initReveals();
  initCursor();
  initMark();
  initShade();
  initSelects();
  initMap();
  initMagnetic();
  initNav();
  initMenu();
  initIndex();
  initForm();
  initAnchors();
}

function safeBoot(){
  try {
    boot();
  } catch (err){
    document.documentElement.classList.remove('js');
    console.error('Boot failed — reveal styles released so the page stays readable.', err);
  }
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', safeBoot);
} else {
  safeBoot();
}
