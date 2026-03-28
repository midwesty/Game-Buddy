function makeDeck() {
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ rank:r, suit:s, faceUp:false });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
const rankVal = (r) => ['A','2','3','4','5','6','7','8','9','10','J','Q','K'].indexOf(r) + 1;
const isRed = (s) => ['♥','♦'].includes(s);

export function createInitialState({ mode, players, wager = 0 }) {
  const deck = makeDeck();
  const tableau = Array.from({ length: 7 }, (_, i) => {
    const pile = [];
    for (let j = 0; j <= i; j++) pile.push(deck.pop());
    pile[pile.length - 1].faceUp = true;
    return pile;
  });
  return { gameId:'solitaire', mode, players, wager, stock: deck, waste: [], foundations: { '♠':[], '♥':[], '♦':[], '♣':[] }, tableau, selected:null, status:'Klondike draw-3', result:null };
}

function cardHtml(card, back=false, tiny=false) {
  if (back || !card.faceUp) return `<div class="playing-card back ${tiny?'tiny':''}"><div class="card-center">🎴</div></div>`;
  const red = isRed(card.suit) ? 'style="color:#a2233e"' : '';
  return `<div class="playing-card ${tiny?'tiny':''}" ${red}><div class="card-corner">${card.rank}${card.suit}</div><div class="card-center">${card.suit}</div><div class="card-corner" style="transform:rotate(180deg);align-self:flex-end;">${card.rank}${card.suit}</div></div>`;
}

function canPlaceOnTableau(card, destTop) {
  if (!destTop) return card.rank === 'K';
  return isRed(card.suit) !== isRed(destTop.suit) && rankVal(card.rank) === rankVal(destTop.rank) - 1;
}
function canPlaceOnFoundation(card, pile) {
  if (!pile.length) return card.rank === 'A';
  const top = pile[pile.length - 1];
  return top.suit === card.suit && rankVal(card.rank) === rankVal(top.rank) + 1;
}

export function handleAction(state, action) {
  const next = structuredClone(state);
  if (action.type === 'draw') {
    if (!next.stock.length) {
      next.stock = next.waste.reverse().map((c)=>({ ...c, faceUp:false }));
      next.waste = [];
      return next;
    }
    for (let i=0; i<3 && next.stock.length; i++) {
      const c = next.stock.pop(); c.faceUp = true; next.waste.push(c);
    }
    return next;
  }
  if (action.type === 'selectWaste') {
    next.selected = { zone:'waste', index: next.waste.length - 1 };
    return next;
  }
  if (action.type === 'selectTableau') {
    const pile = next.tableau[action.pile];
    const idx = action.index;
    if (!pile[idx]?.faceUp) return next;
    next.selected = { zone:'tableau', pile: action.pile, index: idx };
    return next;
  }
  if (action.type === 'toFoundation') {
    let card = null, source = null;
    if (next.selected?.zone === 'waste') { card = next.waste[next.waste.length-1]; source='waste'; }
    if (next.selected?.zone === 'tableau') { const pile = next.tableau[next.selected.pile]; card = pile[next.selected.index]; source='tableau'; }
    if (!card || !canPlaceOnFoundation(card, next.foundations[card.suit])) return next;
    next.foundations[card.suit].push(card);
    if (source === 'waste') next.waste.pop();
    else {
      next.tableau[next.selected.pile].splice(next.selected.index, 1);
      const pile = next.tableau[next.selected.pile]; if (pile.length) pile[pile.length - 1].faceUp = true;
    }
    next.selected = null;
  }
  if (action.type === 'toTableau') {
    let moving = [], source = null;
    if (next.selected?.zone === 'waste') { moving = [next.waste[next.waste.length-1]]; source='waste'; }
    if (next.selected?.zone === 'tableau') { moving = next.tableau[next.selected.pile].slice(next.selected.index); source='tableau'; }
    if (!moving.length) return next;
    const destPile = next.tableau[action.pile];
    if (!canPlaceOnTableau(moving[0], destPile[destPile.length-1])) return next;
    destPile.push(...moving);
    if (source === 'waste') next.waste.pop();
    else {
      next.tableau[next.selected.pile].splice(next.selected.index);
      const pile = next.tableau[next.selected.pile]; if (pile.length) pile[pile.length-1].faceUp = true;
    }
    next.selected = null;
  }
  const won = Object.values(next.foundations).every((pile) => pile.length === 13);
  if (won) { next.result = 'You cleared the table!'; }
  return next;
}

export function render(state, ctx) {
  const root = document.createElement('div'); root.className='game-shell fade-in';
  const wrap = document.createElement('div'); wrap.className='center-board';
  const host = document.createElement('div'); host.style.width='100%';
  const foundations = ['♠','♥','♦','♣'].map((s) => `<div class="card-slot ${state.selected?.foundation===s?'highlight':''}" data-foundation="${s}" style="display:grid;place-items:center;">${state.foundations[s].length ? cardHtml(state.foundations[s][state.foundations[s].length-1], false, true) : `<div class="playing-card tiny"><div class="card-center">${s}</div></div>`}</div>`).join('');
  host.innerHTML = `
    <div class="seat-row">
      <div class="stack-area">
        <div id="soliStock" class="playing-card back" data-tip="Draw three cards from the stock."></div>
        <div id="soliWaste" class="stack-area">${state.waste.slice(-3).map((c)=>cardHtml(c,false,true)).join('') || '<div class="playing-card tiny"><div class="card-center">∅</div></div>'}</div>
      </div>
      <div class="stack-area">${foundations}</div>
    </div>
    <div class="seat-row" style="align-items:flex-start; margin-top:14px;">${state.tableau.map((pile, pileIndex) => `
      <div class="stack-area" style="flex-direction:column; gap:4px; min-width:68px;">${pile.map((c, idx)=>`<div class="soli-card" data-pile="${pileIndex}" data-index="${idx}" style="margin-top:${idx===0?0:-78}px;">${cardHtml(c,!c.faceUp)}</div>`).join('') || `<div class="playing-card tiny" data-pile-target="${pileIndex}"><div class="card-center">⬚</div></div>`}</div>`).join('')}</div>`;
  wrap.append(host); root.append(wrap);
  ctx.setInfo(`<div class="match-banner">${state.result || state.status}</div><div class="mini-text">Tap stock to draw. Tap a waste or tableau card to select it, then tap a tableau pile or matching foundation suit.</div>`);
  ctx.setActions(`<div class="mini-text">Klondike draw-3. Builder and multiplayer do not apply here; this is your solo table.</div>`);
  queueMicrotask(() => {
    document.getElementById('soliStock')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'draw'}), true));
    document.getElementById('soliWaste')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'selectWaste'}), true));
    document.querySelectorAll('[data-foundation]').forEach((el)=>el.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'toFoundation'}), true)));
    document.querySelectorAll('.soli-card').forEach((el)=>el.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'selectTableau', pile:Number(el.dataset.pile), index:Number(el.dataset.index)}), true)));
    document.querySelectorAll('[data-pile-target]').forEach((el)=>el.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'toTableau', pile:Number(el.dataset.pileTarget)}), true)));
    document.querySelectorAll('.stack-area[data-pile-target]').forEach((el)=>el.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'toTableau', pile:Number(el.dataset.pileTarget)}), true)));
  });
  return root;
}
