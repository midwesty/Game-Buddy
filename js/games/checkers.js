function makePiece(color, king = false) { return { color, king }; }
function clone(x) { return structuredClone(x); }
function inBounds(r,c){return r>=0&&r<8&&c>=0&&c<8;}
const ICON = { white: { false: '⛀', true: '⛁' }, black: { false: '⛂', true: '⛃' } };

export function createInitialState({ mode, players, wager = 0 }) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r+c)%2===1) board[r][c] = makePiece('black');
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r+c)%2===1) board[r][c] = makePiece('white');
  return { gameId:'checkers', mode, players, wager, board, turn:'white', selected:null, legalMoves:[], forcedFrom:null, result:null, status:'White to move' };
}

function directions(piece){
  const dirs = [];
  if (piece.color === 'white' || piece.king) dirs.push([-1,-1],[-1,1]);
  if (piece.color === 'black' || piece.king) dirs.push([1,-1],[1,1]);
  return dirs;
}

function moveList(state, r, c, jumpsOnly=false) {
  const piece = state.board[r][c]; if (!piece) return [];
  const moves = [];
  for (const [dr,dc] of directions(piece)) {
    const nr=r+dr,nc=c+dc;
    const jr=r+dr*2,jc=c+dc*2;
    if (inBounds(jr,jc) && state.board[nr]?.[nc] && state.board[nr][nc].color !== piece.color && !state.board[jr][jc]) moves.push([jr,jc,'jump',nr,nc]);
    if (!jumpsOnly && inBounds(nr,nc) && !state.board[nr][nc]) moves.push([nr,nc,'move']);
  }
  return moves;
}

function allMoves(state, color = state.turn) {
  const jumps = [];
  const normals = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (state.board[r][c]?.color===color) {
    const moves = moveList(state,r,c);
    moves.forEach((m) => (m[2]==='jump' ? jumps : normals).push({from:[r,c], move:m}));
  }
  return jumps.length ? jumps : normals;
}

function crownIfNeeded(piece, row){ if ((piece.color==='white' && row===0) || (piece.color==='black' && row===7)) piece.king=true; }

export function handleAction(state, action) {
  if (state.result) return state;
  if (action.type !== 'select') return state;
  const { row, col } = action;
  const piece = state.board[row][col];
  if (state.selected && state.legalMoves.some(([r,c]) => r===row && c===col)) {
    const [fr,fc] = state.selected;
    const fullMove = state.legalMoves.find(([r,c])=>r===row&&c===col);
    const board = clone(state.board);
    const moving = board[fr][fc];
    board[fr][fc] = null;
    board[row][col] = moving;
    if (fullMove[2] === 'jump') board[fullMove[3]][fullMove[4]] = null;
    crownIfNeeded(moving, row);
    const next = { ...state, board, selected:null, legalMoves:[] };
    if (fullMove[2] === 'jump') {
      const moreJumps = moveList(next, row, col, true);
      if (moreJumps.length) {
        next.selected = [row,col];
        next.legalMoves = moreJumps;
        next.forcedFrom = [row,col];
        next.status = `${next.turn} must continue jumping`;
      } else {
        next.forcedFrom = null;
        next.turn = state.turn === 'white' ? 'black' : 'white';
        next.status = `${next.turn} to move`;
      }
    } else {
      next.turn = state.turn === 'white' ? 'black' : 'white';
      next.status = `${next.turn} to move`;
    }
    const enemyMoves = allMoves(next, next.turn);
    if (!enemyMoves.length) {
      next.result = `${state.turn} wins`;
      next.winner = state.turn;
    }
    return next;
  }
  if (piece?.color === state.turn) {
    if (state.forcedFrom && (state.forcedFrom[0]!==row || state.forcedFrom[1]!==col)) return state;
    const forced = allMoves(state, state.turn);
    const onlyJumps = forced.length && forced[0].move[2] === 'jump';
    const moves = moveList(state,row,col,onlyJumps);
    return { ...state, selected:[row,col], legalMoves:moves };
  }
  return { ...state, selected:null, legalMoves:[] };
}

export function getAiMove(state) {
  const moves = allMoves(state, state.turn);
  if (!moves.length) return null;
  const ranked = moves.map((m) => ({ ...m, score: (m.move[2]==='jump'?12:2) + (m.move[0]===0||m.move[0]===7?3:0) + Math.random() })).sort((a,b)=>b.score-a.score);
  return { type:'select', row:ranked[0].from[0], col:ranked[0].from[1], followup:{ row: ranked[0].move[0], col: ranked[0].move[1] } };
}

export function render(state, ctx) {
  const root = document.createElement('div'); root.className='game-shell fade-in';
  const info = document.createElement('div'); info.className='info-strip'; info.innerHTML=`<div class="chip">Turn: ${state.turn}</div><div class="chip">${state.result || state.status}</div>`;
  const center = document.createElement('div'); center.className='center-board';
  const board = document.createElement('div'); board.className='board-grid arcade-spark'; board.style.gridTemplateColumns='repeat(8,1fr)';
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const cell = document.createElement('button');
    cell.className = `board-cell ${(r+c)%2 ? 'dark' : 'light'} ${state.selected?.[0]===r&&state.selected?.[1]===c?'selected':''}`;
    if (state.legalMoves.some(([mr,mc])=>mr===r&&mc===c)) cell.classList.add('highlight');
    const piece=state.board[r][c]; cell.innerHTML = piece ? `<span class="piece">${ICON[piece.color][piece.king]}</span>` : '';
    cell.dataset.tip = piece ? `${piece.color} ${piece.king?'king':'checker'}` : 'Board square';
    cell.onclick = () => {
      const next = handleAction(state,{type:'select',row:r,col:c});
      ctx.onStateChange(next, true);
      const aiSeat = next.players?.find((p) => p.isBot && ((next.turn === 'black' && p.id === 'p2') || (next.turn === 'white' && p.id === 'p1')));
      if (ctx.autoBotTurn && aiSeat) ctx.autoBotTurn();
    };
    board.append(cell);
  }
  center.append(board);
  root.append(info, center);
  ctx.setInfo(`<div class="match-banner">${state.result || state.status}</div><div class="mini-text">American checkers with forced captures and kinging.</div>`);
  ctx.setActions(`<div class="mini-text">Select a checker, then a highlighted square. If you jump and another jump is available, you must keep going.</div>`);
  return root;
}
