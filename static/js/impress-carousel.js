'use strict';

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
const previous = document.querySelector('#previous-panel');
const next = document.querySelector('#next-panel');
const position = document.querySelector('#panel-position');
const dots = [...document.querySelectorAll('.carousel-dots button')];
const names = ['Dataset / demo collection', 'Retargeting', 'Policy training'];
const previews = [
  '<img src="static/images/example-tasks.png" alt="" draggable="false"><img src="static/images/data-collection.png" alt="" draggable="false">',
  '<img src="static/images/retargeting.png" alt="" draggable="false">',
  '<span class="preview-flow"><span>Retargeted trajectories</span><i></i><span>Diffusion policy</span><i></i><span>Contact-guided RL</span></span><span class="preview-chart"><i style="--value:32.9%;background:#88ccee"></i><i style="--value:52.1%;background:#44aa99"></i><i style="--value:55.7%;background:#72A3FE"></i></span>'
];
let active = 1;
function updatePreview(button, index) {
  button.setAttribute('aria-label', `View ${names[index]}`);
  button.querySelector('.preview-title').textContent = names[index];
  button.querySelector('.preview-content').innerHTML = previews[index];
}


function selectPanel(index, focus = false) {
  const oldActive = active;
  active = (index + tabs.length) % tabs.length;
  tabs.forEach((tab, i) => {
    tab.setAttribute('aria-selected', String(i === active));
    tab.tabIndex = i === active ? 0 : -1;
    panels[i].hidden = i !== active;
  });
  updatePreview(previous, (active + tabs.length - 1) % tabs.length);
  updatePreview(next, (active + 1) % tabs.length);
  dots.forEach((dot, i) => {
    if (i === active) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
  position.textContent = `${names[active]}, panel ${active + 1} of ${tabs.length}`;
  if (oldActive !== active && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const direction = index > oldActive ? 1 : -1;
    panels[active].animate([{opacity:0, transform:`translateX(${direction * 24}px)`}, {opacity:1, transform:'translateX(0)'}], {duration:250, easing:'ease-out'});
  }
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
previous.addEventListener('click', () => selectPanel(active - 1));
next.addEventListener('click', () => selectPanel(active + 1));
dots.forEach((dot, i) => dot.addEventListener('click', () => selectPanel(i)));
selectPanel(active);

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
