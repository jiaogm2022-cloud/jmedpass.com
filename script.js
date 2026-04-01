/* ===== SAKURA CANVAS ANIMATION ===== */
(function () {
  const canvas = document.getElementById('sakuraCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const PETAL_COUNT = 55;
  const petals = [];

  function randomBetween(a, b) { return a + Math.random() * (b - a); }

  function createPetal() {
    return {
      x: randomBetween(-60, canvas.width + 60),
      y: randomBetween(-100, canvas.height),
      r: randomBetween(5, 12),
      opacity: randomBetween(0.3, 0.85),
      speedX: randomBetween(0.3, 1.2),
      speedY: randomBetween(0.6, 1.8),
      wobble: randomBetween(0, Math.PI * 2),
      wobbleSpeed: randomBetween(0.01, 0.04),
      rotation: randomBetween(0, Math.PI * 2),
      rotationSpeed: randomBetween(-0.03, 0.03),
    };
  }

  for (let i = 0; i < PETAL_COUNT; i++) petals.push(createPetal());

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = p.opacity;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r);
    grad.addColorStop(0, '#fde8ee');
    grad.addColorStop(0.6, '#f2b8c6');
    grad.addColorStop(1, '#e8637a');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    petals.forEach((p) => {
      p.wobble += p.wobbleSpeed;
      p.x += p.speedX + Math.sin(p.wobble) * 0.5;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;
      if (p.y > canvas.height + 20 || p.x > canvas.width + 60) {
        Object.assign(p, createPetal(), { x: randomBetween(-60, canvas.width * 0.5), y: -20 });
      }
      drawPetal(p);
    });
    requestAnimationFrame(animate);
  }
  animate();
})();

/* ===== NAVBAR SCROLL ===== */
(function () {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
})();

/* ===== HAMBURGER MENU ===== */
(function () {
  const btn = document.getElementById('hamburger');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;
  btn.addEventListener('click', () => {
    links.classList.toggle('open');
  });
  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => links.classList.remove('open'));
  });
})();

/* ===== COUNTER ANIMATION ===== */
(function () {
  const counters = document.querySelectorAll('.stat-num');
  let triggered = false;

  function animateCounters() {
    counters.forEach((el) => {
      const target = parseInt(el.dataset.target, 10);
      const duration = 1800;
      const step = target / (duration / 16);
      let current = 0;
      const timer = setInterval(() => {
        current += step;
        if (current >= target) { current = target; clearInterval(timer); }
        el.textContent = Math.floor(current).toLocaleString();
      }, 16);
    });
  }

  const heroSection = document.querySelector('.hero');
  if (!heroSection) return;

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !triggered) {
      triggered = true;
      setTimeout(animateCounters, 600);
    }
  }, { threshold: 0.4 });
  observer.observe(heroSection);
})();

/* ===== SCROLL FADE-IN ===== */
(function () {
  const targets = document.querySelectorAll(
    '.service-card, .feature-row, .process-step, .testi-card, .contact-item, .section-header, .why-left, .why-right, .contact-left, .contact-form-card'
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  targets.forEach((el, i) => {
    el.classList.add('fade-up');
    el.style.transitionDelay = `${(i % 4) * 0.1}s`;
    observer.observe(el);
  });
})();

/* ===== SMOOTH ANCHOR SCROLL ===== */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 80;
    window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
  });
});

/* ===== CONTACT FORM SUBMIT ===== */
(function () {
  const form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('.btn-submit');

    // Collect data
    const name     = form.querySelector('input[type="text"]').value.trim();
    const phone    = form.querySelector('input[type="tel"]').value.trim();
    const region   = form.querySelector('select').value;
    const services = [...form.querySelectorAll('input[type="checkbox"]:checked')].map(c => c.value);
    const message  = form.querySelector('textarea').value.trim();

    // Save to localStorage for admin
    const DB_KEY = 'sm_inquiries';
    let list = [];
    try { list = JSON.parse(localStorage.getItem(DB_KEY)) || []; } catch {}
    list.unshift({
      id: 'inq_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7),
      name, phone, region, services, message,
      status: 'new',
      time: Date.now()
    });
    localStorage.setItem(DB_KEY, JSON.stringify(list));

    btn.textContent = '✓ 提交成功！我们将尽快联系您';
    btn.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = '提交预约申请';
      btn.style.background = '';
      btn.disabled = false;
      form.reset();
    }, 4000);
  });
})();

/* ===== FAQ ACCORDION ===== */
(function () {
  document.querySelectorAll('.faq-q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = this.closest('.faq-item');
      var isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (el) { el.classList.remove('open'); });
      if (!isOpen) item.classList.add('open');
    });
  });
})();

/* ===== ACTIVE NAV LINK ON SCROLL ===== */
(function () {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach((s) => {
      if (window.scrollY >= s.offsetTop - 120) current = s.id;
    });
    navLinks.forEach((a) => {
      a.classList.toggle('active-nav', a.getAttribute('href') === `#${current}`);
    });
  }, { passive: true });
})();
