const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const rankValue = (r) => RANKS.indexOf(r) + 2;
const isRed = (s) => ['♥','♦'].includes(s);

function makeDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ rank:r, suit:s });
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
function cardHtml(card, hidden=false) {
  if (hidden) return `<div class="playing-card back tiny"><div class="card-center">🎴</div></div>`;
  const red = isRed(card.suit) ? 'style="color:#a2233e"' : '';
  return `<div class="playing-card tiny" ${red}><div class="card-corner">${card.rank}${card.suit}</div><div class="card-center">${card.suit}</div><div class="card-corner" style="transform:rotate(180deg);align-self:flex-end;">${card.rank}${card.suit}</div></div>`;
}

function combinations(arr, k) {
  const out = [];
  const rec = (start, pick) => {
    if (pick.length === k) return out.push([...pick]);
    for (let i = start; i < arr.length; i++) { pick.push(arr[i]); rec(i+1, pick); pick.pop(); }
  };
  rec(0, []); return out;
}
function evaluate5(cards) {
  const vals = cards.map(c=>rankValue(c.rank)).sort((a,b)=>b-a);
  const counts = Object.values(vals.reduce((m,v)=>(m[v]=(m[v]||0)+1,m), {})).sort((a,b)=>b-a);
  const byVal = Object.entries(vals.reduce((m,v)=>(m[v]=(m[v]||0)+1,m), {})).map(([v,c])=>({v:Number(v), c})).sort((a,b)=>b.c-a.c||b.v-a.v);
  const flush = cards.every(c=>c.suit===cards[0].suit);
  let uniq = [...new Set(vals)].sort((a,b)=>b-a);
  let straight = uniq.length===5 && (uniq[0]-uniq[4]===4 || JSON.stringify(uniq)==='[14,5,4,3,2]');
  const straightHigh = JSON.stringify(uniq)==='[14,5,4,3,2]' ? 5 : uniq[0];
  if (straight && flush) return { rank:8, tiebreak:[straightHigh], label:'Straight Flush' };
  if (counts[0]===4) return { rank:7, tiebreak:[byVal[0].v, byVal[1].v], label:'Four of a Kind' };
  if (counts[0]===3 && counts[1]===2) return { rank:6, tiebreak:[byVal[0].v, byVal[1].v], label:'Full House' };
  if (flush) return { rank:5, tiebreak:vals, label:'Flush' };
  if (straight) return { rank:4, tiebreak:[straightHigh], label:'Straight' };
  if (counts[0]===3) return { rank:3, tiebreak:[byVal[0].v, ...byVal.slice(1).map(x=>x.v)], label:'Three of a Kind' };
  if (counts[0]===2 && counts[1]===2) return { rank:2, tiebreak:[Math.max(byVal[0].v, byVal[1].v), Math.min(byVal[0].v, byVal[1].v), byVal[2].v], label:'Two Pair' };
  if (counts[0]===2) return { rank:1, tiebreak:[byVal[0].v, ...byVal.slice(1).map(x=>x.v)], label:'Pair' };
  return { rank:0, tiebreak:vals, label:'High Card' };
}
function compareHands(a,b){ if(a.rank!==b.rank)return a.rank-b.rank; for(let i=0;i<Math.max(a.tiebreak.length,b.tiebreak.length);i++){const d=(a.tiebreak[i]||0)-(b.tiebreak[i]||0); if(d!==0)return d;} return 0; }
function bestOfSeven(cards) { return combinations(cards,5).map(evaluate5).sort(compareHands).at(-1); }

function nextActiveIndex(state, from = state.currentSeat + 1) {
  for (let i = 0; i < state.seats.length; i++) {
    const idx = (from + i) % state.seats.length;
    const s = state.seats[idx];
    if (s.inHand && !s.folded && !s.allIn) return idx;
  }
  return -1;
}

function activePlayers(state) { return state.seats.filter(s=>s.inHand && !s.folded); }
function highestBet(state) { return Math.max(...state.seats.map(s=>s.roundBet || 0)); }
function allBetsEqual(state) {
  const high = highestBet(state);
  return state.seats.filter(s=>s.inHand && !s.folded && !s.allIn).every(s => (s.roundBet||0) === high);
}

function freshRound(state) {
  state.seats.forEach(s => { s.roundBet = 0; s.acted = false; });
}

