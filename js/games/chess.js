const PIECES = {
  white: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  black: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

function makePiece(color, type) { return { color, type, moved: false }; }
function clone(obj) { return structuredClone(obj); }
function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function enemy(piece, target) { return target && piece && target.color !== piece.color; }
function algebraic(r, c) { return String.fromCharCode(97 + c) + (8 - r); }

function playerForTurn(state, turn = state.turn) {
  return state.players?.find((p) => (turn === 'white' ? p.id === 'p1' : p.id === 'p2')) || null;
}

export function createInitialState({ mode, players, wager = 0 }) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'].forEach((t, c) => {
    board[0][c] = makePiece('black', t);
    board[7][c] = makePiece('white', t);
    board[1][c] = makePiece('black', 'p');
    board[6][c] = makePiece('white', 'p');
  });
  return {
    gameId: 'chess',
    mode,
    players,
    wager,
    board,
    turn: 'white',
    selected: null,
    legalMoves: [],
    status: 'White to move',
    result: null,
    history: [],
  };
}

function findKing(board, color) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c]?.type === 'k' && board[r][c].color === color) return [r, c];
  return null;
}

function rawMoves(state, r, c, forAttack = false) {
  const board = state.board;
  const piece = board[r][c];
  if (!piece) return [];
  const moves = [];
  const addRay = (dr, dc) => {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      if (!board[nr][nc]) moves.push([nr, nc]);
      else {
        if (enemy(piece, board[nr][nc])) moves.push([nr, nc]);
        break;
      }
      nr += dr;
      nc += dc;
    }
  };
  switch (piece.type) {
    case 'p': {
      const dir = piece.color === 'white' ? -1 : 1;
      const startRow = piece.color === 'white' ? 6 : 1;
      if (!forAttack) {
        if (inBounds(r + dir, c) && !board[r + dir][c]) moves.push([r + dir, c]);
        if (r === startRow && !board[r + dir][c] && !board[r + dir * 2][c]) moves.push([r + dir * 2, c]);
      }
      [-1, 1].forEach((dc) => {
        const nr = r + dir;
        const nc = c + dc;
        if (!inBounds(nr, nc)) return;
        if (forAttack || enemy(piece, board[nr][nc])) moves.push([nr, nc]);
      });
      if (state.enPassant && !forAttack) {
        if (Math.abs(state.enPassant[1] - c) === 1 && state.enPassant[0] === r + dir) moves.push([...state.enPassant, 'ep']);
      }
      break;
    }
    case 'r':
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => addRay(dr, dc));
      break;
    case 'b':
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => addRay(dr, dc));
      break;
    case 'q':
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => addRay(dr, dc));
      break;
    case 'n':
      [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]].forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc) && (!board[nr][nc] || enemy(piece, board[nr][nc]))) moves.push([nr, nc]);
      });
      break;
    case 'k': {
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc) && (!board[nr][nc] || enemy(piece, board[nr][nc]))) moves.push([nr, nc]);
      });
      if (!forAttack && !piece.moved) {
        const row = piece.color === 'white' ? 7 : 0;
        if (r === row && c === 4) {
          const rookK = board[row][7];
          if (rookK?.type === 'r' && !rookK.moved && !board[row][5] && !board[row][6]) moves.push([row, 6, 'castleK']);
          const rookQ = board[row][0];
          if (rookQ?.type === 'r' && !rookQ.moved && !board[row][1] && !board[row][2] && !board[row][3]) moves.push([row, 2, 'castleQ']);
        }
      }
      break;
    }
  }
  return moves;
}

function isSquareAttacked(state, row, col, byColor) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c];
      if (p?.color !== byColor) continue;
      const attacks = rawMoves(state, r, c, true);
      if (attacks.some(([ar, ac]) => ar === row && ac === col)) return true;
    }
  }
  return false;
}

function applyMoveUnsafe(state, from, move) {
  const [fr, fc] = from;
  const [tr, tc, special] = move;
  const board = clone(state.board);
  const piece = { ...board[fr][fc], moved: true };
  board[fr][fc] = null;
  if (special === 'ep') {
    const dir = piece.color === 'white' ? 1 : -1;
    board[tr + dir][tc] = null;
  }
  if (special === 'castleK') {
    board[tr][5] = { ...board[tr][7], moved: true };
    board[tr][7] = null;
  }
  if (special === 'castleQ') {
    board[tr][3] = { ...board[tr][0], moved: true };
    board[tr][0] = null;
  }
  if (piece.type === 'p' && (tr === 0 || tr === 7)) piece.type = 'q';
  board[tr][tc] = piece;
  const next = { ...state, board, enPassant: null };
  if (piece.type === 'p' && Math.abs(tr - fr) === 2) next.enPassant = [(fr + tr) / 2, fc];
  return next;
}

function legalMovesFor(state, r, c) {
  const piece = state.board[r][c];
  if (!piece || piece.color !== state.turn) return [];
  let moves = rawMoves(state, r, c);
  if (piece.type === 'k') {
    const enemyColor = piece.color === 'white' ? 'black' : 'white';
    moves = moves.filter((move) => {
      if (move[2] === 'castleK') {
        return !isSquareAttacked(state, r, 4, enemyColor) && !isSquareAttacked(state, r, 5, enemyColor) && !isSquareAttacked(state, r, 6, enemyColor);
      }
      if (move[2] === 'castleQ') {
        return !isSquareAttacked(state, r, 4, enemyColor) && !isSquareAttacked(state, r, 3, enemyColor) && !isSquareAttacked(state, r, 2, enemyColor);
      }
      return true;
    });
  }
  return moves.filter((move) => {
    const test = applyMoveUnsafe(state, [r, c], move);
    const kingPos = findKing(test.board, piece.color);
    return kingPos && !isSquareAttacked(test, kingPos[0], kingPos[1], piece.color === 'white' ? 'black' : 'white');
  });
}

