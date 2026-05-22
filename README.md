# 日本麻將遊戲

A single-player Japanese Mahjong game (Riichi Mahjong). Pure HTML+JS+CSS, zero build tools and no external dependencies.

## Quick Start

```bash
python3 -m http.server 8080
open http://localhost:8080
```

## Features

- 136 tiles (no flowers, no red fives)
- Unicode U+1F000..U+1F02F tile rendering
- All standard yaku (役) including dora, riichi, ippatsu, etc.
- Exhaustive draw (流局) with noten penalty and riichi stick distribution
- Renchan/kiri (連莊/輪莊) handling
- AI opponents with configurable difficulty
- Tenpai/defense indicator per wait tile

## File Structure

| File | Contents |
|------|----------|
| `index.html` | Entry point, loads all scripts in order |
| `js/tiles.js` | Tile class, tile generation |
| `js/wall.js` | Wall/dead wall management, dora indicators |
| `js/yaku.js` | Yaku evaluation, hand decomposition, tenpai check |
| `js/ai.js` | AI decision making, discard strategy, danger estimation |
| `js/game.js` | Game state machine, round lifecycle, scoring |
| `js/main.js` | Rendering, UI event handlers, auto-play loop |
| `styles.css` | All styling |

## Architecture

Globals-based design (no import/export). Files loaded in order in `index.html`.

See `AGENTS.md` for detailed conventions and state machine.
