GAME BUDDY MVP

How to run:
1. Put this folder on GitHub Pages or serve it locally with a small web server.
2. Do not open index.html directly with file:// if JSON fetches fail.
3. Local test example from this folder:
   python -m http.server 8000
4. Then open http://localhost:8000

Audio placeholders expected:
assets/audio/music/lounge-loop-01.mp3
assets/audio/music/lounge-loop-02.mp3
assets/audio/music/lounge-loop-03.mp3
assets/audio/music/lounge-loop-04.mp3
assets/audio/music/lounge-loop-05.mp3
assets/audio/sfx/click.mp3
assets/audio/sfx/move.mp3
assets/audio/sfx/card-flip.mp3
assets/audio/sfx/win.mp3
assets/audio/sfx/lose.mp3
assets/audio/sfx/chips.mp3
assets/audio/sfx/alert.mp3

What is included:
- Multi-profile local save system with daily Buddy Bucks reward
- Guest mode
- Chess
- Checkers
- Blackjack
- Pitch (4-player partnership)
- Klondike Solitaire
- Texas Hold'em
- Share-code match export/import
- Custom tabletop sandbox builder
- Admin / cheat menu
- Theme and music selectors prepared for expansion

Notes:
- AI is intentionally self-contained per game file so it can be improved later without risking the full project.
- New built-in games should usually be added by:
  1) adding a game entry in data/games.json
  2) adding a new file in js/games/
  3) registering it in js/gameRegistry.js
- This first version prioritizes a stable expandable foundation.
