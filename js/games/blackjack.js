const MIN_BET = 5;
const BET_STEP = 5;

function makeDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ rank: r, suit: s });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  hand.forEach((c) => {
    if (c.rank === 'A') {
      total += 11;
      aces += 1;
    } else if (['K', 'Q', 'J'].includes(c.rank)) total += 10;
    else total += Number(c.rank);
  });
  while (total > 21 && aces) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

function draw(deck) {
  return deck.pop();
}

function cardHtml(card, hidden = false, tiny = false) {
  if (hidden) return `<div class="playing-card back ${tiny ? 'tiny' : ''}"><div class="card-center">🎴</div></div>`;
  const red = ['♥', '♦'].includes(card.suit) ? 'style="color:#a2233e"' : '';
  return `<div class="playing-card ${tiny ? 'tiny' : ''}" ${red}><div class="card-corner">${card.rank}${card.suit}</div><div class="card-center">${card.suit}</div><div class="card-corner" style="transform:rotate(180deg); align-self:flex-end;">${card.rank}${card.suit}</div></div>`;
}

function totalExposure(hands) {
  return hands.reduce((sum, hand) => sum + hand.bet, 0);
}

function clampBet(bet, bankroll) {
  if (bankroll <= 0) return 0;
  const rounded = Math.max(MIN_BET, Math.round(bet / BET_STEP) * BET_STEP);
  return Math.min(rounded, bankroll);
}

function emptyRoundState(base) {
  const bankroll = typeof base.bankroll === 'number' ? base.bankroll : Math.max(base.wager || 25, 500);
  const currentBet = clampBet(base.currentBet ?? base.wager ?? 25, bankroll);
  return {
    gameId: 'blackjack',
    mode: base.mode,
    players: base.players,
    wager: base.wager ?? 25,
    bankroll,
    sessionDelta: base.sessionDelta ?? 0,
    currentBet,
    deck: [],
    playerHands: [],
    dealer: { cards: [], hidden: true, stood: false, busted: false },
    currentHand: 0,
    phase: bankroll > 0 ? 'betting' : 'done',
    status: bankroll > 0 ? 'Place your bet and deal the next round.' : 'You are out of Buddy Bucks.',
    roundResult: null,
    result: bankroll > 0 ? null : `You are out of Buddy Bucks and leave the table at ${bankroll}.`,
    buddyDelta: bankroll > 0 ? undefined : base.sessionDelta ?? 0,
    revealAll: false,
  };
}

function dealRound(state) {
  if (state.bankroll <= 0 || state.currentBet <= 0 || state.currentBet > state.bankroll) {
    return { ...state, status: 'You do not have enough Buddy Bucks for that bet.' };
  }
  const deck = makeDeck();
  const next = {
    ...state,
    deck,
    playerHands: [
      {
        id: 'p1',
        cards: [draw(deck), draw(deck)],
        bet: state.currentBet,
        stood: false,
        busted: false,
        doubled: false,
      },
    ],
    dealer: { cards: [draw(deck), draw(deck)], hidden: true, stood: false, busted: false },
    currentHand: 0,
    phase: 'player',
    status: 'Your move',
    roundResult: null,
    revealAll: false,
    result: null,
    buddyDelta: undefined,
  };
  if (isBlackjack(next.playerHands[0].cards) || isBlackjack(next.dealer.cards)) {
    return resolveDealer(next);
  }
  return next;
}

