import { loadRoot, saveRoot, loadMatch, saveMatch, loadBuilderTables, saveBuilderTables } from './storage.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_SETTINGS = {
  musicEnabled: true,
  sfxEnabled: true,
  tipsEnabled: true,
  flairEnabled: true,
  selectedMusic: 'track1',
  dashboardTheme: 'retro-dashboard',
  roomTheme: 'retro-room',
};

export function createInitialRoot() {
  return {
    profiles: [],
    activeProfileId: null,
    guestMode: false,
    settings: { ...DEFAULT_SETTINGS },
    historyUndo: [],
    historyRedo: [],
  };
}

export function ensureRoot() {
  return loadRoot() || createInitialRoot();
}

export function persistRoot(root) {
  saveRoot(root);
}

export function getActiveProfile(root) {
  if (root.guestMode) {
    return {
      id: 'guest',
      name: 'Guest',
      avatar: 'assets/img/avatars/avatar-01.png',
      buddyBucks: 500,
      stats: { wins: 0, losses: 0, pushes: 0, played: 0 },
      matchHistory: [],
      lastDailyRewardAt: null,
      isGuest: true,
    };
  }
  return root.profiles.find((p) => p.id === root.activeProfileId) || null;
}

export function makeProfile(name, avatar) {
  return {
    id: crypto.randomUUID(),
    name,
    avatar,
    buddyBucks: 500,
    stats: { wins: 0, losses: 0, pushes: 0, played: 0 },
    matchHistory: [],
    lastDailyRewardAt: null,
    settings: {},
  };
}

export function applyDailyReward(profile) {
  const now = Date.now();
  if (!profile.lastDailyRewardAt || now - profile.lastDailyRewardAt >= DAY_MS) {
    profile.lastDailyRewardAt = now;
    profile.buddyBucks += 20;
    return 20;
  }
  return 0;
}

export function upsertProfile(root, profile) {
  const idx = root.profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) root.profiles[idx] = profile;
  else root.profiles.push(profile);
  if (!root.activeProfileId) root.activeProfileId = profile.id;
  persistRoot(root);
}

export function setActiveProfile(root, profileId) {
  root.activeProfileId = profileId;
  root.guestMode = false;
  persistRoot(root);
}

export function enableGuestMode(root) {
  root.guestMode = true;
  persistRoot(root);
}

export function updateSettings(root, patch) {
  root.settings = { ...root.settings, ...patch };
  persistRoot(root);
}

export function saveCurrentMatch(match) { saveMatch(match); }
export function loadCurrentMatch() { return loadMatch(); }

export function pushUndo(root, matchSnapshot) {
  root.historyUndo.push(structuredClone(matchSnapshot));
  if (root.historyUndo.length > 20) root.historyUndo.shift();
  root.historyRedo = [];
  persistRoot(root);
}

export function undoMatch(root, currentMatch) {
  const prev = root.historyUndo.pop();
  if (!prev) return null;
  root.historyRedo.push(structuredClone(currentMatch));
  persistRoot(root);
  return prev;
}

export function redoMatch(root, currentMatch) {
  const next = root.historyRedo.pop();
  if (!next) return null;
  root.historyUndo.push(structuredClone(currentMatch));
  persistRoot(root);
  return next;
}

export function recordMatchOutcome(root, outcome) {
  const profile = getActiveProfile(root);
  if (!profile || profile.isGuest) return;
  profile.stats.played += 1;
  if (outcome.result === 'win') profile.stats.wins += 1;
  else if (outcome.result === 'loss') profile.stats.losses += 1;
  else profile.stats.pushes += 1;
  if (typeof outcome.buddyDelta === 'number') {
    profile.buddyBucks = Math.max(0, profile.buddyBucks + outcome.buddyDelta);
  }
  profile.matchHistory.unshift({
    at: new Date().toISOString(),
    ...outcome,
  });
  profile.matchHistory = profile.matchHistory.slice(0, 50);
  upsertProfile(root, profile);
}

export function getBuilderTables() { return loadBuilderTables(); }
export function saveBuilderTable(table) {
  const tables = loadBuilderTables();
  const idx = tables.findIndex((t) => t.id === table.id);
  if (idx >= 0) tables[idx] = table;
  else tables.unshift(table);
  saveBuilderTables(tables.slice(0, 30));
}
