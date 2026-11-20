'use strict';

// Scroll-driven research stages. The section pins as one viewport-height frame and native scrolling is
// mapped continuously onto it: each stage owns a slice of the section's scroll distance during which its
// cards slide sideways; the next slice starts immediately (no pause). Inactive stages show only a small title.
// Nothing here cancels or replaces scroll input; it only reads the scroll position.
(() => {
  const section = document.querySelector('.research-section');
  if (!section) return;
  const frameEl = section.querySelector('.research-layout');
  const stages = [...section.querySelectorAll('.research-stage')].map(el => ({
    el,
    header: el.querySelector('.stage-header'),
    body: el.querySelector('.stage-body'),
    strip: el.querySelector('.research-strip'),
    track: el.querySelector('.research-track'),
    bar: el.querySelector('.research-progress span'),
    travel: 0, ratio: 1, start: 0, span: 0,
  }));
  section.classList.add('is-pinned');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const last = stages.length - 1;
  let active = -1;

  const pos = () => -section.getBoundingClientRect().top;

  function setActive(i) {
    if (i === active) return;
    active = i;
    stages.forEach((s, j) => {
      const on = j === i;
      s.el.classList.toggle('is-active', on);
      s.body.inert = !on; // collapsed cards stay out of the tab order
      s.header.setAttribute('aria-expanded', String(on));
      s.header.tabIndex = on ? -1 : 0;
    });
  }

  function render() {
    const y = pos();
    let i = 0;
    while (i < last && y >= stages[i].start + stages[i].span) i++;
    setActive(i);
    stages.forEach((s, j) => {
      const p = j < i ? 1 : j > i ? 0 : clamp((y - s.start) / s.span, 0, 1);
      s.track.style.transform = `translateX(${-p * s.travel}px)`;
      s.bar.style.setProperty('--offset', `${p * (1 / s.ratio - 1) * 100}%`);
    });
  }

  function layout() {
    const vh = window.innerHeight;
    // A stage whose cards barely overflow still gets some scroll distance, so it can be reached and read.
    const minSpan = Math.round(vh * 0.5);
    section.style.setProperty('--pin-h', `${vh}px`);
    let start = 0;
    for (const s of stages) {
      const cs = getComputedStyle(s.strip);
      const visible = s.strip.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const full = s.track.scrollWidth;
      s.travel = Math.max(0, Math.round(full - visible));
      s.ratio = full ? Math.min(1, visible / full) : 1;
      s.bar.style.setProperty('--thumb', `${s.ratio * 100}%`);
      s.bar.parentElement.hidden = s.travel < 1;
      s.span = Math.max(s.travel, minSpan);
      s.start = start;
      start += s.span;
    }
    section.style.setProperty('--total', `${start}px`);
    render();
  }

  const scrollToStage = (s, offset = 0) => window.scrollTo({
    top: section.getBoundingClientRect().top + window.scrollY + s.start + offset + 1,
  });

  for (const s of stages) {
    s.header.setAttribute('role', 'button');
    s.header.addEventListener('click', () => { if (!s.el.classList.contains('is-active')) scrollToStage(s); });
    s.header.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scrollToStage(s); }
    });
    // Keyboard focus on an off-screen card scrolls to the point where that card is in view.
    s.strip.addEventListener('scroll', () => { s.strip.scrollLeft = 0; });
    s.el.addEventListener('focusin', e => {
      const card = e.target.closest('.research-card');
      if (card) scrollToStage(s, clamp(card.offsetLeft, 0, s.travel) / (s.travel || 1) * s.span);
    });
    s.track.querySelectorAll('img').forEach(img => img.addEventListener('load', layout, { once: true }));
  }

  window.addEventListener('scroll', render, { passive: true });
  window.addEventListener('resize', layout);
  new ResizeObserver(layout).observe(frameEl);
  layout();
})();

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
