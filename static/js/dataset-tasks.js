(() => {
  const browser = document.querySelector('[data-task-catalog]');
  if (!browser || location.protocol === 'file:') return;

  const tabs = browser.querySelector('.task-tabs');
  const categoryPanel = browser.querySelector('#task-category-panel');
  const results = browser.querySelector('.task-results');
  const video = browser.querySelector('#task-video');
  const title = browser.querySelector('#render-title');
  const replay = browser.querySelector('#task-replay');
  const demoPanel = document.querySelector('[data-demo-catalog]');
  const catalog = new URL(browser.dataset.taskCatalog, document.baseURI);
  const categoryNames = {
    'insertion': 'Insertion',
    'articulation': 'Articulation',
    'pick and lift': 'Pick and lift',
    'tool use': 'Tool use',
    'furniture assembly': 'Furniture assembly',
    'non-prehensile': 'Non-prehensile',
    'reorientation': 'Reorientation',
    'cap removal': 'Cap removal',
    'screwing': 'Screwing',
    'handover': 'Handover',
  };
  let activeTask;

  replay.addEventListener('click', () => {
    if (!activeTask?.demo || !demoPanel) return;
    demoPanel.dataset.selectedDemo = activeTask.demo;
    demoPanel.dispatchEvent(new CustomEvent('demo-select', { detail: activeTask.demo }));
  });

  function selectVideo(task, play) {
    if (activeTask !== task) {
      activeTask = task;
      title.textContent = task.title;
      video.src = new URL(task.video, catalog).href;
      replay.hidden = !task.demo || !demoPanel;
      for (const button of results.querySelectorAll('button')) {
        button.setAttribute('aria-pressed', String(button.dataset.task === task.id));
      }
    }
    if (play) video.play().catch(() => {});
  }

  function taskRow(task) {
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.task = task.id;
    button.textContent = task.title;
    button.setAttribute('aria-pressed', String(task === activeTask));
    button.addEventListener('click', () => selectVideo(task, true));
    row.append(button);
    return row;
  }

  function start(tasks) {
    const categories = new Map();
    for (const task of tasks) {
      if (!categories.has(task.category)) categories.set(task.category, []);
      categories.get(task.category).push(task);
    }
    const categoryOrder = [...Object.keys(categoryNames), ...categories.keys()];
    const buttons = [...new Set(categoryOrder)].filter((id) => categories.has(id)).map((id, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `task-category-tab-${index}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', categoryPanel.id);
      button.textContent = categoryNames[id] ?? id;
      button.addEventListener('click', () => showCategory(index));
      tabs.append(button);
      return { id, button };
    });

    function showCategory(index) {
      const { id, button } = buttons[index];
      const visible = categories.get(id);
      buttons.forEach((tab, i) => {
        tab.button.setAttribute('aria-selected', String(i === index));
        tab.button.tabIndex = i === index ? 0 : -1;
      });
      categoryPanel.setAttribute('aria-labelledby', button.id);
      results.replaceChildren(...visible.map(taskRow));
      if (!visible.includes(activeTask)) selectVideo(visible[0], false);
      results.scrollTop = 0;
    }

    tabs.addEventListener('keydown', (event) => {
      const index = buttons.findIndex(({ button }) => button === event.target);
      if (index < 0) return;
      let next;
      switch (event.key) {
        case 'ArrowRight': next = (index + 1) % buttons.length; break;
        case 'ArrowLeft': next = (index - 1 + buttons.length) % buttons.length; break;
        case 'Home': next = 0; break;
        case 'End': next = buttons.length - 1; break;
        default: return;
      }
      event.preventDefault();
      showCategory(next);
      buttons[next].button.focus();
    });

    if (buttons.length) {
      browser.hidden = false;
      showCategory(0);
    }
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    observer.disconnect();
    fetch(catalog).then((response) => {
      if (!response.ok) throw new Error(`Task catalog request failed (${response.status})`);
      return response.json();
    }).then(({ tasks }) => start(tasks)).catch(console.error);
  }, { rootMargin: '300px' });
  observer.observe(browser.closest('section'));
})();