function dealState(players, baseWager=25) {
  const deck = makeDeck();
  const seats = players.slice(0,6).map((p, idx) => ({
    id: p.id, name: p.name, isBot: !!p.isBot, chips: 500 + (p.id === 'p1' ? baseWager : 0), cards:[deck.pop(), deck.pop()], folded:false, inHand:true, allIn:false, roundBet:0, totalBet:0, acted:false,
  }));
  return { deck, seats, community:[], pot:0, currentSeat:0, dealerIndex:0, smallBlind:10, bigBlind:20, stage:'preflop', minRaise:20, status:'Blinds posted', revealAll:false, result:null, wager:baseWager };
}

function postBlind(state, idx, amount) {
  const seat = state.seats[idx];
  const paid = Math.min(amount, seat.chips);
  seat.chips -= paid; seat.roundBet += paid; seat.totalBet += paid; state.pot += paid; if (seat.chips===0) seat.allIn = true;
}

export function createInitialState({ mode, players, wager = 25 }) {
  const state = { gameId:'holdem', mode, players, ...dealState(players, wager) };
  postBlind(state, (state.dealerIndex + 1) % state.seats.length, state.smallBlind);
  postBlind(state, (state.dealerIndex + 2) % state.seats.length, state.bigBlind);
  state.currentSeat = (state.dealerIndex + 3) % state.seats.length;
  return state;
}

function advanceStage(state) {
  freshRound(state);
  const active = activePlayers(state);
  if (active.length <= 1) return showdown(state, true);
  if (state.stage === 'preflop') {
    state.community.push(state.deck.pop(), state.deck.pop(), state.deck.pop());
    state.stage = 'flop';
  } else if (state.stage === 'flop') {
    state.community.push(state.deck.pop()); state.stage = 'turn';
  } else if (state.stage === 'turn') {
    state.community.push(state.deck.pop()); state.stage = 'river';
  } else return showdown(state, false);
  state.currentSeat = nextActiveIndex(state, state.dealerIndex + 1);
  state.status = `${state.stage} betting round`;
  return state;
}

function showdown(state, quick = false) {
  const remaining = activePlayers(state);
  if (remaining.length === 1) {
    remaining[0].chips += state.pot;
    state.result = `${remaining[0].name} wins ${state.pot} chips uncontested.`;
    state.winnerName = remaining[0].name;
    state.buddyDelta = remaining[0].id === 'p1' ? state.pot - state.wager : -state.wager;
    return state;
  }
  const ranked = remaining.map(s => ({ seat:s, hand: bestOfSeven([...s.cards, ...state.community]) })).sort((a,b)=>compareHands(a.hand,b.hand));
  const best = ranked.at(-1).hand;
  const winners = ranked.filter(r => compareHands(r.hand, best) === 0);
  const share = Math.floor(state.pot / winners.length);
  winners.forEach(w => w.seat.chips += share);
  const youWin = winners.some(w => w.seat.id === 'p1');
  state.result = `${winners.map(w=>w.seat.name).join(', ')} win ${share} each with ${best.label}.`;
  state.winnerName = winners.map(w=>w.seat.name).join(', ');
  state.buddyDelta = youWin ? share - state.wager : -state.wager;
  return state;
}

function commitBet(seat, amount, state) {
  const paid = Math.min(amount, seat.chips);
  seat.chips -= paid; seat.roundBet += paid; seat.totalBet += paid; state.pot += paid; if (seat.chips===0) seat.allIn = true; seat.acted = true;
}

function finishAction(state) {
  if (activePlayers(state).length <= 1) return showdown(state, true);
  if (allBetsEqual(state) && state.seats.filter(s=>s.inHand && !s.folded && !s.allIn).every(s => s.acted)) return advanceStage(state);
  state.currentSeat = nextActiveIndex(state, state.currentSeat + 1);
  return state;
}