function settle(state) {
  const dealerValue = handValue(state.dealer.cards);
  const dealerBJ = isBlackjack(state.dealer.cards);
  const lines = [];
  let delta = 0;
  state.playerHands.forEach((hand, idx) => {
    const val = handValue(hand.cards);
    const playerBJ = isBlackjack(hand.cards);
    if (playerBJ && !dealerBJ) {
      const win = Math.round(hand.bet * 1.5);
      lines.push(`Hand ${idx + 1}: blackjack pays ${win}.`);
      delta += win;
      return;
    }
    if (hand.busted) {
      lines.push(`Hand ${idx + 1}: bust for -${hand.bet}.`);
      delta -= hand.bet;
      return;
    }
    if (dealerBJ && !playerBJ) {
      lines.push(`Hand ${idx + 1}: dealer blackjack for -${hand.bet}.`);
      delta -= hand.bet;
      return;
    }
    if (dealerValue > 21 || val > dealerValue) {
      lines.push(`Hand ${idx + 1}: win ${hand.bet}.`);
      delta += hand.bet;
    } else if (val < dealerValue) {
      lines.push(`Hand ${idx + 1}: lose ${hand.bet}.`);
      delta -= hand.bet;
    } else lines.push(`Hand ${idx + 1}: push.`);
  });

  const bankroll = Math.max(0, state.bankroll + delta);
  const sessionDelta = state.sessionDelta + delta;
  if (bankroll <= 0) {
    return {
      ...state,
      phase: 'done',
      result: `${lines.join(' ')} You are out of Buddy Bucks and leave the table.`,
      roundResult: lines.join(' '),
      buddyDelta: sessionDelta,
      bankroll,
      sessionDelta,
      revealAll: true,
      status: 'Table closed',
    };
  }

  return {
    ...state,
    phase: 'roundOver',
    roundResult: lines.join(' '),
    bankroll,
    sessionDelta,
    revealAll: true,
    status: 'Round complete. Deal again or leave the table.',
  };
}

function resolveDealer(state) {
  const dealer = structuredClone(state.dealer);
  const deck = [...state.deck];
  dealer.hidden = false;
  while (!isBlackjack(dealer.cards) && handValue(dealer.cards) < 17) dealer.cards.push(draw(deck));
  dealer.stood = true;
  dealer.busted = handValue(dealer.cards) > 21;
  return settle({ ...state, dealer, deck, status: 'Dealer turn' });
}

function advanceHand(state) {
  const hands = structuredClone(state.playerHands);
  let idx = state.currentHand;
  while (idx < hands.length && (hands[idx].stood || hands[idx].busted)) idx += 1;
  if (idx >= hands.length) return resolveDealer({ ...state, playerHands: hands, currentHand: hands.length, phase: 'dealer' });
  return { ...state, playerHands: hands, currentHand: idx, status: `Hand ${idx + 1} to act` };
}

function finishSession(state) {
  return {
    ...state,
    phase: 'done',
    result: `You leave the blackjack table with ${state.bankroll} Buddy Bucks (${state.sessionDelta >= 0 ? '+' : ''}${state.sessionDelta} this session).`,
    buddyDelta: state.sessionDelta,
    status: 'Table closed',
    revealAll: true,
  };
}

export function createInitialState({ mode, players, wager = 25, bankroll = 500 }) {
  return emptyRoundState({ mode, players, wager, bankroll, currentBet: wager, sessionDelta: 0 });
}

