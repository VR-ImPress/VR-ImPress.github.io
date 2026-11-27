'use strict';

// Highlight the current stage and update its progress line during native scrolling.
(() => {
  const root = document.querySelector('.research-v');
  if (!root) return;
  const bars = [...root.querySelectorAll('.v-bar')];
  const bodies = [...root.querySelectorAll('.v-body')];
  const n = bars.length;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  let active = -1, frame = 0;

  function update() {
    frame = 0;
    const hs = bars[0].offsetHeight, vh = window.innerHeight;
    // Current stage: the last one whose body has reached the slot just below its own title bar.
    let i = 0;
    bodies.forEach((b, j) => { if (b.getBoundingClientRect().top <= (j + 1) * hs + 2) i = j; });
    if (i !== active) {
      active = i;
      bars.forEach((bar, j) => {
        bar.classList.toggle('is-active', j === i);
        bar.querySelector('button').setAttribute('aria-current', j === i ? 'step' : 'false');
      });
    }
    bars.forEach((bar, j) => {
      const r = bodies[j].getBoundingClientRect();
      const top = (j + 1) * hs;                       // body's resting top, just under its bar
      const view = vh - top - (n - 1 - j) * hs;       // room between the top and bottom bar stacks
      const range = r.height - view;
      const p = range > 0 ? clamp((top - r.top) / range, 0, 1) : (r.top <= top + 2 ? 1 : 0);
      bar.style.setProperty('--p', p.toFixed(4));
    });
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };

  bars.forEach((bar, j) => {
    bar.querySelector('button').addEventListener('click', () => {
      bodies[j].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
})();
