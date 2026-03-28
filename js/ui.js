export function qs(id) { return document.getElementById(id); }

export function setStatus(text) { qs('statusLine').textContent = text; }
export function setRoomTitle(text) { qs('roomTitle').textContent = text; }
export function setGameInfo(html) { qs('gameInfoContent').innerHTML = html; }
export function setActions(html) { qs('actionsContent').innerHTML = html; }
export function clearPlayArea() { qs('playArea').innerHTML = ''; }
export function setPlayArea(node) { clearPlayArea(); qs('playArea').append(node); }

export function addLog(message) {
  const box = qs('logContent');
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const entry = document.createElement('div');
  entry.textContent = `[${time}] ${message}`;
  box.prepend(entry);
}

export function showMessage(title, bodyHtml) {
  qs('messageTitle').textContent = title;
  qs('messageBody').innerHTML = bodyHtml;
  qs('messageModal').showModal();
}

export function bindModalCloseButtons() {
  document.querySelectorAll('.close-modal').forEach((btn) => {
    btn.addEventListener('click', () => qs(btn.dataset.close).close());
  });
}

export function renderProfileSummary(profile) {
  const box = qs('profileSummary');
  if (!profile) {
    box.innerHTML = '<div class="mini-text">No active profile selected.</div>';
    return;
  }
  const recent = profile.matchHistory?.[0];
  box.innerHTML = `
    <div class="profile-card" style="margin:0;">
      <img src="${profile.avatar}" alt="Avatar" />
      <div class="meta">
        <div><strong>${profile.name}</strong>${profile.isGuest ? ' <span class="mini-text">(Guest)</span>' : ''}</div>
        <div class="mini-text">Buddy Bucks: ${profile.buddyBucks}</div>
        <div class="mini-text">W/L/P: ${profile.stats.wins}-${profile.stats.losses}-${profile.stats.pushes}</div>
        <div class="mini-text">Last: ${recent ? `${recent.gameName} / ${recent.result} / ${recent.buddyDelta >= 0 ? '+' : ''}${recent.buddyDelta ?? 0}` : 'No match history yet.'}</div>
      </div>
    </div>`;
}

export function renderProfilesList(root, onActivate) {
  const list = qs('profilesList');
  list.innerHTML = '';
  root.profiles.forEach((profile) => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.innerHTML = `
      <img src="${profile.avatar}" alt="${profile.name}" />
      <div class="meta">
        <div><strong>${profile.name}</strong></div>
        <div class="mini-text">Buddy Bucks: ${profile.buddyBucks}</div>
        <div class="mini-text">Played: ${profile.stats.played}</div>
      </div>
      <button class="action-btn">Use</button>`;
    card.querySelector('button').addEventListener('click', () => onActivate(profile.id));
    list.append(card);
  });
}

export function populateSelect(selectId, items, valueField = 'id', labelField = 'name') {
  const el = qs(selectId);
  el.innerHTML = '';
  items.forEach((item) => {
    const opt = document.createElement('option');
    opt.value = item[valueField];
    opt.textContent = item[labelField];
    el.append(opt);
  });
}

export function initTooltips(getTipsEnabled) {
  const tooltip = qs('tooltip');
  let holdTimer = null;
  const show = (text, x, y) => {
    if (!getTipsEnabled()) return;
    tooltip.textContent = text;
    tooltip.classList.remove('hidden');
    tooltip.style.left = `${x + 12}px`;
    tooltip.style.top = `${y + 12}px`;
  };
  const hide = () => tooltip.classList.add('hidden');
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tip]');
    if (!target) return;
    show(target.dataset.tip, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', (e) => {
    if (tooltip.classList.contains('hidden')) return;
    tooltip.style.left = `${e.clientX + 12}px`;
    tooltip.style.top = `${e.clientY + 12}px`;
  });
  document.addEventListener('mouseout', hide);
  document.addEventListener('touchstart', (e) => {
    const target = e.target.closest('[data-tip]');
    if (!target) return;
    const touch = e.touches[0];
    holdTimer = setTimeout(() => show(target.dataset.tip, touch.clientX, touch.clientY), 500);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    clearTimeout(holdTimer);
    setTimeout(hide, 1200);
  });
}

export function applyThemeBackgrounds(roomTheme, dashboardTheme) {
  if (dashboardTheme?.backgroundImage) {
    document.body.style.backgroundImage = `radial-gradient(circle at top, rgba(255,255,255,.04), transparent 20%), url('${dashboardTheme.backgroundImage}')`;
    document.body.style.backgroundSize = 'cover';
  }
  if (roomTheme?.backgroundImage) {
    qs('tableBackdrop').style.backgroundImage = `radial-gradient(circle at 50% 45%, rgba(255,255,255,.06), transparent 35%), url('${roomTheme.backgroundImage}')`;
    qs('tableBackdrop').style.backgroundSize = 'cover';
    qs('tableBackdrop').style.backgroundPosition = 'center';
  }
}
