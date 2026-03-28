const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const rankValue = (r) => RANKS.indexOf(r) + 2;
const gameValue = (r) => ({ A:4, K:3, Q:2, J:1, '10':10, '9':0, '8':0, '7':0, '6':0, '5':0, '4':0, '3':0, '2':0 }[r] ?? Number(r));
const isRed = (s) => ['♥','♦'].includes(s);
function shuffle(deck){ for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]];} return deck; }
function makeDeck(){ return shuffle(SUITS.flatMap(s=>RANKS.map(r=>({rank:r,suit:s})))); }
function cardHtml(card, hidden=false){ if(hidden)return `<div class="playing-card back tiny"><div class="card-center">🎴</div></div>`; const red=isRed(card.suit)?'style="color:#a2233e"':''; return `<div class="playing-card tiny" ${red}><div class="card-corner">${card.rank}${card.suit}</div><div class="card-center">${card.suit}</div><div class="card-corner" style="transform:rotate(180deg);align-self:flex-end;">${card.rank}${card.suit}</div></div>`; }
function teamOf(idx){ return idx % 2; }

function newHand(stateBase) {
  const deck = makeDeck();
  const seats = stateBase.players.map((p, idx) => ({ ...p, hand: Array.from({length:6},()=>deck.pop()).sort((a,b)=>rankValue(a.rank)-rankValue(b.rank)), won:[] }));
  return { ...stateBase, deck, seats, phase:'bidding', currentSeat: (stateBase.dealerIndex + 1) % 4, bidHistory: [], highestBid: null, bidderSeat: null, trump: null, trick: [], trickLeader: null, handNumber:(stateBase.handNumber||0)+1, status:'Bidding has started' };
}

export function createInitialState({ mode, players, wager = 0 }) {
  return newHand({ gameId:'pitch', mode, players, wager, dealerIndex:0, teamScores:[0,0], result:null, revealAll:false, handNumber:0 });
}

function hasSuit(hand, suit){ return hand.some(c=>c.suit===suit); }
function legalIndexes(state, seatIndex) {
  const hand = state.seats[seatIndex].hand;
  if (!state.trick.length) return hand.map((_,i)=>i);
  const led = state.trick[0].card.suit;
  if (hasSuit(hand, led)) return hand.flatMap((c,i)=>c.suit===led?[i]:[]);
  return hand.map((_,i)=>i);
}
function trickWinner(trick, trump) {
  const led = trick[0].card.suit;
  let best = trick[0];
  trick.slice(1).forEach((entry) => {
    const a = entry.card, b = best.card;
    const aTrump = a.suit === trump, bTrump = b.suit === trump;
    if (aTrump && !bTrump) { best = entry; return; }
    if (aTrump === bTrump) {
      if (a.suit === b.suit && rankValue(a.rank) > rankValue(b.rank)) best = entry;
      else if (!aTrump && a.suit === led && b.suit !== led) best = entry;
    }
  });
  return best;
}
function scoreHand(state) {
  const trumpCardsWon = state.seats.flatMap(s => s.won.filter(c=>c.suit===state.trump).map(c=>({ card:c, team: teamOf(state.seats.findIndex(x=>x.id===s.id)) })));
  const teamPoints = [0,0];
  if (trumpCardsWon.length) {
    const sorted = [...trumpCardsWon].sort((a,b)=>rankValue(a.card.rank)-rankValue(b.card.rank));
    teamPoints[sorted.at(-1).team] += 1; // high
    teamPoints[sorted[0].team] += 1; // low
    const jack = trumpCardsWon.find(x=>x.card.rank==='J'); if (jack) teamPoints[jack.team] += 1;
  }
  const gameTotals = [0,0];
  state.seats.forEach((s, idx) => { s.won.forEach(c => gameTotals[teamOf(idx)] += gameValue(c.rank)); });
  if (gameTotals[0] > gameTotals[1]) teamPoints[0] += 1;
  else if (gameTotals[1] > gameTotals[0]) teamPoints[1] += 1;
  const bidderTeam = teamOf(state.bidderSeat);
  const bid = state.highestBid?.amount ?? 2;
  if (teamPoints[bidderTeam] < bid) state.teamScores[bidderTeam] -= bid;
  else state.teamScores[bidderTeam] += teamPoints[bidderTeam];
  state.teamScores[1 - bidderTeam] += teamPoints[1 - bidderTeam];
  state.lastHandSummary = `Team 1 scored ${teamPoints[0]} · Team 2 scored ${teamPoints[1]} · Bid was ${bid}`;
  if (state.teamScores[0] >= 11 || state.teamScores[1] >= 11) {
    state.result = `${state.teamScores[0] >= 11 ? 'Team 1' : 'Team 2'} win the match.`;
    state.winnerTeam = state.teamScores[0] >= 11 ? 0 : 1;
  }
}

