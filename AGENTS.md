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
| `VARIANT_SELECTOR`（`'\uFE0E'` 或 `'\uFE0F'`） | tiles.js 宣告，main.js 使用 | 全域變數，`tile.char` 與所有牌背共用 |
| 向聽數估算 | ai.js | 每花色 DP (`solveSuitDP`) + 字牌獨立處理 |
| `tileDangerLevel(game, tile, useSuji)` | ai.js | 高手傳 `useSuji=true` |
| 自動玩捨牌用 `normalDiscard` | ai.js | 非 `expertDiscard` |
| 暗槓/加槓條件 | game.js | `shantenAfter <= shantenBefore` (AI 會主動進行) |
| Pon/Chi 條件 | ai.js | `shantenAfter < shantenBefore` |
| 鳴牌優先權 | game.js | `ron > kan > pon > chi` |
| 王牌區 dead wall 起始 index 122，嶺上牌從 index 135 往下取 | wall.js | |
| 寶牌最多 5 張，每槓 `addDoraIndicator()` | wall.js | |
| 役種 split：`STANDALONE_YAKU` / `BONUS_YAKU` | yaku.js | 偶然役/ドラ為 bonus，不計入開牌判定 |
| `findDecompositionsWithOpen` 不減去副露牌 | yaku.js | 手牌已不含副露牌，減去會誤扣第 4 張 |
| 振聽判斷 | game.js `isFuriten` | 永久振聽（比對捨牌與待牌 key） |
| 海底牌禁止吃碰槓 | game.js `buildAvailableCalls` | 以 `wall.isExhausted()` 阻擋 |
| 立直棒跨局保留 | game.js `riichiSticks` | 流局無聽牌時保留至次局；有聽牌時分配 |
| 流局詳細顯示 | main.js `showRoundResult` | 罰符、立直棒去向、連莊/輪莊、次局名稱 |
| `roundResult` 擴充欄位 | game.js | `preDistributeRiichiSticks`, `notenPayment`, `riichiPerTenpai`, `isRenchan`, `nextRoundLabel` |

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
// roundResult (win): { winner, winType, yaku, totalHan, fu, payments, isYakuman,
//                       winTile, honba, riichiSticks, doraHan, isRenchan, nextRoundLabel }
// roundResult (exhaustive): { winner:-1, winType:'exhaustive', tenpaiPlayers, notenPlayers,
//                              honba, riichiSticks, preDistributeRiichiSticks,
//                              notenPayment, riichiPerTenpai, isRenchan, nextRoundLabel }
```

## UI Conventions

| 行為 | 場所 | 規則 |
|------|------|------|
| 滿貫以上表示 | main.js `getRankLabel` | 5飜=満貫、6-7=跳満、8-10=倍満、11-12=三倍満、13+=数え役満、役滿=役満/N倍役満 |
| 滿貫以上 yaku 列表 | main.js `showRoundResult` | 僅列役種名稱，不顯示飜數、不含「合計 X飜 Y符」 |
| 點數支付明細 | main.js `showRoundResult` | ツモ/ロン皆顯示每位玩家的 +/- 分數變動 |
| 無役/振聽提示 | main.js `renderControls`, game.js `buildAvailableCalls` | ロン按鈕改為 disabled 灰鈕並標註「ロン(無役)」/「ロン(振聽)」 |
| 聽牌提示 | main.js `renderPlayerArea` | 僅顯示「聽」/「聽（振聽）」，不再逐牌檢查有役 |

## CSS

主題色：`--table-green: #0a5c2a`, `--gold: #c9a84c`, `--tile-back: #f5f0e0`
牌背 unicode：`🀫` (U+1F02B)