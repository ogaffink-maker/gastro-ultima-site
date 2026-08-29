(() => {
  'use strict';

  document.documentElement.classList.remove('no-js');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  /* ---------------------------------------------------------
     Reduced-motion manual toggle (persisted)
  --------------------------------------------------------- */
  const reducedToggle = document.getElementById('reducedToggle');
  const REDUCED_KEY = 'gu_reduced_mode';

  function applyReducedMode(on) {
    document.documentElement.classList.toggle('reduced-motion', on);
    if (reducedToggle) reducedToggle.setAttribute('aria-pressed', String(on));
  }

  const storedReduced = localStorage.getItem(REDUCED_KEY);
  applyReducedMode(storedReduced === '1' || (storedReduced === null && prefersReduced.matches));

  if (reducedToggle) {
    reducedToggle.addEventListener('click', () => {
      const next = document.documentElement.classList.contains('reduced-motion') ? false : true;
      applyReducedMode(next);
      localStorage.setItem(REDUCED_KEY, next ? '1' : '0');
    });
  }

  const reducedActive = () =>
    document.documentElement.classList.contains('reduced-motion') || prefersReduced.matches;

  /* ---------------------------------------------------------
     Header show/hide on scroll
  --------------------------------------------------------- */
  const header = document.getElementById('siteHeader');
  let lastY = window.scrollY;
  let ticking = false;

  function onScrollHeader() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 20);
    if (y > lastY && y > 120) {
      header.classList.add('is-hidden');
    } else {
      header.classList.remove('is-hidden');
    }
    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(onScrollHeader);
      ticking = true;
    }
  }, { passive: true });

  /* ---------------------------------------------------------
     Scroll progress bar
  --------------------------------------------------------- */
  const progressBar = document.getElementById('progressBar');
  function onScrollProgress() {
    const h = document.documentElement;
    const scrollTop = h.scrollTop || document.body.scrollTop;
    const height = h.scrollHeight - h.clientHeight;
    const pct = height > 0 ? (scrollTop / height) * 100 : 0;
    progressBar.style.width = pct + '%';
  }
  window.addEventListener('scroll', onScrollProgress, { passive: true });
  onScrollProgress();

  /* ---------------------------------------------------------
     Mobile menu
  --------------------------------------------------------- */
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');

  function closeMenu() {
    menuToggle.setAttribute('aria-expanded', 'false');
    mobileMenu.classList.remove('is-open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  function openMenu() {
    menuToggle.setAttribute('aria-expanded', 'true');
    mobileMenu.classList.add('is-open');
    mobileMenu.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    isOpen ? closeMenu() : openMenu();
  });
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  /* ---------------------------------------------------------
     Reveal on scroll
  --------------------------------------------------------- */
  const revealTargets = document.querySelectorAll('.reveal-up');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('is-visible'));
  }

  /* ---------------------------------------------------------
     Animated counters
  --------------------------------------------------------- */
  const counters = document.querySelectorAll('.stat-num');
  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10) || 0;
    const suffix = el.dataset.suffix || '';
    if (reducedActive()) {
      el.textContent = target.toLocaleString('ru-RU') + suffix;
      return;
    }
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString('ru-RU') + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window && counters.length) {
    const countIo = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          countIo.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    counters.forEach(el => countIo.observe(el));
  } else {
    counters.forEach(animateCount);
  }

  /* ---------------------------------------------------------
     Bento card tilt (desktop only)
  --------------------------------------------------------- */
  if (!isTouch) {
    document.querySelectorAll('.bento-card').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        if (reducedActive()) return;
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `translateY(-4px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ---------------------------------------------------------
     Hero blueprint — draws itself in via stroke-dashoffset
  --------------------------------------------------------- */
  const blueprint = document.getElementById('blueprint');
  if (blueprint) {
    const lines = blueprint.querySelectorAll('.bp-line');
    const nodes = blueprint.querySelectorAll('.bp-node');

    if (reducedActive()) {
      lines.forEach(l => { l.style.strokeDasharray = 'none'; });
      nodes.forEach(n => { n.style.opacity = '1'; });
    } else {
      lines.forEach((line, i) => {
        const length = line.getTotalLength();
        line.style.strokeDasharray = String(length);
        line.style.strokeDashoffset = String(length);
        line.style.transition = `stroke-dashoffset 1400ms var(--ease-out) ${i * 140}ms`;
      });
      nodes.forEach((node) => {
        node.style.opacity = '0';
        node.style.transition = 'opacity 500ms var(--ease-out) 1600ms';
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          lines.forEach(line => { line.style.strokeDashoffset = '0'; });
          nodes.forEach(node => { node.style.opacity = '1'; });
        });
      });
    }
  }

  /* ---------------------------------------------------------
     Hero blueprint parallax (cursor / gyro), no WebGL
  --------------------------------------------------------- */
  if (blueprint && !isTouch) {
    window.addEventListener('mousemove', (e) => {
      if (reducedActive()) return;
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      blueprint.style.transform = `rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 4).toFixed(2)}deg)`;
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     Hero 3D scene — lazy-loaded Three.js, falls back to the
     static SVG blueprint above on any unsupported/failed case
  --------------------------------------------------------- */
  (function loadHero3D() {
    const saveData = navigator.connection && navigator.connection.saveData;
    if (reducedActive() || saveData || isTouch || window.innerWidth < 900) return;

    let canWebGL = false;
    try {
      const c = document.createElement('canvas');
      canWebGL = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { canWebGL = false; }
    if (!canWebGL) return;

    function inject(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.body.appendChild(s);
      });
    }

    function start() {
      inject('scripts/vendor/three.min.js')
        .then(() => inject('scripts/hero3d.js'))
        .catch(() => { /* stays on SVG fallback */ });
    }

    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start, { once: true });
    }
  })();

  /* ---------------------------------------------------------
     Custom cursor (desktop only)
  --------------------------------------------------------- */
  const cursor = document.getElementById('cursor');
  if (cursor && !isTouch) {
    window.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
      cursor.classList.add('is-active');
    }, { passive: true });

    document.querySelectorAll('a, button, summary, input, select, .spotlight').forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
    });

    document.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
  }

  /* ---------------------------------------------------------
     Hero particles — rising embers (decorative, generated once)
  --------------------------------------------------------- */
  const particlesHost = document.getElementById('heroParticles');
  if (particlesHost && !reducedActive()) {
    const count = window.innerWidth < 640 ? 8 : 16;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const el = document.createElement('i');
      el.style.setProperty('--x', (Math.random() * 100).toFixed(1) + '%');
      el.style.setProperty('--size', (Math.random() * 2.5 + 1.5).toFixed(1) + 'px');
      el.style.setProperty('--dur', (Math.random() * 6 + 7).toFixed(1) + 's');
      el.style.setProperty('--delay', (Math.random() * 10).toFixed(1) + 's');
      el.style.setProperty('--drift', (Math.random() * 70 - 35).toFixed(0) + 'px');
      frag.appendChild(el);
    }
    particlesHost.appendChild(frag);
  }

  /* ---------------------------------------------------------
     Magnetic hero buttons (desktop only)
  --------------------------------------------------------- */
  if (!isTouch) {
    document.querySelectorAll('.hero-cta .btn').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        if (reducedActive()) return;
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.25;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.35;
        btn.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  /* ---------------------------------------------------------
     Spotlight cursor glow (delegated, cards/buttons with .spotlight)
  --------------------------------------------------------- */
  if (!isTouch) {
    document.addEventListener('mousemove', (e) => {
      const el = e.target.closest('.spotlight');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty('--mx', mx.toFixed(1) + '%');
      el.style.setProperty('--my', my.toFixed(1) + '%');
    }, { passive: true });
  }

  /* ---------------------------------------------------------
     Process stepper — scroll-driven progress line
  --------------------------------------------------------- */
  const stepperFill = document.getElementById('stepperFill');
  const steps = document.querySelectorAll('.step');
  if (stepperFill && steps.length && 'IntersectionObserver' in window) {
    let currentIndex = -1;
    const stepIo = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const idx = Array.from(steps).indexOf(entry.target);
        if (entry.isIntersecting && idx > currentIndex) {
          currentIndex = idx;
          steps.forEach((s, i) => s.classList.toggle('is-active', i <= currentIndex));
          stepperFill.style.height = (((currentIndex + 1) / steps.length) * 100) + '%';
        }
      });
    }, { threshold: 0, rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(s => stepIo.observe(s));
  }

  /* ---------------------------------------------------------
     Lead form — client-side only (no backend wired up)
  --------------------------------------------------------- */
  const form = document.getElementById('leadForm');
  const formStatus = document.getElementById('formStatus');

  const validators = {
    name: (v) => v.trim().length >= 2 ? '' : 'Введите имя',
    phone: (v) => /^[\d+()\s-]{7,}$/.test(v.trim()) ? '' : 'Введите корректный телефон',
    venue: (v) => v ? '' : 'Выберите тип заведения',
    city: (v) => v.trim().length >= 2 ? '' : 'Введите город',
  };

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;

      ['name', 'phone', 'venue', 'city'].forEach((name) => {
        const input = form.elements[name];
        const field = input.closest('.field');
        const errorEl = field.querySelector('.field-error');
        const message = validators[name](input.value);
        field.classList.toggle('has-error', Boolean(message));
        errorEl.textContent = message;
        if (message) valid = false;
      });

      const consent = form.elements.consent;
      if (!consent.checked) {
        valid = false;
        formStatus.textContent = 'Подтвердите согласие на обработку персональных данных.';
        formStatus.classList.add('is-error');
      }

      if (!valid) {
        if (consent.checked) {
          formStatus.textContent = 'Проверьте, пожалуйста, поля формы.';
          formStatus.classList.add('is-error');
        }
        return;
      }

      // NOTE: нет подключённого backend/CRM — это демонстрационное состояние отправки.
      formStatus.classList.remove('is-error');
      const submitBtn = form.querySelector('.form-submit .btn-label');
      const originalLabel = submitBtn.textContent;
      submitBtn.textContent = 'Отправляем…';

      setTimeout(() => {
        formStatus.textContent = 'Заявка принята. Мы свяжемся с вами в ближайшее время.';
        submitBtn.textContent = originalLabel;
        form.reset();
      }, 700);
    });
  }

  /* ---------------------------------------------------------
     Footer year
  --------------------------------------------------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

})();
