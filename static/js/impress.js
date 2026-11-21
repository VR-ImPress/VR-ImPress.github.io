'use strict';

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
const position = document.querySelector('#panel-position');
const dots = [...document.querySelectorAll('.carousel-dots button')];
const surface = document.querySelector('.research-panels');
const arrowIn = document.querySelector('.panel-arrow-in');
const arrowOut = document.querySelector('.panel-arrow-out');
const stage = document.querySelector('.carousel-stage');
let arrowTimer;
const names = ['Demo Collection', 'Retargeting', 'Policy Training'];
const last = tabs.length - 1;
let active = 1;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// When the Policy Training panel comes into focus, its result bars grow from zero.
function growBars(panel) {
  if (reduceMotion.matches) return;
  panel.querySelectorAll('.bar').forEach((bar, i) => {
    bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: 900, delay: 380 + i * 110, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' });
  });
}
// Sequential (non-looping) pipeline: collection -> retargeting -> policy training.
function layoutPanel(panel, offset) {
  const side = Math.abs(offset) === 1;
  panel.hidden = false;
  panel.classList.toggle('is-active', offset === 0);
  panel.classList.toggle('is-side', side);
  panel.classList.toggle('is-away', Math.abs(offset) > 1);
  // Same transform function list in every state so the browser interpolates each term smoothly.
  const depth = Math.min(Math.abs(offset), 1);
  panel.style.transform = `translateX(${offset * 82}%) translateZ(${-140 * depth}px) rotateY(${offset * 14}deg) scale(${1 - .14 * depth})`;
  panel.tabIndex = offset === 0 ? 0 : -1;
  if (offset === 0) panel.removeAttribute('aria-hidden');
  else panel.setAttribute('aria-hidden', 'true');
  [...panel.children].forEach(child => { child.inert = offset !== 0; });
}

function selectPanel(index, focus = false) {
  const previous = active;
  active = Math.max(0, Math.min(last, index));
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === active));
    tab.tabIndex = i === active ? 0 : -1;
    layoutPanel(panels[i], i - active);
  });
  dots.forEach((dot, i) => {
    if (i === active) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
  // Hide the progression arrows while panels slide, and bring them back once the move settles.
  if (previous !== active && !reduceMotion.matches) {
    clearTimeout(arrowTimer);
    stage.classList.add('is-moving');
    arrowTimer = setTimeout(() => stage.classList.remove('is-moving'), 750);
  }
  arrowIn.classList.toggle('is-hidden', active === 0);
  arrowOut.classList.toggle('is-hidden', active === last);
  position.textContent = `${names[active]}, panel ${active + 1} of ${tabs.length}`;
  if (previous !== active) growBars(panels[active]);
  if (focus) tabs[active].focus({ preventScroll: true });
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectPanel(i));
  tab.addEventListener('keydown', event => {
    const indices = { ArrowRight: active + 1, ArrowLeft: active - 1, Home: 0, End: last };
    if (event.key in indices) {
      event.preventDefault();
      selectPanel(indices[event.key], true);
    }
  });
});
panels.forEach((panel, i) => panel.addEventListener('click', () => { if (i !== active) selectPanel(i); }));
dots.forEach((dot, i) => dot.addEventListener('click', () => selectPanel(i)));
// Place panels without animating on first load, then enable transitions.
surface.classList.add('is-static');
selectPanel(active);
requestAnimationFrame(() => requestAnimationFrame(() => surface.classList.remove('is-static')));

// Pointer gestures support touch, stylus, and mouse drags without blocking vertical scrolling.
surface.addEventListener('dragstart', event => event.preventDefault());
let start = null;
let suppressClick = false;
surface.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  start = { x: event.clientX, y: event.clientY, id: event.pointerId };
  suppressClick = false;
});
surface.addEventListener('pointerup', event => {
  if (!start || event.pointerId !== start.id) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  start = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    suppressClick = true;
    selectPanel(active + (dx < 0 ? 1 : -1));
  }
});
surface.addEventListener('pointercancel', () => { start = null; });
surface.addEventListener('pointerleave', () => { start = null; });
surface.addEventListener('click', event => {
  if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
}, true);

// Adding a video src enables the mosaic, with reduced-motion support and graceful poster fallback.
const motion = matchMedia('(prefers-reduced-motion: reduce)');
function updateVideos() {
  document.querySelectorAll('.hero-mosaic video').forEach(video => {
    if (motion.matches || document.hidden) video.pause();
    else if (video.getAttribute('src') || video.querySelector('source[src]')) video.play().catch(() => {});
  });
}
motion.addEventListener('change', updateVideos);
document.addEventListener('visibilitychange', updateVideos);
updateVideos();

// Figure lightbox: clicking a figure opens the full-resolution image in a modal dialog.
const lightbox = document.createElement('dialog');
lightbox.className = 'lightbox';
lightbox.setAttribute('aria-label', 'Enlarged figure');
lightbox.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close enlarged figure">×</button><figure><img alt=""><figcaption class="lightbox-caption"></figcaption></figure>';
document.body.append(lightbox);
const lightboxImage = lightbox.querySelector('img');
const lightboxCaption = lightbox.querySelector('.lightbox-caption');
document.querySelectorAll('.research-figure a').forEach(link => {
  link.addEventListener('click', event => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    const image = link.querySelector('img');
    lightboxImage.src = link.href;
    lightboxImage.alt = image ? image.alt : '';
    lightboxCaption.textContent = link.dataset.caption || '';
    lightboxCaption.hidden = !link.dataset.caption;
    lightbox.showModal();
  });
});
lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
