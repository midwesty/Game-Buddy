import { AudioManager } from './audio.js';
import { getGameModule, buildPlayerSeats } from './gameRegistry.js';
import { bindModalCloseButtons, renderProfileSummary, renderProfilesList, populateSelect, initTooltips, setStatus, setRoomTitle, setGameInfo, setActions, setPlayArea, addLog, showMessage, applyThemeBackgrounds, qs } from './ui.js';
import { ensureRoot, persistRoot, makeProfile, applyDailyReward, upsertProfile, setActiveProfile, enableGuestMode, updateSettings, getActiveProfile, loadCurrentMatch, saveCurrentMatch, pushUndo, recordMatchOutcome } from './state.js';
import { clearMatch } from './storage.js';
import { encodeMatch, decodeMatch } from './multiplayer.js';
import { wireAdmin } from './admin.js';
import { initBuilder, loadSavedBuilderTable, renderBuilderTableInPlayArea } from './builder.js';

const avatarPaths = Array.from({ length: 5 }, (_, i) => `assets/img/avatars/avatar-0${i + 1}.png`);
let root = ensureRoot();
let match = loadCurrentMatch();
let gameCatalog = [];
let themes = null;
let audioManifest = null;
let helpText = null;
let builderPresets = null;
let audio = null;
let selectedAvatar = avatarPaths[0];
let botTimer = null;

async function loadJson(path) {
  const res = await fetch(path);
  return res.json();
}

function activeProfileName() {
  return getActiveProfile(root)?.name || 'Player';
}

function getSettings() {
  return root.settings || {};
}

function persistEverything() {
  persistRoot(root);
  if (match) saveCurrentMatch(match);
}

function clearBotTimer() {
  if (botTimer) {
    clearTimeout(botTimer);
    botTimer = null;
  }
}

function saveAll() {
  persistEverything();
}

function updateProfileUI() {
  renderProfileSummary(getActiveProfile(root));
  renderProfilesList(root, (profileId) => {
    setActiveProfile(root, profileId);
    const reward = applyDailyReward(getActiveProfile(root));
    saveAll();
    updateProfileUI();
    if (reward) addLog(`Daily login reward: +${reward} Buddy Bucks.`);
    qs('profilesModal').close();
    renderAll();
  });
}

function setupAvatarPicker() {
  const picker = qs('avatarPicker');
  picker.innerHTML = '';
  avatarPaths.forEach((path) => {
    const btn = document.createElement('button');
    btn.className = `avatar-option ${path === selectedAvatar ? 'selected' : ''}`;
    btn.innerHTML = `<img src="${path}" alt="Avatar" />`;
    btn.onclick = () => {
      selectedAvatar = path;
      setupAvatarPicker();
    };
    picker.append(btn);
  });
}

function applySettingsToUi() {
  qs('musicEnabledToggle').checked = !!getSettings().musicEnabled;
  qs('sfxEnabledToggle').checked = !!getSettings().sfxEnabled;
  qs('tipsEnabledToggle').checked = !!getSettings().tipsEnabled;
  qs('flairEnabledToggle').checked = !!getSettings().flairEnabled;
  qs('musicTrackSelect').value = getSettings().selectedMusic;
  qs('dashboardThemeSelect').value = getSettings().dashboardTheme;
  qs('roomThemeSelect').value = getSettings().roomTheme;
  const roomTheme = themes.roomThemes.find((x) => x.id === getSettings().roomTheme);
  const dashboardTheme = themes.dashboardThemes.find((x) => x.id === getSettings().dashboardTheme);
  applyThemeBackgrounds(roomTheme, dashboardTheme);
  setRoomTitle(roomTheme?.name || 'Game Room');
  audio.applyTrack(getSettings().selectedMusic);
  audio.setMusicEnabled(getSettings().musicEnabled);
}

function settleProfileIfNeeded() {
  if (!match?.result || match.outcomeRecorded) return;
  let result = 'push';
  let buddyDelta = match.buddyDelta || 0;
  const gameName = gameCatalog.find((g) => g.id === match.gameId)?.name || match.gameId;

  if (match.gameId === 'chess' || match.gameId === 'checkers') {
    if (match.winner === 'white') {
      result = 'win';
      buddyDelta = match.wager || 0;
    } else if (match.winner === 'black') {
      result = 'loss';
      buddyDelta = -(match.wager || 0);
    }
  }
  if (match.gameId === 'pitch') {
    const playerTeam = 0;
    if (match.winnerTeam === playerTeam) {
      result = 'win';
      buddyDelta = match.wager || 0;
    } else if (typeof match.winnerTeam === 'number') {
      result = 'loss';
      buddyDelta = -(match.wager || 0);
    }
  }
  if (match.gameId === 'solitaire') {
    result = 'win';
    buddyDelta = 0;
  }
  if (match.gameId === 'blackjack' || match.gameId === 'holdem') {
    result = buddyDelta > 0 ? 'win' : buddyDelta < 0 ? 'loss' : 'push';
  }
  recordMatchOutcome(root, {
    gameId: match.gameId,
    gameName,
    result,
    buddyDelta,
    note: match.result,
    participants: match.players?.map((p) => p.name).join(', ') || '',
  });
  match.outcomeRecorded = true;
  persistEverything();
}

