# 日本麻將遊戲

單機日本麻將，純 HTML+JS+CSS，無任何構建工具/依賴。136 張牌，無花牌/赤牌。Unicode U+1F000..U+1F02F 渲染牌面。

## Dev

```bash
python3 -m http.server 8080     # 唯一需要的指令
```

無測試、無 lint、無 typecheck、無 CI。

## Architecture

- **Globals-based**: 無 import/export。所有檔案在 `index.html` 依序載入：
  `tiles.js → wall.js → yaku.js → ai.js → game.js → main.js`
- 共用 helper 皆為 global function：`getCounts`, `removeTiles`, `findTile`, `checkTenpai`, `estimateShanten`, `aiDecideTsumo` 等定義在 `yaku.js`/`ai.js`
- 新增程式碼時要注意 global 命名碰撞

## Key Conventions

| 手法 | 檔案 | 關鍵 |
|------|------|------|
| `Tile.fromString("m1")` | tiles.js | `"m1"` → man-1, `"1z"` → honor-1 |
| `tile.key()` → `"man5"` | tiles.js | 統一格式 |
| 向聽數估算 | ai.js | 每花色 DP (`solveSuitDP`) + 字牌獨立處理 |
| `tileDangerLevel(game, tile, useSuji)` | ai.js | 高手傳 `useSuji=true` |
| 自動玩捨牌用 `normalDiscard` | ai.js | 非 `expertDiscard` |
| 暗槓/加槓條件 | game.js:536 | `shantenAfter <= shantenBefore` (AI 會主動進行) |
| Pon/Chi 條件 | ai.js:473 | `shantenAfter < shantenBefore` |
| 鳴牌優先權 | game.js:288 | `ron > kan > pon > chi` |
| 王牌區 dead wall 起始 index 122，嶺上牌從 index 135 往下取 | wall.js | |
| 寶牌最多 5 張，每槓 `addDoraIndicator()` | wall.js | |

## State Machine

```
TITLE → GAME → RESULT → TITLE
```

GAME 子狀態：
```
dealer_first_discard → draw → discard → call_pending → advanceTurn → draw
                         ↑       ↓         │
                         └─ tsumo(win)      ├─ ron(win)
                                            ├─ pon/chi/kan → discard/rinshan
                                            └─ pass → advanceTurn
                        rinshan → discard → ...
                        exhaustive_draw → round_end
```

主迴圈：`renderGame() → game.advance() → renderGame() → setTimeout(500ms)`
- `advance()` 回傳 `true` 且非 auto-play → 等待人類輸入
- 回傳 `false` → 500ms 後繼續

## Data Structures

```javascript
// Tile: { suit: 'man'|'pin'|'sou'|'honor', value: 1-9 }
// honor: 1=東 2=南 3=西 4=北 5=白 6=發 7=中
// Meld: { type: 'chi'|'pon'|'kan', tiles: [Tile*3|4], open: bool, from: idx }
// Player: { name, hand, melds, discards, score, isHuman, difficulty,
//           isRiichi, ippantumRound, riichiBet, isTenpai, lastDraw, seatWind }
// GameState: { isDealer, seatWind, roundWind, winType, winTile, isRiichi, 
//             isIppatsu, isTenhou, isChiihou, isRenhou, doraIndicators }
```

## CSS

主題色：`--table-green: #0a5c2a`, `--gold: #c9a84c`, `--tile-back: #f5f0e0`
牌背 unicode：`🀫` (U+1F02B)