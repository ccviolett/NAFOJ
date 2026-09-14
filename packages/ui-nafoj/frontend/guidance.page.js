import { AutoloadPage } from '@hydrooj/ui-default';

const STORAGE_KEY = 'nafoj:guidance';

function readState() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function writeState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const guidancePage = new AutoloadPage('nafojGuidancePage', () => {
  const root = document.querySelector('[data-guidance-root]');
  if (!root) return;

  const state = readState();
  if (state.dismissed) {
    root.remove();
    return;
  }

  root.querySelectorAll('[data-guidance-check]').forEach((checkbox) => {
    const key = checkbox.getAttribute('data-guidance-check');
    const item = checkbox.closest('[data-step]');
    const mark = () => {
      item.classList.toggle('is-done-manual', checkbox.checked);
      state[key] = checkbox.checked;
      writeState(state);
    };
    checkbox.checked = !!state[key];
    mark();
    checkbox.addEventListener('change', mark);
  });

  const dismiss = root.querySelector('[data-guidance-dismiss]');
  dismiss?.addEventListener('click', () => {
    state.dismissed = true;
    writeState(state);
    root.remove();
  });
});

export default guidancePage;