function onStateChange(newState, pushHistory = false) {
  if (!newState) return;
  clearBotTimer();
  if (pushHistory && match) pushUndo(root, match);
  match = newState;
  if (match) saveCurrentMatch(match);
  renderAll();
}

function autoplayIfBotTurn() {
  clearBotTimer();
  if (!match || match.result) return;
  const scheduledGameId = match.gameId;
  const mod = getGameModule(match.gameId);
  if (!mod?.getAiMove) return;
  const aiAction = mod.getAiMove(match);
  if (!aiAction) return;
  botTimer = setTimeout(() => {
    botTimer = null;
    if (!match || match.result || match.gameId !== scheduledGameId) return;
    let next = mod.handleAction(match, aiAction);
    if (aiAction.followup) next = mod.handleAction(next, { type: 'select', row: aiAction.followup.row, col: aiAction.followup.col });
    onStateChange(next, true);
    if (next && !next.result) autoplayIfBotTurn();
  }, 420);
}

function endCurrentMatch(finalState = null, note = 'Cleared the current table.') {
  clearBotTimer();
  if (finalState) {
    match = finalState;
    if (match?.result && !match.outcomeRecorded) settleProfileIfNeeded();
  }
  match = null;
  clearMatch();
  persistRoot(root);
  renderAll();
  addLog(note);
}

function restartCurrentMatch() {
  if (!match) return;
  clearBotTimer();
  const mod = getGameModule(match.gameId);
  const activeProfile = getActiveProfile(root);
  let bankroll = typeof match.bankroll === 'number' ? match.bankroll : activeProfile?.buddyBucks ?? 500;
  if (match.gameId === 'blackjack') {
    if (match.result || match.outcomeRecorded) bankroll = activeProfile?.buddyBucks ?? bankroll;
  }
  match = mod.createInitialState({ mode: match.mode, players: match.players, wager: match.wager, bankroll });
  root.historyUndo = [];
  root.historyRedo = [];
  saveAll();
  renderAll();
  autoplayIfBotTurn();
}

function renderCurrentGame() {
  const playArea = qs('playArea');
  playArea.innerHTML = '';
  if (!match) {
    setGameInfo('<div class="match-banner">No active match.</div>');
    setActions('<div class="mini-text">Start a match, resume your save, or open the custom tabletop builder.</div>');
    return;
  }
  const mod = getGameModule(match.gameId);
  const node = mod.render(match, {
    onStateChange,
    setInfo: setGameInfo,
    setActions,
    autoBotTurn: autoplayIfBotTurn,
    endMatch: (finalState = null, note) => endCurrentMatch(finalState, note || `Cleared ${gameCatalog.find((g) => g.id === match.gameId)?.name || match.gameId}.`),
    restartMatch: restartCurrentMatch,
  });
  setPlayArea(node);
}

function renderAll() {
  updateProfileUI();
  applySettingsToUi();
  settleProfileIfNeeded();
  renderCurrentGame();
  setStatus(match ? `Playing ${gameCatalog.find((g) => g.id === match.gameId)?.name || match.gameId}` : helpText.welcome);
}

function startNewMatch() {
  clearBotTimer();
  const gameId = qs('gameSelect').value;
  const mode = qs('modeSelect').value;
  const wager = Math.max(0, Number(qs('wagerInput').value || 0));
  const mod = getGameModule(gameId);
  const players = buildPlayerSeats(gameId, mode, activeProfileName());
  if (!mod) return;
  const profile = getActiveProfile(root);
  if (profile && !profile.isGuest && wager > profile.buddyBucks && gameCatalog.find((g) => g.id === gameId)?.supportsWager) {
    showMessage('Not Enough Buddy Bucks', 'Lower the wager or use the admin panel to add testing funds.');
    return;
  }
  match = mod.createInitialState({ mode, players, wager, bankroll: profile?.buddyBucks ?? 500 });
  root.historyUndo = [];
  root.historyRedo = [];
  saveAll();
  addLog(`Started ${gameCatalog.find((g) => g.id === gameId)?.name}.`);
  renderAll();
  autoplayIfBotTurn();
}

function openBuilderInPlay(table) {
  clearBotTimer();
  match = null;
  clearMatch();
  setGameInfo(`<div class="match-banner">${table.title}</div><div class="mini-text">Players: ${table.minPlayers}-${table.maxPlayers}</div>`);
  setActions(`<div class="mini-text">${table.rules || 'Custom tabletop loaded. Drag pieces in the builder to change the setup.'}</div>`);
  renderBuilderTableInPlayArea(table, builderPresets, qs('playArea'));
  setStatus(`Custom Table: ${table.title}`);
}

