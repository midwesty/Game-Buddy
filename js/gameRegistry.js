import * as chess from './games/chess.js';
import * as checkers from './games/checkers.js';
import * as blackjack from './games/blackjack.js';
import * as solitaire from './games/solitaire.js';
import * as holdem from './games/holdem.js';
import * as pitch from './games/pitch.js';

export const registry = { chess, checkers, blackjack, solitaire, holdem, pitch };

export function getGameModule(id) {
  return registry[id];
}

export function buildPlayerSeats(gameId, mode, rootProfileName = 'Player') {
  switch (gameId) {
    case 'chess':
    case 'checkers':
      return [
        { id: 'p1', name: rootProfileName, isBot: false },
        { id: 'p2', name: mode === 'solo' ? 'Buddy Bot' : 'Player 2', isBot: mode === 'solo' },
      ];
    case 'blackjack':
      return [
        { id: 'p1', name: rootProfileName, isBot: false },
        { id: 'dealer', name: 'Dealer', isBot: true, isDealer: true },
      ];
    case 'solitaire':
      return [{ id: 'p1', name: rootProfileName, isBot: false }];
    case 'holdem':
      return [
        { id: 'p1', name: rootProfileName, isBot: false },
        { id: 'p2', name: mode === 'local' ? 'Player 2' : 'Buddy Bot 1', isBot: mode !== 'local' },
        { id: 'p3', name: 'Buddy Bot 2', isBot: true },
        { id: 'p4', name: 'Buddy Bot 3', isBot: true },
      ];
    case 'pitch':
      return [
        { id: 'p1', name: rootProfileName, isBot: false, team: 0 },
        { id: 'p2', name: mode === 'local' ? 'Player 2' : 'Buddy Bot 1', isBot: mode !== 'local', team: 1 },
        { id: 'p3', name: mode === 'local' ? 'Player 3' : 'Buddy Bot 2', isBot: mode !== 'local', team: 0 },
        { id: 'p4', name: mode === 'local' ? 'Player 4' : 'Buddy Bot 3', isBot: mode !== 'local', team: 1 },
      ];
    default:
      return [{ id: 'p1', name: rootProfileName, isBot: false }];
  }
}
