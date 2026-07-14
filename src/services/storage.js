const storageKey = "dark-personality-test-state-v1";

export function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // The app can still run if storage is unavailable in a restricted browser.
  }
}

export function clearState() {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Ignore storage cleanup failures.
  }
}