function wireEvents() {
  bindModalCloseButtons();
  initTooltips(() => getSettings().tipsEnabled);
  qs('menuToggle').onclick = () => qs('sidePanel').classList.toggle('open');
  qs('openProfilesBtn').onclick = () => qs('profilesModal').showModal();
  qs('guestModeBtn').onclick = () => {
    enableGuestMode(root);
    updateProfileUI();
    renderAll();
    addLog('Guest mode enabled.');
  };
  qs('createProfileBtn').onclick = () => {
    const name = qs('profileNameInput').value.trim();
    if (!name) return showMessage('Name Required', 'Give the new profile a display name first.');
    const profile = makeProfile(name, selectedAvatar);
    const reward = applyDailyReward(profile);
    upsertProfile(root, profile);
    setActiveProfile(root, profile.id);
    qs('profileNameInput').value = '';
    updateProfileUI();
    qs('profilesModal').close();
    renderAll();
    addLog(`Created profile ${profile.name}.${reward ? ` +${reward} Buddy Bucks daily reward.` : ''}`);
  };
  qs('newMatchBtn').onclick = startNewMatch;
  qs('resumeMatchBtn').onclick = () => {
    clearBotTimer();
    match = loadCurrentMatch();
    renderAll();
    autoplayIfBotTurn();
  };
  qs('exportCodeBtn').onclick = () => {
    if (!match) return showMessage('No Match', 'Start or resume a match first.');
    const code = encodeMatch(match);
    qs('shareCodeBox').value = code;
    navigator.clipboard.writeText(code).catch(() => {});
    showMessage('Match Code Created', 'The current match code is in the box and was also copied to your clipboard.');
  };
  qs('importCodeBtn').onclick = () => {
    try {
      clearBotTimer();
      const code = qs('shareCodeBox').value.trim();
      if (!code) throw new Error('Paste a match code first.');
      match = decodeMatch(code);
      saveCurrentMatch(match);
      renderAll();
      autoplayIfBotTurn();
      addLog('Imported a shared match code.');
    } catch (err) {
      showMessage('Code Problem', err.message || 'That code could not be decoded.');
    }
  };
  qs('quickSaveBtn').onclick = () => {
    const snapshot = { root, match };
    const text = JSON.stringify(snapshot, null, 2);
    navigator.clipboard.writeText(text).catch(() => {});
    saveAll();
    showMessage('Save Snapshot Ready', 'Your full profile and match snapshot was copied to the clipboard and also saved locally.');
  };
  qs('tipsToggleBtn').onclick = () => {
    updateSettings(root, { tipsEnabled: !getSettings().tipsEnabled });
    renderAll();
  };
  ['musicEnabledToggle', 'sfxEnabledToggle', 'tipsEnabledToggle', 'flairEnabledToggle', 'musicTrackSelect', 'dashboardThemeSelect', 'roomThemeSelect'].forEach((id) => {
    qs(id).addEventListener('change', () => {
      updateSettings(root, {
        musicEnabled: qs('musicEnabledToggle').checked,
        sfxEnabled: qs('sfxEnabledToggle').checked,
        tipsEnabled: qs('tipsEnabledToggle').checked,
        flairEnabled: qs('flairEnabledToggle').checked,
        selectedMusic: qs('musicTrackSelect').value,
        dashboardTheme: qs('dashboardThemeSelect').value,
        roomTheme: qs('roomThemeSelect').value,
      });
      renderAll();
    });
  });
  qs('openAdminBtn').onclick = () => qs('adminModal').showModal();
  qs('openBuilderBtn').onclick = () => qs('builderModal').showModal();
  qs('loadBuilderBtn').onclick = () => {
    loadSavedBuilderTable();
    qs('builderModal').showModal();
  };
}

async function boot() {
  [gameCatalog, themes, audioManifest, helpText, builderPresets] = await Promise.all([
    loadJson('data/games.json'),
    loadJson('data/themes.json'),
    loadJson('data/audio.json'),
    loadJson('data/help.json'),
    loadJson('data/builder-presets.json'),
  ]);
  audio = new AudioManager(audioManifest, getSettings);
  populateSelect('gameSelect', gameCatalog);
  populateSelect('musicTrackSelect', audioManifest.music);
  populateSelect('dashboardThemeSelect', themes.dashboardThemes);
  populateSelect('roomThemeSelect', themes.roomThemes);
  setupAvatarPicker();
  wireEvents();
  initBuilder(builderPresets, (table) => openBuilderInPlay(table));
  wireAdmin({
    root,
    getMatch: () => match,
    setMatch: (m) => {
      match = m;
      saveAll();
    },
    rerender: renderAll,
    autoplayTurn: autoplayIfBotTurn,
  });
  const active = getActiveProfile(root);
  if (active && !active.isGuest) {
    const reward = applyDailyReward(active);
    if (reward) addLog(`Daily login reward: +${reward} Buddy Bucks.`);
    upsertProfile(root, active);
  }
  updateProfileUI();
  renderAll();
  if (match) autoplayIfBotTurn();
  addLog(helpText.welcome);
  addLog(helpText.shareCode);
}

window.addEventListener('DOMContentLoaded', boot);