function maybeBotProgress(state) { return state; }

export function handleAction(state, action) {
  const next = structuredClone(state);
  const seat = next.seats[next.currentSeat];
  if (next.result) return next;
  if (next.phase === 'bidding') {
    if (action.type === 'bid') {
      next.bidHistory.push({ seat: next.currentSeat, amount: action.amount });
      if (!next.highestBid || action.amount > next.highestBid.amount) { next.highestBid = { seat: next.currentSeat, amount: action.amount }; next.bidderSeat = next.currentSeat; }
    } else if (action.type === 'pass') next.bidHistory.push({ seat: next.currentSeat, amount: 0 });
    if (next.bidHistory.length >= 4) {
      if (!next.highestBid) { next.highestBid = { seat: (next.dealerIndex + 1) % 4, amount: 2 }; next.bidderSeat = (next.dealerIndex + 1) % 4; }
      next.phase = 'chooseTrump'; next.currentSeat = next.bidderSeat; next.status = `${next.seats[next.bidderSeat].name} chooses trump`; return next;
    }
    next.currentSeat = (next.currentSeat + 1) % 4;
    return next;
  }
  if (next.phase === 'chooseTrump' && action.type === 'trump') {
    next.trump = action.suit; next.phase = 'play'; next.currentSeat = next.bidderSeat; next.trickLeader = next.bidderSeat; next.status = `${next.seats[next.currentSeat].name} leads`; return next;
  }
  if (next.phase === 'play' && action.type === 'playCard') {
    const legal = legalIndexes(next, next.currentSeat);
    if (!legal.includes(action.index)) return next;
    const card = next.seats[next.currentSeat].hand.splice(action.index, 1)[0];
    next.trick.push({ seat: next.currentSeat, card });
    if (next.trick.length === 4) {
      const winner = trickWinner(next.trick, next.trump);
      next.trick.forEach((t)=> next.seats[winner.seat].won.push(t.card));
      next.trick = [];
      next.currentSeat = winner.seat;
      next.trickLeader = winner.seat;
      if (next.seats.every(s=>s.hand.length===0)) {
        scoreHand(next);
        if (!next.result) {
          next.dealerIndex = (next.dealerIndex + 1) % 4;
          return newHand(next);
        }
      }
      return next;
    }
    next.currentSeat = (next.currentSeat + 1) % 4;
    return next;
  }
  return maybeBotProgress(next);
}

export function getAiMove(state) {
  if (state.result) return null;
  const seat = state.seats[state.currentSeat];
  if (!seat?.isBot) return null;
  if (state.phase === 'bidding') {
    const strength = seat.hand.reduce((t,c)=>t + (c.rank==='A'?2:c.rank==='K'?1.5:c.rank==='J'?1:0),0);
    return strength > 7 && (!state.highestBid || state.highestBid.amount < 3) ? { type:'bid', amount: Math.min(4, (state.highestBid?.amount || 1) + 1) } : { type:'pass' };
  }
  if (state.phase === 'chooseTrump') {
    const bestSuit = SUITS.map(s => ({ s, score: seat.hand.filter(c=>c.suit===s).reduce((t,c)=>t+rankValue(c.rank),0) })).sort((a,b)=>b.score-a.score)[0].s;
    return { type:'trump', suit: bestSuit };
  }
  if (state.phase === 'play') {
    const legal = legalIndexes(state, state.currentSeat);
    const scored = legal.map((i)=>({ i, score: rankValue(seat.hand[i].rank) + (seat.hand[i].suit===state.trump?10:0) + Math.random() })).sort((a,b)=>b.score-a.score);
    return { type:'playCard', index: scored[0].i };
  }
  return null;
}

