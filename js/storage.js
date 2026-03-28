export const KEYS = {
  ROOT: 'gameBuddy.root',
  MATCH: 'gameBuddy.currentMatch',
  BUILDER: 'gameBuddy.builderTables',
};

export function loadRoot() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.ROOT)) || null;
  } catch {
    return null;
  }
}

export function saveRoot(root) {
  localStorage.setItem(KEYS.ROOT, JSON.stringify(root));
}

export function loadMatch() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.MATCH)) || null;
  } catch {
    return null;
  }
}

export function saveMatch(match) {
  localStorage.setItem(KEYS.MATCH, JSON.stringify(match));
}

export function clearMatch() {
  localStorage.removeItem(KEYS.MATCH);
}

export function loadBuilderTables() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.BUILDER)) || [];
  } catch {
    return [];
  }
}

export function saveBuilderTables(tables) {
  localStorage.setItem(KEYS.BUILDER, JSON.stringify(tables));
}

export function clearAllStorage() {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}
