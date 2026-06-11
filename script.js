
// Año en el pie
document.getElementById('year').textContent = new Date().getFullYear();

// Menú móvil
const burger = document.getElementById('burger');
const menu = document.getElementById('menu');
burger.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  burger.setAttribute('aria-expanded', open ? 'true' : 'false');
});

// Gestión robusta de enlace activo: siempre determinamos el enlace activo a partir
// de la URL actual (ruta + hash). Escuchamos cambios de navegación para mantener
// el estado sincronizado sin depender únicamente de localStorage.
{
  const menuLinks = document.querySelectorAll('.menu a');
  if (menuLinks.length) {
    const clearActive = () => menuLinks.forEach(l => l.classList.remove('active'));

    function applyActiveFromLocation() {
      clearActive();
      const currentPath = (location.pathname.split('/').pop() || 'index.html');
      const currentHash = location.hash || '';

      menuLinks.forEach(a => {
        const hrefAttr = a.getAttribute('href') || '';
        try {
          const linkUrl = new URL(a.href, location.href);
          const linkPath = (linkUrl.pathname.split('/').pop() || 'index.html');
          const linkHash = linkUrl.hash || '';

          // Coincidencia primaria: mismo archivo (index.html, about.html, contact.html)
          if (linkPath === currentPath) { a.classList.add('active'); return; }

          // Coincidencia por hash (anclas dentro de la página)
          if (linkHash && linkHash === currentHash) { a.classList.add('active'); return; }

          // Si el href es sólo un hash y coincide con el hash actual
          if (hrefAttr.startsWith('#') && hrefAttr === currentHash) { a.classList.add('active'); return; }

          // Fallbacks: comparar pathname completo o que el href termine igual que la ruta actual
          if (linkUrl.pathname === location.pathname) { a.classList.add('active'); return; }
          if (a.getAttribute('href') === currentPath || a.getAttribute('href') === ('#' + currentHash.replace('#',''))) { a.classList.add('active'); return; }
        } catch (e) {
          // En caso de URL inválida, comparar de forma simple
          if (hrefAttr === currentHash || hrefAttr === currentPath) a.classList.add('active');
        }
      });
    }

    // Actualizar estado al hacer click (útil para anclas sin recarga)
    menuLinks.forEach(a => {
      a.addEventListener('click', () => {
        try { localStorage.setItem('citrumax.activeMenu', a.getAttribute('href')); } catch (e) { /* ignore */ }
        // aplicar inmediatamente para enlaces en la misma página
        menuLinks.forEach(x => x.classList.remove('active'));
        a.classList.add('active');
      });
    });

    // Escuchar cambios de navegación y hash para mantener la selección sincronizada
    window.addEventListener('hashchange', applyActiveFromLocation);
    window.addEventListener('popstate', applyActiveFromLocation);

    // Ejecutar ahora para aplicar el estado al cargar el script
    applyActiveFromLocation();
  }
}

// Animaciones al hacer scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Form handler: valida en cliente; si `form.action` apunta a un endpoint real usa fetch POST,
// si no (por ejemplo action="#") usa `mailto:` como fallback para abrir el cliente de correo.
const form = document.getElementById('contact-form');
if (form) {
  const statusEl = document.getElementById('form-status');
  const sendBtn = form.querySelector('.btn-send');

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (statusEl) statusEl.textContent = '';

    const formData = new FormData(form);
    const nombre = (formData.get('nombre') || '').toString().trim();
    const email = (formData.get('email') || '').toString().trim();
    const mensaje = (formData.get('mensaje') || '').toString().trim();

    // Validación simple en cliente
    if (!nombre || !email || !mensaje) {
      if (statusEl) statusEl.textContent = 'Por favor completa los campos requeridos: nombre, email y mensaje.';
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      if (statusEl) statusEl.textContent = 'Ingresa un correo electrónico válido.';
      return;
    }

    // UI: deshabilitar botón mientras se procesa
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.7';
    }
    if (statusEl) statusEl.textContent = 'Enviando…';
    // Si el formulario está configurado para EmailJS, usarlo para enviar automáticamente
    const ejService = form.dataset.emailjsService;
    const ejTemplate = form.dataset.emailjsTemplate;
    const ejUser = form.dataset.emailjsUser;
    if (ejService && ejTemplate && window.emailjs) {
      try {
        if (ejUser && typeof emailjs.init === 'function') emailjs.init(ejUser);
      } catch (e) {
        console.warn('EmailJS init failed', e);
      }
      try {
        const resp = await emailjs.sendForm(ejService, ejTemplate, form);
        form.reset();
        if (statusEl) statusEl.textContent = '¡Gracias! Te contactaremos pronto.';
      } catch (err) {
        console.error('EmailJS send error', err);
        if (statusEl) statusEl.textContent = 'No se pudo enviar el formulario vía EmailJS. Revisa la configuración.';
      } finally {
        if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = ''; }
      }
      return;
    }

    const action = (form.getAttribute('action') || '').trim();
    try {
      if (action && action !== '#') {
        // Envío a endpoint real (por ejemplo Formspree, Netlify Forms o backend propio)
        const res = await fetch(action, { method: 'POST', body: formData });
        if (res.ok) {
          form.reset();
          if (statusEl) statusEl.textContent = '¡Gracias! Te contactaremos pronto.';
        } else {
          let text = '';
          try { text = await res.text(); } catch(e) { /* ignore */ }
          if (statusEl) statusEl.textContent = 'Error en el envío: ' + (text || res.statusText || res.status);
        }
      } else {
        // Fallback: abrir cliente de correo del usuario con mailto:
        const recipient = 'genskowski.maxi@gmail.com';
        const subject = encodeURIComponent(`Consulta desde sitio — ${nombre}`);
        const bodyLines = [
          `Nombre: ${nombre}`,
          `Empresa: ${formData.get('empresa') || ''}`,
          `Email: ${email}`,
          `Teléfono: ${formData.get('telefono') || ''}`,
          '',
          `Mensaje:`,
          `${mensaje}`
        ];
        const body = encodeURIComponent(bodyLines.join('\n'));
        const mailto = `mailto:${recipient}?subject=${subject}&body=${body}`;
        // Abrir el cliente de correo. Algunos navegadores bloquean ventanas emergentes; usar location.href
        window.location.href = mailto;
        if (statusEl) statusEl.textContent = 'Se abrió tu cliente de correo para enviar el mensaje. Si no sucede nada, escribe a contacto@citrumax.com';
      }
    } catch (e) {
      console.error('Contact form error', e);
      if (statusEl) statusEl.textContent = 'Hubo un problema al enviar. Intenta nuevamente más tarde.';
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '';
      }
    }
  });
}

// Lightbox para imágenes de Salud
(function setupLightbox() {
  const imgs = document.querySelectorAll('.salud-grid img');
  if (!imgs.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');

  const overlayImg = document.createElement('img');
  overlayImg.className = 'lightbox__image';
  overlay.appendChild(overlayImg);

  document.body.appendChild(overlay);

  const open = (src, alt) => {
    overlayImg.src = src;
    overlayImg.alt = alt || '';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  };
  const close = () => {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    overlayImg.src = '';
    overlayImg.alt = '';
  };

  imgs.forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => open(img.currentSrc || img.src, img.alt));
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) close(); });
})();