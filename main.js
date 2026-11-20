/* =========================================================
   del cielito — interacciones
   ========================================================= */
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Header: estado al hacer scroll + menú móvil ---------- */
  const header = document.getElementById('siteHeader');
  const toggle = document.getElementById('menuToggle');
  let lastY = window.scrollY;
  function onScrollHeader() {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 60);
    const goingDown = y > lastY && y > 600 && !header.classList.contains('menu-open');
    header.classList.toggle('hide', goingDown);
    lastY = y;
  }
  window.addEventListener('scroll', onScrollHeader, { passive: true });
  onScrollHeader();

  toggle?.addEventListener('click', () => {
    const open = header.classList.toggle('menu-open');
    toggle.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => {
    header.classList.remove('menu-open');
    toggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }));

  /* ---------- Hero: video de nubes ---------- */
  const heroVideo = document.querySelector('.hero video');
  if (heroVideo) {
    if (reduceMotion) heroVideo.pause();
    else heroVideo.play().catch(() => {});
    if (!reduceMotion) {
      window.addEventListener('scroll', () => {
        const y = Math.min(window.scrollY, window.innerHeight);
        heroVideo.style.transform = `scale(${1.08 + y / window.innerHeight * 0.12}) translateY(${y * 0.18}px)`;
      }, { passive: true });
    }
  }

  const videoIO = new IntersectionObserver(entries => entries.forEach(en => {
    const v = en.target;
    if (en.isIntersecting) { if (!reduceMotion) { v.preload = 'auto'; v.play().catch(() => {}); } }
    else v.pause();
  }), { threshold: .25 });
  document.querySelectorAll('video[data-autoplay]').forEach(v => videoIO.observe(v));
  if (heroVideo && !reduceMotion) videoIO.observe(heroVideo);

  /* ---------- Marquesina (se acelera con el scroll) ---------- */
  document.querySelectorAll('.marquee-track').forEach(track => {
    const first = track.children[0];
    // duplicamos el contenido para que el loop sea infinito
    for (let i = 0; i < 3; i++) track.appendChild(first.cloneNode(true));
    let x = 0, boost = 0, prevY = window.scrollY;
    window.addEventListener('scroll', () => {
      boost = Math.min(Math.abs(window.scrollY - prevY) * 0.6, 30);
      prevY = window.scrollY;
    }, { passive: true });
    (function tick() {
      if (!reduceMotion) {
        x -= 0.6 + boost;
        boost *= 0.9;
        const w = first.offsetWidth;
        if (w && -x >= w) x += w;
        track.style.transform = `translate3d(${x}px,0,0)`;
      }
      requestAnimationFrame(tick);
    })();
  });

  /* ---------- Nubes interactivas (canvas) ---------- */
  // Trazado exacto de la nube del logo (155.19 x 77.1)
  const CLOUD_PATH = 'M154.89,52.3c-1.77-10.4-10.4-17.89-20.9-18.16-2.86-12.84-15.29-20.9-28.35-18.08C99.65,5.84,88.89-.05,77.6,0c-11.29-.05-22.05,5.84-28.04,16.06-13.07-2.81-25.49,5.24-28.35,18.08-10.5.27-19.13,7.77-20.9,18.16-2.11,12.39,6.96,23.66,19.49,24.69,0,0,36.87.19,53.57.07h34.61c.08,0,.17,0,.26,0h4.77c9.5-.04,22.4-.07,22.4-.07,12.53-1.03,21.6-12.3,19.49-24.69Z';

  // x, y en proporción de la sección; s = escala; o = opacidad; c = color
  const CLOUD_LAYOUT = [
    { x: .62, y: .03, s: 2.4, o: .30, c: 'brand' },
    { x: .84, y: .10, s: 1.1, o: .08, c: 'ice' },
    { x: .80, y: .07, s: 1.4, o: .9,  c: 'verm', alt: [[.84, .30], [.86, .50], [.70, .02]] },
    { x: .02, y: .02, s: 1.0, o: .10, c: 'ice' },
    { x: .90, y: .32, s: 2.0, o: .22, c: 'brand' },
    { x: .55, y: .40, s: 1.2, o: .08, c: 'ice' },
    { x: -.04, y: .46, s: 2.2, o: .20, c: 'brand' },
    { x: .80, y: .56, s: 1.3, o: .11, c: 'ice' },
    { x: .30, y: .62, s: .8,  o: .10, c: 'ice' },
    { x: .66, y: .74, s: 2.6, o: .20, c: 'brand' },
    { x: .06, y: .82, s: 1.4, o: .09, c: 'ice' },
    { x: .88, y: .93, s: 1.0, o: .7,  c: 'verm', alt: [[.50, .95], [.02, .96], [.90, .70]] },
    { x: .88, y: .88, s: 1.2, o: .10, c: 'ice' },
  ];

  const CLOUD_LAYOUT_SHORT = [
    { x: .66, y: .10, s: 2.0, o: .30, c: 'brand' },
    { x: .80, y: .30, s: 1.2, o: .9,  c: 'verm', alt: [[.84, .62], [.70, .80]] },
    { x: .90, y: .62, s: 1.6, o: .22, c: 'brand' },
    { x: .58, y: .70, s: .9,  o: .10, c: 'ice' },
    { x: .02, y: .06, s: .8,  o: .08, c: 'ice' },
    { x: .40, y: .02, s: .7,  o: .08, c: 'ice' },
  ];

  function cloudField(canvas, layout) {
    const ctx = canvas.getContext('2d');
    const path = new Path2D(CLOUD_PATH);
    const mouse = { x: -9999, y: -9999, radius: 240 };
    let w = 0, h = 0, dpr = 1, clouds = [], running = false, redRects = [], frameN = 0;
    const host0 = canvas.parentElement;
    // Zonas con texto rojo: una nube roja nunca puede quedar detrás
    function measureRed() {
      const cr = canvas.getBoundingClientRect();
      redRects = [...host0.querySelectorAll('.accent, .kicker')].map(el => {
        const r = el.getBoundingClientRect();
        return { l: r.left - cr.left - 40, t: r.top - cr.top - 40, r: r.right - cr.left + 40, b: r.bottom - cr.top + 40 };
      });
    }
    const hitsRed = (x, y, cw, ch) => redRects.some(q => x < q.r && x + cw > q.l && y < q.b && y + ch > q.t);

    function build() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const k = Math.max(.55, Math.min(w / 1440, 1.3)); // escala según ancho
      mouse.radius = 240 * k;
      measureRed();
      clouds = [...layout].sort((a, b) => (a.c === 'verm') - (b.c === 'verm')).map(c => {
        const scale = c.s * k;
        let px = c.x, py = c.y;
        if (c.c === 'verm') {
          // primera posición candidata que no toque texto rojo (con margen por la flotación)
          const cands = [[c.x, c.y], ...(c.alt || [])];
          const ok = cands.find(([fx, fy]) => !hitsRed(fx * w - 20, fy * h - 20, 155.19 * scale + 40, 77.1 * scale + 40));
          if (ok) [px, py] = ok;
          px = Math.min(px, (w - 155.19 * scale) / w); // que no se corte en el borde
          py = Math.min(py, (h - 77.1 * scale - 24) / h);
        }
        return {
          baseX: px * w, baseY: py * h, x: px * w, y: py * h, scale, o: c.o, c: c.c,
          cw: 155.19 * scale, ch: 77.1 * scale,
          phase: Math.random() * Math.PI * 2,
          speed: .006 + Math.random() * .008,
          repel: 25 + Math.random() * 20,
          drift: c.c === 'verm' ? 0 : (Math.random() * .12 + .04) * (Math.random() < .5 ? -1 : 1),
        };
      });
    }

    function fillFor(c) {
      if (c.c === 'verm') return `rgba(211, 34, 40, ${c.o})`;
      if (c.c === 'ice') return `rgba(232, 241, 251, ${c.o})`;
      const g = ctx.createLinearGradient(0, 38.55, 155.19, 38.55);
      g.addColorStop(0, `rgba(48, 95, 226, ${Math.min(1, c.o * 2.2)})`);
      g.addColorStop(1, `rgba(0, 65, 181, ${Math.min(1, c.o * 1.4)})`);
      return g;
    }

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      if (++frameN % 45 === 0) measureRed();
      for (const c of clouds) {
        const px = c.x, py = c.y;
        c.phase += c.speed;
        c.baseX += reduceMotion ? 0 : c.drift;
        if (c.baseX > w + 40) c.baseX = -c.cw - 40;
        if (c.baseX < -c.cw - 40) c.baseX = w + 40;
        const tx = c.baseX + Math.cos(c.phase * .6) * 10;
        const ty = c.baseY + Math.sin(c.phase) * 16;
        const dx = mouse.x - (c.x + c.cw / 2);
        const dy = mouse.y - (c.y + c.ch / 2);
        const dist = Math.hypot(dx, dy);
        if (dist < mouse.radius) {
          const f = (mouse.radius - dist) / mouse.radius;
          const a = Math.atan2(dy, dx);
          c.x -= Math.cos(a) * f * c.repel;
          c.y -= Math.sin(a) * f * c.repel;
        } else {
          c.x += (tx - c.x) * .045;
          c.y += (ty - c.y) * .045;
        }
        if (c.c === 'verm' && hitsRed(c.x, c.y, c.cw, c.ch)) { c.x = px; c.y = py; }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.scale(c.scale, c.scale);
        ctx.fillStyle = fillFor(c);
        ctx.fill(path);
        ctx.restore();
      }
      requestAnimationFrame(frame);
    }

    const host = canvas.parentElement;
    function setPointer(cx, cy) {
      const r = canvas.getBoundingClientRect();
      mouse.x = cx - r.left; mouse.y = cy - r.top;
    }
    host.addEventListener('pointermove', e => setPointer(e.clientX, e.clientY));
    host.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    host.addEventListener('touchmove', e => { const t = e.touches[0]; setPointer(t.clientX, t.clientY); }, { passive: true });
    host.addEventListener('touchend', () => { mouse.x = mouse.y = -9999; });

    let rT;
    window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(build, 150); });
    new ResizeObserver(() => { clearTimeout(rT); rT = setTimeout(build, 150); }).observe(host);
    build();

    new IntersectionObserver(([en]) => {
      const was = running;
      running = en.isIntersecting;
      if (running && !was) requestAnimationFrame(frame);
    }).observe(host);
  }
  document.querySelectorAll('.cloud-canvas').forEach(cv => cloudField(cv, cv.dataset.layout === 'short' ? CLOUD_LAYOUT_SHORT : CLOUD_LAYOUT));

  /* ---------- Carrusel de Espacios OOH (infinito, sin rotación automática) ---------- */
  document.querySelectorAll('[data-carousel]').forEach(root => {
    const stage = root.querySelector('.carousel-stage');
    const real = [...stage.querySelectorAll('.slide')];
    const n = real.length;
    const tabsWrap = root.querySelector('.carousel-tabs');
    const prev = root.querySelector('[data-prev]');
    const next = root.querySelector('[data-next]');

    real.forEach((s, i) => {
      const c = s.querySelector('.slide-count');
      if (c) c.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b> / ${String(n).padStart(2, '0')}`;
    });
    // Con pocos espacios duplicamos las tarjetas para que el giro infinito
    // ocurra fuera de la vista (las copias son sólo visuales).
    const slides = [...real];
    while (slides.length < 5) {
      real.forEach(s => {
        const cl = s.cloneNode(true);
        cl.setAttribute('aria-hidden', 'true');
        cl.dataset.clone = '';
        cl.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
        stage.appendChild(cl);
        slides.push(cl);
      });
    }
    const N = slides.length;

    const tabs = real.map((s, i) => {
      const b = document.createElement('button');
      b.className = 'tab-btn';
      b.type = 'button';
      b.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b><span>${s.dataset.name || ''}</span>`;
      b.setAttribute('aria-label', `Ver ${s.dataset.name || 'espacio ' + (i + 1)}`);
      b.addEventListener('click', () => goReal(i));
      tabsWrap.appendChild(b);
      return b;
    });

    let index = 0; // posición en "slides" (incluye copias)
    function layout() {
      slides.forEach((s, k) => {
        let d = ((k - index) % N + N) % N;
        if (d > N / 2) d -= N;
        s.style.setProperty('--d', d);
        s.classList.toggle('is-active', d === 0);
        s.classList.toggle('is-side', Math.abs(d) === 1);
        s.classList.toggle('is-far', Math.abs(d) > 1);
        s.setAttribute('aria-hidden', d !== 0);
        if (Math.abs(d) === 1) s.dataset.cursor = 'Ver'; else delete s.dataset.cursor;
        s.querySelectorAll('a,button,summary').forEach(el => el.tabIndex = d === 0 ? 0 : -1);
        if (d !== 0) s.querySelectorAll('details[open]').forEach(dt => dt.open = false);
      });
      tabs.forEach((t, i) => t.setAttribute('aria-current', i === index % n));
      fitHeight();
    }
    // el escenario toma la altura del espacio activo (cada tarjeta mide lo que necesita)
    function fitHeight() {
      const act = slides[index];
      stage.style.height = (act.offsetHeight + 16) + 'px';
    }
    const ro = new ResizeObserver(fitHeight);
    slides.forEach(s => ro.observe(s));
    function go(i) { index = (i + N) % N; layout(); }
    // elegir un espacio real por el camino más corto
    function goReal(i) {
      const cur = index % n;
      let delta = i - cur;
      if (delta > n / 2) delta -= n;
      if (delta < -n / 2) delta += n;
      go(index + delta);
    }
    prev.addEventListener('click', () => go(index - 1));
    next.addEventListener('click', () => go(index + 1));
    slides.forEach(s => s.addEventListener('click', () => {
      if (dragMoved) return;
      const d = +s.style.getPropertyValue('--d');
      if (Math.abs(d) === 1) go(index + d);
    }));
    root.addEventListener('keydown', e => {
      if (e.target.closest('input,textarea')) return;
      if (e.key === 'ArrowLeft') go(index - 1);
      if (e.key === 'ArrowRight') go(index + 1);
    });

    // arrastrar / deslizar
    let dragging = false, dragMoved = false, startX = 0, startY = 0, dx = 0, locked = null;
    const setDrag = px => slides.forEach(s => s.style.setProperty('--drag', px + 'px'));
    stage.addEventListener('pointerdown', e => {
      if (e.target.closest('.slide.is-active a, .slide.is-active button, .slide.is-active summary, .slide.is-active details')) return;
      dragging = true; dragMoved = false; startX = e.clientX; startY = e.clientY; dx = 0; locked = null;
    });
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (locked === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (locked === 'x') { root.classList.add('dragging'); dragMoved = true; }
      }
      if (locked === 'x') setDrag(dx);
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      root.classList.remove('dragging');
      setDrag(0);
      if (locked === 'x' && Math.abs(dx) > stage.offsetWidth * .08) go(index + (dx < 0 ? 1 : -1));
      setTimeout(() => dragMoved = false, 0);
    }
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // invitación: la primera vez que aparece, se asoma hacia el siguiente espacio
    if (!reduceMotion) {
      const io = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        io.disconnect();
        root.classList.add('peek');
        setTimeout(() => root.classList.remove('peek'), 2200);
      }, { threshold: .55 });
      io.observe(stage);
    }

    layout();
  });

  /* ---------- Contadores ---------- */
  const fmt = new Intl.NumberFormat('es-AR');
  const counterIO = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    counterIO.unobserve(en.target);
    const el = en.target, target = +el.dataset.count, t0 = performance.now(), dur = 1600;
    if (reduceMotion) { el.textContent = fmt.format(target); return; }
    (function step(now) {
      const p = Math.min((now - t0) / dur, 1);
      el.textContent = fmt.format(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }), { threshold: .6 });
  document.querySelectorAll('[data-count]').forEach(el => counterIO.observe(el));

  /* ---------- Aparición al hacer scroll ---------- */
  const revealIO = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
  }), { threshold: .15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => revealIO.observe(el));

  /* ---------- Cursor nube (estilo de marca) ---------- */
  if (finePointer && !reduceMotion) {
    document.documentElement.classList.add('has-cursor');
    const ring = document.createElement('div');
    ring.className = 'cursor is-hidden';
    ring.innerHTML = `<svg viewBox="0 0 155.19 77.1"><path d="${CLOUD_PATH}"/></svg><span class="label"></span>`;
    const dot = document.createElement('div');
    dot.className = 'cursor-dot is-hidden';
    document.body.append(ring, dot);
    const label = ring.querySelector('.label');
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || (!e.clientX && !e.clientY)) return;
      if (mx < -50) { rx = e.clientX; ry = e.clientY; ring.classList.remove('is-hidden'); dot.classList.remove('is-hidden'); }
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
      const t = e.target;
      const lab = t.closest?.('[data-cursor]');
      const link = t.closest?.('a,button,select,label,[role="button"]');
      const field = t.closest?.('input,textarea,select');
      ring.classList.toggle('is-label', !!lab && !link);
      ring.classList.toggle('is-link', !!link && !field);
      ring.classList.toggle('is-hidden', !!field);
      dot.classList.toggle('is-hidden', !!field);
      label.textContent = lab && !link ? lab.dataset.cursor : '';
      document.body.classList.toggle('on-ink-cursor', !!t.closest?.('.on-ink, .contact-wrapper'));
    });
    document.addEventListener('pointerleave', () => { ring.classList.add('is-hidden'); dot.classList.add('is-hidden'); });
    document.addEventListener('pointerenter', () => { ring.classList.remove('is-hidden'); dot.classList.remove('is-hidden'); });
    (function loop() {
      rx += (mx - rx) * .18; ry += (my - ry) * .18;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- Formulario de contacto (abre el mail armado) ---------- */
  const CONTACT_EMAIL = 'contacto@delcielito.com';
  document.querySelectorAll('[data-tipo]').forEach(a => a.addEventListener('click', () => {
    const sel = document.getElementById('f-tipo');
    if (sel) sel.value = a.dataset.tipo;
    const msg = document.getElementById('f-mensaje');
    if (msg && a.dataset.espacio && !msg.value) msg.value = `Me interesa el espacio: ${a.dataset.espacio}.\n`;
  }));
  document.getElementById('contactForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const v = id => document.getElementById(id).value.trim();
    const asunto = `Consulta: ${v('f-tipo')} — ${v('f-nombre')}`;
    const cuerpo =
      `Nombre / Empresa: ${v('f-nombre')}\n` +
      `Email: ${v('f-email')}\n` +
      `Me interesa: ${v('f-tipo')}\n` +
      `Fecha tentativa: ${v('f-fecha') || 'A definir'}\n\n` +
      `${v('f-mensaje')}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  });

  const toast = document.getElementById('toast');
  let toastT;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('show'), 2400);
  }
  document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Mail copiado: ' + text);
    } catch {
      // sin acceso al portapapeles: seleccionamos el texto para copiarlo a mano
      const r = document.createRange();
      r.selectNodeContents(btn);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      try { document.execCommand('copy'); showToast('Mail copiado: ' + text); }
      catch { showToast(text + ' (copialo con Ctrl+C)'); }
    }
  }));

  const yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();
})();