export function render(state, ctx) {
  const root = document.createElement('div'); root.className='game-shell fade-in';
  const wrap = document.createElement('div'); wrap.className='center-board';
  const trickHtml = state.trick.map(t => `<div class="seat"><strong>${state.seats[t.seat].name}</strong><div class="card-row">${cardHtml(t.card)}</div></div>`).join('') || '<div class="mini-text">No cards in trick yet.</div>';
  const hands = state.seats.map((s, idx) => `
    <div class="seat ${idx===state.currentSeat && !state.result?'active arcade-spark':''}">
      <strong>${s.name}</strong>
      <div class="mini-text">Team ${teamOf(idx)+1} · Won ${s.won.length} cards</div>
      <div class="card-row">${s.hand.map((c, i)=>`<button class="card-btn" data-seat="${idx}" data-index="${i}" style="border:0;background:transparent;padding:0;">${cardHtml(c, s.id!=='p1' && !state.revealAll && !state.result)}</button>`).join('')}</div>
    </div>`).join('');
  wrap.innerHTML = `<div style="width:100%;"><div class="seat-row"><div class="match-banner">Team 1: ${state.teamScores[0]} · Team 2: ${state.teamScores[1]} · Trump: ${state.trump || '—'}</div></div><div class="seat-row" style="margin:12px 0;">${trickHtml}</div><div class="seat-row">${hands}</div></div>`;
  root.append(wrap);
  ctx.setInfo(`<div class="match-banner">${state.result || state.status}</div><div class="mini-text">4-player partnership Pitch. High, Low, Jack, and Game. First team to 11 wins.</div>`);
  if (state.phase === 'bidding') {
    const minBid = Math.max(2, (state.highestBid?.amount || 1) + 1);
    ctx.setActions(`<div class="btn-row wrap"><button id="pitchPass" class="action-btn">Pass</button><button id="pitchBid2" class="action-btn primary">Bid ${minBid}</button><button id="pitchBid3" class="action-btn">Bid ${minBid+1}</button></div><div class="mini-text">Current high bid: ${state.highestBid?.amount || 'none'}.</div>`);
  } else if (state.phase === 'chooseTrump') {
    ctx.setActions(`<div class="btn-row wrap">${SUITS.map(s=>`<button class="action-btn" data-trump="${s}">${s}</button>`).join('')}</div><div class="mini-text">Bid winner chooses trump.</div>`);
  } else if (state.phase === 'play') {
    ctx.setActions(`<div class="mini-text">Follow suit if you can. If you cannot, you may throw off or play trump.</div>`);
  } else {
    ctx.setActions(`<div class="mini-text">${state.lastHandSummary || ''}</div>`);
  }
  queueMicrotask(() => {
    document.getElementById('pitchPass')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'pass'}), true));
    document.getElementById('pitchBid2')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'bid', amount: Math.max(2,(state.highestBid?.amount||1)+1)}), true));
    document.getElementById('pitchBid3')?.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'bid', amount: Math.max(3,(state.highestBid?.amount||1)+2)}), true));
    document.querySelectorAll('[data-trump]').forEach((el)=>el.addEventListener('click', ()=>ctx.onStateChange(handleAction(state,{type:'trump', suit: el.dataset.trump}), true)));
    document.querySelectorAll('.card-btn').forEach((el)=>el.addEventListener('click', ()=>{
      if (Number(el.dataset.seat) !== state.currentSeat) return;
      ctx.onStateChange(handleAction(state,{type:'playCard', index:Number(el.dataset.index)}), true);
    }));
  });
  return root;
}
