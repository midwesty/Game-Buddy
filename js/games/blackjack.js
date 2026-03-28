function makeDeck() {
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ rank:r, suit:s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function handValue(hand) {
  let total = 0, aces = 0;
  hand.forEach((c) => {
    if (c.rank === 'A') { total += 11; aces++; }
    else if (['K','Q','J'].includes(c.rank)) total += 10;
    else total += Number(c.rank);
  });
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}
function draw(state) { return state.deck.pop(); }

export function createInitialState({ mode, players, wager = 25 }) {
  const deck = makeDeck();
  const playerHands = [{ id:'p1', cards:[deck.pop(), deck.pop()], bet: wager, stood:false, busted:false, doubled:false }];
  const dealer = { cards:[deck.pop(), deck.pop()], hidden:true, stood:false, busted:false };
  return { gameId:'blackjack', mode, players, wager, deck, playerHands, dealer, currentHand:0, phase:'player', status:'Your move', result:null, revealAll:false };
}

function settle(state) {
  const dealerValue = handValue(state.dealer.cards);
  const lines = [];
  let buddyDelta = 0;
  state.playerHands.forEach((hand, idx) => {
    const val = handValue(hand.cards);
    if (hand.busted) { lines.push(`Hand ${idx+1}: bust.`); buddyDelta -= hand.bet; return; }
    if (dealerValue > 21 || val > dealerValue) { lines.push(`Hand ${idx+1}: win.`); buddyDelta += hand.bet; }
    else if (val < dealerValue) { lines.push(`Hand ${idx+1}: lose.`); buddyDelta -= hand.bet; }
    else lines.push(`Hand ${idx+1}: push.`);
  });
  return { ...state, phase:'done', result: lines.join(' '), buddyDelta };
}

function advanceHand(state) {
  const hands = structuredClone(state.playerHands);
  let idx = state.currentHand;
  while (idx < hands.length && (hands[idx].stood || hands[idx].busted)) idx++;
  if (idx >= hands.length) return { ...state, playerHands:hands, phase:'dealer', currentHand:hands.length, status:'Dealer turn' };
  return { ...state, playerHands:hands, currentHand:idx, status:`Hand ${idx+1} to act` };
}

export function handleAction(state, action) {
  if (state.phase === 'done') return state;
  if (state.phase === 'dealer') {
    const dealer = structuredClone(state.dealer); dealer.hidden = false;
    let deck = [...state.deck];
    while (handValue(dealer.cards) < 17) dealer.cards.push(deck.pop());
    dealer.stood = true;
    dealer.busted = handValue(dealer.cards) > 21;
    return settle({ ...state, dealer, deck, status:'Dealer stands' });
  }
  const hands = structuredClone(state.playerHands);
  let deck = [...state.deck];
  const hand = hands[state.currentHand];
  if (!hand) return state;
  if (action.type === 'hit') {
    hand.cards.push(deck.pop());
    if (handValue(hand.cards) > 21) hand.busted = true;
  }
  if (action.type === 'stand') hand.stood = true;
  if (action.type === 'double' && hand.cards.length === 2) {
    hand.bet *= 2; hand.doubled = true; hand.cards.push(deck.pop()); hand.stood = true; if (handValue(hand.cards) > 21) hand.busted = true;
  }
  if (action.type === 'split' && hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank) {
    const c2 = hand.cards.pop();
    hands.splice(state.currentHand + 1, 0, { id: `${hand.id}-split`, cards:[c2, deck.pop()], bet: hand.bet, stood:false, busted:false, doubled:false });
    hand.cards.push(deck.pop());
  }
  const next = advanceHand({ ...state, playerHands:hands, deck });
  if (next.phase === 'dealer') return handleAction(next, { type:'dealer' });
  return next;
}

function cardHtml(card, hidden=false, tiny=false) {
  if (hidden) return `<div class="playing-card back ${tiny?'tiny':''}"><div class="card-center">🎴</div></div>`;
  const red = ['♥','♦'].includes(card.suit) ? 'style="color:#a2233e"' : '';
  return `<div class="playing-card ${tiny?'tiny':''}" ${red}><div class="card-corner">${card.rank}${card.suit}</div><div class="card-center">${card.suit}</div><div class="card-corner" style="transform:rotate(180deg); align-self:flex-end;">${card.rank}${card.suit}</div></div>`;
}

export function render(state, ctx) {
  const root = document.createElement('div'); root.className='game-shell fade-in';
  const shell = document.createElement('div'); shell.className='center-board';
  const wrap = document.createElement('div'); wrap.style.width='100%';
  const dealerVal = state.dealer.hidden && !state.revealAll ? '?' : handValue(state.dealer.cards);
  wrap.innerHTML = `
    <div class="seat-row">
      <div class="seat ${state.phase==='dealer'?'active arcade-spark':''}">
        <strong>Dealer</strong>
        <div class="mini-text">Value: ${dealerVal}</div>
        <div class="card-row">${state.dealer.cards.map((c, i) => cardHtml(c, i===1 && state.dealer.hidden && !state.revealAll && state.phase!=='done')).join('')}</div>
      </div>
    </div>
    <div class="seat-row">${state.playerHands.map((hand, idx) => `
      <div class="seat ${idx===state.currentHand && state.phase==='player'?'active pulse':''}">
        <strong>Hand ${idx+1}</strong>
        <div class="mini-text">Bet: ${hand.bet} · Value: ${handValue(hand.cards)}${hand.busted ? ' · Bust' : ''}</div>
        <div class="card-row">${hand.cards.map((c) => cardHtml(c)).join('')}</div>
      </div>`).join('')}</div>`;
  shell.append(wrap); root.append(shell);
  ctx.setInfo(`<div class="match-banner">${state.result || state.status}</div><div class="mini-text">Dealer stands on 17. Split and double are available when legal.</div>`);
  const hand = state.playerHands[state.currentHand];
  ctx.setActions(state.phase === 'player' ? `
    <div class="btn-row wrap">
      <button id="bjHit" class="action-btn primary">Hit</button>
      <button id="bjStand" class="action-btn">Stand</button>
      <button id="bjDouble" class="action-btn">Double</button>
      <button id="bjSplit" class="action-btn">Split</button>
    </div>
    <div class="mini-text">Current hand value: ${hand ? handValue(hand.cards) : '-'}</div>` : `<div class="mini-text">${state.result || 'Dealer resolving...'}</div>`);
  queueMicrotask(() => {
    document.getElementById('bjHit')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'hit'}), true));
    document.getElementById('bjStand')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'stand'}), true));
    document.getElementById('bjDouble')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'double'}), true));
    document.getElementById('bjSplit')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'split'}), true));
  });
  return root;
}