export function handleAction(state, action) {
  if (action.type === 'endTable') return finishSession(state);
  if (action.type === 'deal') {
    if (state.phase !== 'betting' && state.phase !== 'roundOver') return state;
    return dealRound({ ...state, result: null });
  }
  if (action.type === 'adjustBet') {
    if (state.phase !== 'betting' && state.phase !== 'roundOver') return state;
    const current = state.currentBet || MIN_BET;
    const nextBet = clampBet(current + action.delta, state.bankroll);
    return { ...state, currentBet: nextBet, status: `Bet set to ${nextBet} Buddy Bucks.` };
  }
  if (action.type === 'setBet') {
    if (state.phase !== 'betting' && state.phase !== 'roundOver') return state;
    return { ...state, currentBet: clampBet(action.amount, state.bankroll) };
  }
  if (state.phase === 'done') return state;
  if (state.phase === 'dealer') return resolveDealer(state);
  if (state.phase !== 'player') return state;

  const hands = structuredClone(state.playerHands);
  const deck = [...state.deck];
  const hand = hands[state.currentHand];
  if (!hand) return state;

  if (action.type === 'hit') {
    hand.cards.push(draw(deck));
    if (handValue(hand.cards) > 21) hand.busted = true;
  }
  if (action.type === 'stand') hand.stood = true;
  if (action.type === 'double' && hand.cards.length === 2 && totalExposure(hands) + hand.bet <= state.bankroll) {
    hand.bet *= 2;
    hand.doubled = true;
    hand.cards.push(draw(deck));
    hand.stood = true;
    if (handValue(hand.cards) > 21) hand.busted = true;
  }
  if (action.type === 'split' && hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank && totalExposure(hands) + hand.bet <= state.bankroll) {
    const splitCard = hand.cards.pop();
    hands.splice(state.currentHand + 1, 0, {
      id: `${hand.id}-split`,
      cards: [splitCard, draw(deck)],
      bet: hand.bet,
      stood: false,
      busted: false,
      doubled: false,
    });
    hand.cards.push(draw(deck));
  }

  const next = advanceHand({ ...state, playerHands: hands, deck, result: null });
  return next;
}

