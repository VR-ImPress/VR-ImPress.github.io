async function readCatalog(path) {
  const url = new URL(path, document.baseURI);
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
  const { demos } = await response.json();
  if (!Array.isArray(demos)) throw new Error('Invalid demo catalog');

  return demos.filter((demo) => demo && typeof demo.id === 'string' &&
    typeof demo.title === 'string' && typeof demo.model === 'string').map((demo) => {
    const assets = { model: demo.model, contacts: demo.contacts };
    for (const [key, path] of Object.entries(assets)) {
      if (!path) continue;
      const asset = new URL(path, url);
      if (!['https:', 'http:'].includes(asset.protocol)) throw new Error('Invalid demo asset URL');
      assets[key] = asset.href;
    }
    return { ...demo, ...assets };
  });
}

async function setUpDemos(panel) {
  const { createDemoScene } = await import('./demo-scene.js?v=contact-timing');
  const canvas = panel.querySelector('.demo-canvas');
  const viewer = createDemoScene(canvas);
  const select = panel.querySelector('#demo-select');
  const play = panel.querySelector('#demo-play');
  const seek = panel.querySelector('#demo-time');
  const clock = panel.querySelector('#demo-clock');
  const reset = panel.querySelector('#demo-reset');
  const keyMoment = panel.querySelector('#demo-key-time');
  const toggle = panel.querySelector('#demo-contact-toggle');
  const legend = panel.querySelector('#demo-contact-legend');
  const contactStatus = panel.querySelector('#demo-contact-status');
  const noContact = panel.querySelector('#demo-no-contact');
  const status = panel.querySelector('#demo-status');
  const demos = new Map();
  let current;
  let duration = 0;
  let time = 0;
  let animationFrame = 0;
  let request;
  let patchRequest;

  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function seekTo(value) {
    time = Math.min(duration, Math.max(0, value));
    seek.value = time;
    clock.textContent = `${time.toFixed(2)} / ${duration.toFixed(2)} s`;
    if (duration) noContact.hidden = viewer.setTime(time) !== false;
  }

  function pause() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    play.textContent = 'Play';
  }

  function setEnabled(ready) {
    play.disabled = seek.disabled = reset.disabled = !ready;
    keyMoment.disabled = !ready || !Number.isFinite(current?.keyTime);
    toggle.disabled = !ready || !current?.contacts;
  }

  async function loadDemo() {
    const selected = demos.get(select.value);
    if (!selected) return;
    const token = {};
    request = token;
    patchRequest?.controller.abort();
    patchRequest = null;
    viewer.clear();
    pause();
    current = selected;
    seek.max = duration = 0;
    seekTo(0);
    setEnabled(false);
    toggle.checked = false;
    legend.hidden = true;
    noContact.hidden = true;
    contactStatus.textContent = '';
    showStatus(`Loading ${current.title.toLowerCase()}…`);
    canvas.setAttribute('aria-label', `3D replay: ${current.title}`);
    try {
      const asset = await viewer.load(selected.model);
      if (request !== token || !asset.animations[0]?.duration) {
        viewer.dispose(asset.scene);
        if (request === token) showStatus('This demo has no recorded animation. Choose another demonstration.');
        return;
      }
      const clip = asset.animations[0];
      viewer.setModel(asset.scene, clip);
      seek.max = duration = clip.duration;
      seekTo(0);
      viewer.reset(current);
      setEnabled(true);
      showStatus('');
    } catch (error) {
      if (request !== token) return;
      console.error(error);
      showStatus('This 3D demo could not load. Choose another demonstration or reload the page.');
    }
  }

  function selectDemo(id) {
    if (!demos.has(id)) return false;
    if (select.value !== id || !current) {
      select.value = id;
      void loadDemo();
    }
    return true;
  }

  panel.addEventListener('demo-select', (event) => selectDemo(event.detail));
  select.addEventListener('change', loadDemo);
  play.addEventListener('click', () => {
    if (animationFrame) {
      pause();
      return;
    }
    if (time >= duration - 0.02) seekTo(0);
    const start = performance.now() - time * 1000;
    function tick(now) {
      seekTo((now - start) / 1000);
      if (time >= duration) pause();
      else animationFrame = requestAnimationFrame(tick);
    }
    play.textContent = 'Pause';
    animationFrame = requestAnimationFrame(tick);
  });

  seek.addEventListener('input', () => {
    pause();
    seekTo(Number(seek.value));
  });
  reset.addEventListener('click', () => viewer.reset(current));
  keyMoment.addEventListener('click', () => {
    pause();
    seekTo(current.keyTime);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  toggle.addEventListener('change', async () => {
    if (!toggle.checked) {
      viewer.hidePatches(time);
      legend.hidden = true;
      noContact.hidden = true;
      contactStatus.textContent = '';
      return;
    }
    const token = request;
    try {
      if (!patchRequest) {
        const controller = new AbortController();
        const promise = viewer.loadPatches(current.contacts, controller.signal).then((patches) => {
          if (request !== token) {
            patches.dispose();
            return;
          }
          viewer.setPatches(patches);
        });
        patchRequest = { controller, promise };
      }
      contactStatus.textContent = 'Loading patches…';
      await patchRequest.promise;
      if (request !== token || !toggle.checked) return;
      noContact.hidden = viewer.showPatches(time) !== false;
      legend.hidden = false;
      contactStatus.textContent = '';
    } catch (error) {
      if (request !== token) return;
      patchRequest = null;
      toggle.checked = false;
      contactStatus.textContent = 'Contact patches could not load. Select again to retry.';
      console.error(error);
    }
  });

  const urls = [panel.dataset.demoCatalog, panel.dataset.externalCatalog].filter(Boolean);
  await Promise.all(urls.map(async (url) => {
    try {
      for (const demo of await readCatalog(url)) {
        if (demos.has(demo.id)) continue;
        demos.set(demo.id, demo);
        select.add(new Option(demo.title, demo.id));
      }
      select.disabled = demos.size === 0;
      if (!selectDemo(panel.dataset.selectedDemo) && !current && demos.size) void loadDemo();
    } catch (error) {
      console.error(error);
    }
  }));
  if (!demos.size) showStatus('The demo catalog could not load. Reload the page to try again.');
}

const panel = document.querySelector('[data-demo-catalog]');
if (panel && location.protocol === 'file:') {
  const status = panel.querySelector('#demo-status');
  const link = document.createElement('a');
  link.href = 'http://127.0.0.1:8000/#demos';
  link.textContent = 'Open the local preview';
  const command = document.createElement('code');
  command.textContent = 'python3 -m http.server 8000 --bind 127.0.0.1';
  status.classList.add('demo-preview-help');
  status.replaceChildren(
    'The 3D viewer needs a web server.',
    document.createElement('br'),
    'In the website folder, run ',
    command,
    document.createElement('br'),
    link,
  );
} else if (panel) {
  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    setUpDemos(panel).catch(() => {
      document.querySelector('#demo-status').textContent =
        'The 3D viewer could not load. Reload the page to try again.';
    });
  }, { rootMargin: '300px' });
  observer.observe(panel);
}