export function handleAction(state, action) {
  if (state.result) return state;
  const next = structuredClone(state);
  const seat = next.seats[next.currentSeat];
  if (!seat || seat.folded || !seat.inHand) return next;
  const toCall = Math.max(0, highestBet(next) - seat.roundBet);
  if (action.type === 'fold') { seat.folded = true; seat.acted = true; next.status = `${seat.name} folds`; return finishAction(next); }
  if (action.type === 'check' && toCall === 0) { seat.acted = true; next.status = `${seat.name} checks`; return finishAction(next); }
  if (action.type === 'call') { commitBet(seat, toCall, next); next.status = `${seat.name} calls`; return finishAction(next); }
  if (action.type === 'bet') { const amount = Math.max(next.bigBlind, action.amount || next.bigBlind); commitBet(seat, amount, next); next.status = `${seat.name} bets ${amount}`; next.seats.forEach((s, idx) => { if (idx !== next.currentSeat && s.inHand && !s.folded) s.acted = false; }); return finishAction(next); }
  if (action.type === 'raise') { const raiseTo = Math.max(highestBet(next) + next.minRaise, action.amount || highestBet(next) + next.minRaise); commitBet(seat, raiseTo - seat.roundBet, next); next.status = `${seat.name} raises`; next.seats.forEach((s, idx) => { if (idx !== next.currentSeat && s.inHand && !s.folded) s.acted = false; }); return finishAction(next); }
  if (action.type === 'allin') { commitBet(seat, seat.chips, next); next.status = `${seat.name} is all-in`; next.seats.forEach((s, idx) => { if (idx !== next.currentSeat && s.inHand && !s.folded) s.acted = false; }); return finishAction(next); }
  return next;
}

export function getAiMove(state) {
  const seat = state.seats[state.currentSeat];
  if (!seat?.isBot || state.result) return null;
  const [a,b] = seat.cards;
  const strength = rankValue(a.rank) + rankValue(b.rank) + (a.rank===b.rank?12:0) + (a.suit===b.suit?2:0);
  const toCall = Math.max(0, highestBet(state) - seat.roundBet);
  if (strength < 12 && toCall > state.bigBlind * 2) return { type:'fold' };
  if (strength > 24 && seat.chips > toCall + state.bigBlind * 2) return { type:'raise', amount: highestBet(state) + state.bigBlind * 2 };
  if (strength > 18 && toCall === 0) return { type:'bet', amount: state.bigBlind * 2 };
  if (toCall >= seat.chips) return { type:'allin' };
  return toCall === 0 ? { type:'check' } : { type:'call' };
}

export function render(state, ctx) {
  const root = document.createElement('div'); root.className='game-shell fade-in';
  const wrap = document.createElement('div'); wrap.className='center-board';
  const community = state.community.map(c => cardHtml(c)).join('') || '<div class="playing-card tiny"><div class="card-center">?</div></div>'.repeat(5);
  const seatsHtml = state.seats.map((s, idx) => `
    <div class="seat ${idx===state.currentSeat && !state.result?'active arcade-spark':''} ${s.folded?'folded':''}">
      <strong>${s.name}</strong>
      <div class="mini-text">Chips: ${s.chips} · Round: ${s.roundBet} · ${s.folded?'Folded':s.allIn?'All-in':'Live'}</div>
      <div class="card-row">${s.cards.map(c => cardHtml(c, s.id!=='p1' && !state.revealAll && !state.result)).join('')}</div>
    </div>`).join('');
  wrap.innerHTML = `<div style="width:100%;"><div class="seat-row"><div class="match-banner">Pot: ${state.pot} · Stage: ${state.stage}</div></div><div class="market-board" style="margin:12px 0;">${community}</div><div class="seat-row">${seatsHtml}</div></div>`;
  root.append(wrap);
  const you = state.seats[0];
  const toCall = Math.max(0, highestBet(state) - (you?.roundBet || 0));
  ctx.setInfo(`<div class="match-banner">${state.result || state.status}</div><div class="mini-text">Cash-game Hold'em with blinds, raises, all-ins, and hand evaluation.</div>`);
  ctx.setActions(state.result ? `<div class="mini-text">${state.result}</div>` : `
    <div class="btn-row wrap">
      <button id="hFold" class="action-btn">Fold</button>
      <button id="hCheck" class="action-btn">Check</button>
      <button id="hCall" class="action-btn primary">Call ${toCall}</button>
      <button id="hBet" class="action-btn">Bet ${state.bigBlind * 2}</button>
      <button id="hRaise" class="action-btn">Raise</button>
      <button id="hAllIn" class="action-btn warn">All-in</button>
    </div>
    <div class="mini-text">Only the active seat may act. In solo/share mode, bots fill empty seats.</div>`);
  queueMicrotask(() => {
    document.getElementById('hFold')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'fold'}), true));
    document.getElementById('hCheck')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'check'}), true));
    document.getElementById('hCall')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'call'}), true));
    document.getElementById('hBet')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'bet', amount: state.bigBlind*2}), true));
    document.getElementById('hRaise')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'raise', amount: highestBet(state)+state.bigBlind*2}), true));
    document.getElementById('hAllIn')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'allin'}), true));
  });
  return root;
}
