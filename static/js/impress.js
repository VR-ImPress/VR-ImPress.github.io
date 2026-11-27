'use strict';

// Scroll-driven research stages. The section pins as one viewport-height frame and native scrolling is
// mapped continuously onto it. Per stage, the section's scroll distance is laid out as:
//   [cards slide sideways: span] [transition to next stage: T] [next stage's cards ...]
// During a transition the scroll position is the animation clock: the current stage collapses to a small
// title while the next one opens, frame by frame (and in reverse when scrolling back up). Each stage's
// openness is written to --e (CSS interpolates sizes/colors from it).
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
    travel: 0, ratio: 1, start: 0, span: 0, e: -1,
  }));
  section.classList.add('is-pinned');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const last = stages.length - 1;
  let active = -1, T = 0;
  const smooth = t => t * t * (3 - 2 * t);

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

  // Openness of stage j at section scroll position y: rises over the T before its start, falls over the T
  // after its cards finish. The first stage is open before the section; the last stays open after it.
  function openness(j, y) {
    const s = stages[j], end = s.start + s.span;
    if (j > 0 && y < s.start) return smooth(clamp(1 - (s.start - y) / T, 0, 1));
    if (j < last && y > end) return smooth(clamp(1 - (y - end) / T, 0, 1));
    return 1;
  }

  function render() {
    const y = pos();
    let best = 0;
    stages.forEach((s, j) => {
      const e = openness(j, y);
      if (e >= openness(best, y)) best = j; // later stage wins once it is at least half open
      if (e !== s.e) {
        s.e = e;
        s.el.style.setProperty('--e', e.toFixed(4));
        s.el.style.setProperty('--e2', clamp((e - 0.4) / 0.6, 0, 1).toFixed(4));
        s.body.style.gridTemplateRows = `${e.toFixed(4)}fr`;
      }
      const p = s.span ? clamp((y - s.start) / s.span, 0, 1) : (y >= s.start ? 1 : 0);
      s.track.style.transform = `translateX(${-p * s.travel}px)`;
      s.bar.style.setProperty('--offset', `${p * (1 / s.ratio - 1) * 100}%`);
    });
    setActive(best);
  }

  function layout() {
    const vh = window.innerHeight;
    // Scroll distance of one stage-to-stage transition.
    T = Math.round(vh * 0.5);
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
      s.span = s.travel;
      s.start = start;
      start += s.span + T;
    }
    section.style.setProperty('--total', `${start - T}px`);
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

const autoplayVideos = document.querySelectorAll('.hero-mosaic video, [data-autoplay-video]');
if (autoplayVideos.length) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const visibleVideos = new Set();
  const pausedByUser = new WeakSet();
  const pausedByPage = new WeakSet();

  function updateVideo(video) {
    const visible = visibleVideos.has(video) && !document.hidden;
    if (visible) {
      if (!reducedMotion.matches && video.src && video.paused && !video.ended && !pausedByUser.has(video)) {
        video.play().catch(() => {});
      }
    } else if (!video.paused) {
      pausedByPage.add(video);
      video.pause();
    }
  }

  const observer = new IntersectionObserver((entries) => {
    for (const { target, intersectionRatio } of entries) {
      if (intersectionRatio >= 0.2) visibleVideos.add(target);
      else visibleVideos.delete(target);
      updateVideo(target);
    }
  }, { threshold: 0.2 });
  autoplayVideos.forEach((video) => {
    video.addEventListener('pause', () => {
      if (!pausedByPage.delete(video) && !video.ended) pausedByUser.add(video);
    });
    video.addEventListener('play', () => pausedByUser.delete(video));
    video.addEventListener('loadstart', () => {
      pausedByUser.delete(video);
      updateVideo(video);
    });
    observer.observe(video);
  });
  const updateVideos = () => autoplayVideos.forEach(updateVideo);
  reducedMotion.addEventListener('change', updateVideos);
  document.addEventListener('visibilitychange', updateVideos);
}
