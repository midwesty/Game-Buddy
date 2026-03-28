import { saveBuilderTable, getBuilderTables } from './state.js';
import { showMessage } from './ui.js';

let builderState = null;
let presets = null;

function makeToken(def, x = 40, y = 40) {
  return { id: crypto.randomUUID(), type: def.id || 'custom', emoji: def.emoji || null, image: def.image || null, x, y, label: def.label || def.id || 'Token' };
}

function renderStage() {
  const stage = document.getElementById('builderStage');
  stage.innerHTML = '';
  stage.style.background = presets.boards.find((b) => b.id === builderState.boardId)?.background || presets.boards[0].background;
  builderState.tokens.forEach((token) => {
    const el = document.createElement('div');
    el.className = 'builder-token token-glow';
    el.style.left = `${token.x}px`;
    el.style.top = `${token.y}px`;
    el.dataset.id = token.id;
    el.innerHTML = token.image ? `<img src="${token.image}" alt="${token.label}" />` : `<span style="font-size:1.8rem;">${token.emoji || '⭐'}</span>`;
    stage.append(el);
    let drag = false, ox = 0, oy = 0;
    const start = (clientX, clientY) => { drag = true; ox = clientX - token.x; oy = clientY - token.y; };
    const move = (clientX, clientY) => {
      if (!drag) return;
      token.x = Math.max(0, clientX - ox - stage.getBoundingClientRect().left);
      token.y = Math.max(0, clientY - oy - stage.getBoundingClientRect().top);
      el.style.left = `${token.x}px`; el.style.top = `${token.y}px`;
    };
    el.addEventListener('mousedown', (e) => start(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
    window.addEventListener('mouseup', () => drag = false);
    el.addEventListener('touchstart', (e) => { const t = e.touches[0]; start(t.clientX, t.clientY); }, { passive:true });
    window.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY); }, { passive:true });
    window.addEventListener('touchend', () => drag = false);
  });
}

export function initBuilder(builderPresets, openInPlayArea) {
  presets = builderPresets;
  builderState = { id: crypto.randomUUID(), title: 'My Custom Table', rules: '', minPlayers: 2, maxPlayers: 4, boardId: presets.boards[0].id, tokens: [] };
  const boardSelect = document.getElementById('builderBoardSelect');
  boardSelect.innerHTML = presets.boards.map((b) => `<option value="${b.id}">${b.name}</option>`).join('');
  boardSelect.onchange = () => { builderState.boardId = boardSelect.value; renderStage(); };
  const palette = document.getElementById('builderPiecePalette');
  palette.innerHTML = presets.pieces.map((p) => `<button class="palette-piece" data-piece="${p.id}" title="${p.label}"><span>${p.emoji}</span></button>`).join('');
  palette.querySelectorAll('[data-piece]').forEach((btn) => btn.addEventListener('click', () => {
    const def = presets.pieces.find((p) => p.id === btn.dataset.piece);
    builderState.tokens.push(makeToken(def, 30 + builderState.tokens.length * 20, 30 + builderState.tokens.length * 16));
    renderStage();
  }));
  document.getElementById('builderUploadInput').onchange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const dataUrl = await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(file); });
    builderState.tokens.push(makeToken({ id:'custom-image', label:file.name, image:dataUrl }, 60, 60));
    renderStage();
  };
  document.getElementById('builderSaveBtn').onclick = () => {
    builderState.title = document.getElementById('builderTitleInput').value || 'My Custom Table';
    builderState.rules = document.getElementById('builderRulesInput').value || '';
    builderState.minPlayers = Number(document.getElementById('builderMinPlayers').value || 2);
    builderState.maxPlayers = Number(document.getElementById('builderMaxPlayers').value || 4);
    saveBuilderTable(structuredClone(builderState));
    showMessage('Table Saved', `Saved <strong>${builderState.title}</strong> to local storage.`);
  };
  document.getElementById('builderExportBtn').onclick = () => {
    const json = JSON.stringify(builderState, null, 2);
    navigator.clipboard.writeText(json).catch(() => {});
    showMessage('Table Exported', 'Your custom table JSON was copied to the clipboard.');
  };
  document.getElementById('builderRenderBtn').onclick = () => openInPlayArea(structuredClone(builderState), presets);
  renderStage();
}

export function loadSavedBuilderTable() {
  const tables = getBuilderTables();
  if (!tables.length) {
    showMessage('No Saved Tables', 'Save a custom tabletop first, then load it from here.');
    return null;
  }
  builderState = structuredClone(tables[0]);
  document.getElementById('builderTitleInput').value = builderState.title;
  document.getElementById('builderRulesInput').value = builderState.rules || '';
  document.getElementById('builderMinPlayers').value = builderState.minPlayers || 2;
  document.getElementById('builderMaxPlayers').value = builderState.maxPlayers || 4;
  document.getElementById('builderBoardSelect').value = builderState.boardId;
  renderStage();
  showMessage('Custom Table Loaded', `Loaded <strong>${builderState.title}</strong>.`);
  return builderState;
}

export function renderBuilderTableInPlayArea(table, presets, container) {
  const board = presets.boards.find((b) => b.id === table.boardId) || presets.boards[0];
  container.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'builder-stage'; wrap.style.background = board.background; wrap.style.width = '100%'; wrap.style.minHeight = '100%';
  table.tokens.forEach((token) => {
    const el = document.createElement('div'); el.className = 'builder-token token-glow'; el.style.left = `${token.x}px`; el.style.top = `${token.y}px`;
    el.innerHTML = token.image ? `<img src="${token.image}" alt="${token.label}" />` : `<span style="font-size:1.8rem;">${token.emoji || '⭐'}</span>`;
    wrap.append(el);
  });
  container.append(wrap);
}
