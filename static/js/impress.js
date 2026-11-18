'use strict';

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
const previous = document.querySelector('#previous-panel');
const next = document.querySelector('#next-panel');
const position = document.querySelector('#panel-position');
let active = 0;

function selectPanel(index, focus = false) {
  active = Math.max(0, Math.min(tabs.length - 1, index));
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === active));
    tab.tabIndex = i === active ? 0 : -1;
    panels[i].hidden = i !== active;
  });
  previous.disabled = active === 0;
  next.disabled = active === tabs.length - 1;
  position.textContent = `${active + 1} / ${tabs.length}`;
  if (focus) tabs[active].focus({ preventScroll: true });
}

tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => selectPanel(i));
  tab.addEventListener('keydown', event => {
    const indices = { ArrowRight: (active + 1) % tabs.length, ArrowLeft: (active + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
    if (event.key in indices) {
      event.preventDefault();
      selectPanel(indices[event.key], true);
    }
  });
});
previous.addEventListener('click', () => selectPanel(active - 1, true));
next.addEventListener('click', () => selectPanel(active + 1, true));

// Pointer gestures support touch, stylus, and mouse drags without blocking vertical scrolling.
const surface = document.querySelector('.research-panels');
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