function allLegalMoves(state, color = state.turn) {
  const list = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (!p || p.color !== color) continue;
    const oldTurn = state.turn;
    state.turn = color;
    const moves = legalMovesFor(state, r, c);
    state.turn = oldTurn;
    moves.forEach((m) => list.push({ from: [r, c], move: m }));
  }
  return list;
}

function checkGameEnd(next) {
  const nextColor = next.turn;
  const legal = allLegalMoves(clone(next), nextColor);
  if (!legal.length) {
    const king = findKing(next.board, nextColor);
    const inCheck = king && isSquareAttacked(next, king[0], king[1], nextColor === 'white' ? 'black' : 'white');
    return inCheck
      ? { result: nextColor === 'white' ? 'Black wins by checkmate' : 'White wins by checkmate', winner: nextColor === 'white' ? 'black' : 'white' }
      : { result: 'Draw by stalemate', winner: 'draw' };
  }
  return null;
}

export function handleAction(state, action) {
  if (state.result) return state;
  if (action.type !== 'select') return state;
  const { row, col } = action;
  const piece = state.board[row][col];
  if (state.selected && state.legalMoves.some(([r, c]) => r === row && c === col)) {
    const next = applyMoveUnsafe(state, state.selected, state.legalMoves.find(([r, c]) => r === row && c === col));
    next.turn = state.turn === 'white' ? 'black' : 'white';
    next.selected = null;
    next.legalMoves = [];
    next.history = [...state.history, `${state.turn} ${algebraic(...state.selected)}→${algebraic(row, col)}`];
    next.status = `${next.turn[0].toUpperCase() + next.turn.slice(1)} to move`;
    const end = checkGameEnd(next);
    if (end) {
      next.result = end.result;
      next.winner = end.winner;
    }
    return next;
  }
  if (piece?.color === state.turn) {
    return { ...state, selected: [row, col], legalMoves: legalMovesFor(state, row, col) };
  }
  return { ...state, selected: null, legalMoves: [] };
}

export function getAiMove(state) {
  const seat = playerForTurn(state);
  if (!seat?.isBot || state.result) return null;
  const moves = allLegalMoves(clone(state), state.turn);
  if (!moves.length) return null;
  const scored = moves.map((entry) => {
    const target = state.board[entry.move[0]][entry.move[1]];
    const captureScore = target ? { p: 1, n: 3, b: 3, r: 5, q: 9, k: 20 }[target.type] : 0;
    const centerScore = 3.5 - (Math.abs(3.5 - entry.move[0]) + Math.abs(3.5 - entry.move[1])) / 2;
    return { ...entry, score: captureScore * 10 + centerScore + Math.random() };
  }).sort((a, b) => b.score - a.score);
  return { type: 'select', row: scored[0].from[0], col: scored[0].from[1], followup: { row: scored[0].move[0], col: scored[0].move[1] } };
}

export function render(state, ctx) {
  const root = document.createElement('div');
  root.className = 'game-shell fade-in';
  const info = document.createElement('div');
  info.className = 'info-strip';
  info.innerHTML = `<div class="chip">Turn: ${state.turn}</div><div class="chip">Active: ${playerForTurn(state)?.name || state.turn}</div><div class="chip">${state.result || state.status}</div>`;
  const boardWrap = document.createElement('div');
  boardWrap.className = 'center-board';
  const board = document.createElement('div');
  board.className = 'board-grid arcade-spark';
  board.style.gridTemplateColumns = 'repeat(8, 1fr)';

  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const cell = document.createElement('button');
    cell.className = `board-cell ${(r + c) % 2 ? 'dark' : 'light'} ${state.selected?.[0] === r && state.selected?.[1] === c ? 'selected' : ''}`;
    if (state.legalMoves.some(([mr, mc]) => mr === r && mc === c)) cell.classList.add('highlight');
    cell.dataset.tip = `${algebraic(r, c)}${state.board[r][c] ? ` · ${state.board[r][c].color} ${state.board[r][c].type}` : ''}`;
    const piece = state.board[r][c];
    cell.innerHTML = piece ? `<span class="piece">${PIECES[piece.color][piece.type]}</span>` : '';
    cell.onclick = () => {
      const next = handleAction(state, { type: 'select', row: r, col: c });
      if (ctx.onStateChange) ctx.onStateChange(next, true);
      if (ctx.autoBotTurn && next && !next.result) ctx.autoBotTurn();
    };
    board.append(cell);
  }

  boardWrap.append(board);
  root.append(info, boardWrap);
  ctx.setInfo(`<div class="match-banner">${state.result || state.status}</div><div class="mini-text">Standard chess rules included: castling, en passant, promotion, checkmate, stalemate.</div>`);
  ctx.setActions(`
    <div class="btn-row wrap">
      <button id="chessNew" class="action-btn primary" data-tip="Start a fresh chess game with the same mode and wager.">New Game</button>
      <button id="chessEnd" class="action-btn danger" data-tip="Clear the chess board and return to the main room.">End Game</button>
    </div>
    <div class="mini-text">Tap a piece, then tap a highlighted square. In solo mode, Buddy Bot plays black.</div>
  `);
  queueMicrotask(() => {
    document.getElementById('chessNew')?.addEventListener('click', () => ctx.restartMatch?.());
    document.getElementById('chessEnd')?.addEventListener('click', () => ctx.endMatch?.(null, 'Cleared the chess board.'));
  });
  return root;
}