export function render(state, ctx) {
  const root = document.createElement('div');
  root.className = 'game-shell fade-in';

  const shell = document.createElement('div');
  shell.className = 'center-board';
  const wrap = document.createElement('div');
  wrap.style.width = '100%';

  const dealerVal = state.dealer.cards.length
    ? state.dealer.hidden && !state.revealAll
      ? '?'
      : handValue(state.dealer.cards)
    : '—';

  wrap.innerHTML = `
    <div class="seat-row">
      <div class="match-banner">Bankroll: ${state.bankroll} · Session: ${state.sessionDelta >= 0 ? '+' : ''}${state.sessionDelta} · Bet: ${state.currentBet}</div>
    </div>
    <div class="seat-row" style="margin-top:12px;">
      <div class="seat ${state.phase === 'dealer' ? 'active arcade-spark' : ''}">
        <strong>Dealer</strong>
        <div class="mini-text">Value: ${dealerVal}</div>
        <div class="card-row">${state.dealer.cards.length ? state.dealer.cards.map((c, i) => cardHtml(c, i === 1 && state.dealer.hidden && !state.revealAll && state.phase !== 'done')).join('') : '<div class="mini-text">Waiting for deal…</div>'}</div>
      </div>
    </div>
    <div class="seat-row">${state.playerHands.length ? state.playerHands.map((hand, idx) => `
      <div class="seat ${idx === state.currentHand && state.phase === 'player' ? 'active pulse' : ''}">
        <strong>Hand ${idx + 1}</strong>
        <div class="mini-text">Bet: ${hand.bet} · Value: ${handValue(hand.cards)}${hand.busted ? ' · Bust' : hand.stood ? ' · Stand' : ''}</div>
        <div class="card-row">${hand.cards.map((c) => cardHtml(c)).join('')}</div>
      </div>`).join('') : '<div class="seat"><div class="mini-text">No round in progress. Set your bet and deal the next hand.</div></div>'}</div>`;
  shell.append(wrap);
  root.append(shell);

  const activeHand = state.playerHands[state.currentHand];
  const canDouble = state.phase === 'player' && activeHand?.cards.length === 2 && totalExposure(state.playerHands) + activeHand.bet <= state.bankroll;
  const canSplit = state.phase === 'player' && activeHand?.cards.length === 2 && activeHand.cards[0]?.rank === activeHand.cards[1]?.rank && totalExposure(state.playerHands) + activeHand.bet <= state.bankroll;

  ctx.setInfo(`
    <div class="match-banner">${state.result || state.roundResult || state.status}</div>
    <div class="mini-text">Blackjack table with repeat rounds, variable betting, split, double, and cash-out support.</div>
    <div class="mini-text">Current bankroll: ${state.bankroll} · Current round bet: ${state.currentBet}</div>
  `);

  if (state.phase === 'betting' || state.phase === 'roundOver') {
    ctx.setActions(`
      <div class="btn-row wrap">
        <button id="bjBetDown" class="action-btn" data-tip="Lower the next round bet by ${BET_STEP} Buddy Bucks.">Bet -${BET_STEP}</button>
        <button id="bjBetUp" class="action-btn" data-tip="Raise the next round bet by ${BET_STEP} Buddy Bucks.">Bet +${BET_STEP}</button>
        <button id="bjDeal" class="action-btn primary" data-tip="Start the next blackjack round using the current bet.">Deal</button>
        <button id="bjNewTable" class="action-btn" data-tip="Reset the blackjack table and start a fresh session.">New Table</button>
        <button id="bjLeave" class="action-btn danger" data-tip="Cash out and leave the blackjack table.">Leave Table</button>
      </div>
      <div class="mini-text">${state.roundResult || 'Set your next round bet, then deal when you are ready.'}</div>
    `);
  } else if (state.phase === 'player') {
    ctx.setActions(`
      <div class="btn-row wrap">
        <button id="bjHit" class="action-btn primary" data-tip="Take one more card on the active hand.">Hit</button>
        <button id="bjStand" class="action-btn" data-tip="Stand on the active hand and move to the next hand or dealer turn.">Stand</button>
        <button id="bjDouble" class="action-btn" data-tip="Double this hand's bet, draw one card, then stand." ${canDouble ? '' : 'disabled'}>Double</button>
        <button id="bjSplit" class="action-btn" data-tip="Split matching starting cards into two separate hands." ${canSplit ? '' : 'disabled'}>Split</button>
      </div>
      <div class="mini-text">Playing hand ${state.currentHand + 1}. Value: ${activeHand ? handValue(activeHand.cards) : '—'}.</div>
    `);
  } else if (state.phase === 'done') {
    ctx.setActions(`
      <div class="btn-row wrap">
        <button id="bjNewTable" class="action-btn primary" data-tip="Start a brand new blackjack session.">New Table</button>
        <button id="bjLeaveClear" class="action-btn danger" data-tip="Clear the blackjack table and return to the room.">Clear Table</button>
      </div>
      <div class="mini-text">${state.result}</div>
    `);
  } else {
    ctx.setActions(`<div class="mini-text">Dealer resolving the round…</div>`);
  }

  queueMicrotask(() => {
    document.getElementById('bjBetDown')?.addEventListener('click', () => ctx.onStateChange(handleAction(state, { type: 'adjustBet', delta: -BET_STEP }), true));
    document.getElementById('bjBetUp')?.addEventListener('click', () => ctx.onStateChange(handleAction(state, { type: 'adjustBet', delta: BET_STEP }), true));
    document.getElementById('bjDeal')?.addEventListener('click', () => ctx.onStateChange(handleAction(state, { type: 'deal' }), true));
    document.getElementById('bjHit')?.addEventListener('click', () => ctx.onStateChange(handleAction(state, { type: 'hit' }), true));
    document.getElementById('bjStand')?.addEventListener('click', () => ctx.onStateChange(handleAction(state, { type: 'stand' }), true));
    document.getElementById('bjDouble')?.addEventListener('click', () => ctx.onStateChange(handleAction(state, { type: 'double' }), true));
    document.getElementById('bjSplit')?.addEventListener('click', () => ctx.onStateChange(handleAction(state, { type: 'split' }), true));
    document.getElementById('bjNewTable')?.addEventListener('click', () => ctx.restartMatch?.());
    document.getElementById('bjLeave')?.addEventListener('click', () => ctx.endMatch?.(handleAction(state, { type: 'endTable' })));
    document.getElementById('bjLeaveClear')?.addEventListener('click', () => ctx.endMatch?.(state));
  });

  return root;
}
