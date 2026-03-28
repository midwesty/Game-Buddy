import { addLog, showMessage } from './ui.js';
import { clearMatch } from './storage.js';
import { getActiveProfile, persistRoot, undoMatch, redoMatch } from './state.js';

export function wireAdmin({ root, getMatch, setMatch, rerender, autoplayTurn }) {
  document.getElementById('cheatAdd500Btn').onclick = () => {
    const profile = getActiveProfile(root);
    if (profile && !profile.isGuest) {
      profile.buddyBucks += 500;
      persistRoot(root);
      addLog('Cheat used: +500 Buddy Bucks.');
      rerender();
    } else {
      showMessage('Guest Mode', 'Switch to a saved profile to bank Buddy Bucks.');
    }
  };
  document.getElementById('cheatRevealBtn').onclick = () => {
    const match = getMatch();
    if (!match) return;
    match.revealAll = !match.revealAll;
    setMatch(match);
    addLog(`Reveal mode ${match.revealAll ? 'enabled' : 'disabled'}.`);
    rerender();
  };
  document.getElementById('cheatAutoplayBtn').onclick = () => autoplayTurn();
  document.getElementById('cheatUndoBtn').onclick = () => {
    const current = getMatch();
    if (!current) return;
    const prev = undoMatch(root, current);
    if (prev) { setMatch(prev); rerender(); addLog('Undo applied.'); }
  };
  document.getElementById('cheatRedoBtn').onclick = () => {
    const current = getMatch();
    if (!current) return;
    const next = redoMatch(root, current);
    if (next) { setMatch(next); rerender(); addLog('Redo applied.'); }
  };
  document.getElementById('cheatResetMatchBtn').onclick = () => {
    clearMatch();
    setMatch(null);
    addLog('Current match cleared.');
    rerender();
  };
  document.getElementById('cheatClearSavesBtn').onclick = () => {
    clearMatch();
    addLog('Saved match removed from storage.');
    showMessage('Saved Match Removed', 'The current saved match was deleted.');
  };
}
