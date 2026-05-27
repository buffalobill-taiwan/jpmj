# 日本麻將遊戲

單機日本麻將，純 HTML+JS+CSS，無任何構建工具/依賴。136 張牌，無花牌/赤牌。Unicode U+1F000..U+1F02F 渲染牌面。

## Dev

```bash
python3 -m http.server 8080     # 唯一需要的指令
```

無測試、無 lint、無 typecheck、無 CI。

## Architecture

- **Globals-based**: 無 import/export。所有檔案在 `index.html` 依序載入：
  `tiles.js → wall.js → yaku.js → ai_base.js → ai_beginner.js → ai_normal.js → ai_expert.js → ai_factory.js → game.js → main.js`
- **AI Strategy Pattern**: AI 邏輯類別化，每個 `Player` 擁有一個 `ai` 實例。
  - `MahjongAI`: 基類，包含向聽數估算等通用 Helper。
  - `BeginnerAI`, `NormalAI`, `ExpertAI`: 具體實作不同難度的決策。
  - `AIFactory`: 用於建立實例。
- 共用 helper 皆為 global function：`getCounts`, `removeTiles`, `findTile`, `checkTenpai` 等定義在 `yaku.js`。AI 專用工具函數定義在 `ai_base.js` 的類別方法中。

## Key Conventions

| 手法 | 檔案 | 關鍵 |
|------|------|------|
| `Tile.fromString("m1")` | tiles.js | `"m1"` → man-1, `"1z"` → honor-1 |
| `tile.key()` → `"man5"` | tiles.js | 統一格式 |
| `VARIANT_SELECTOR`（`'\uFE0E'` 或 `'\uFE0F'`） | tiles.js 宣告，main.js 使用 | 全域變數，`tile.char` 與所有牌背共用 |
| 向聽數估算 | ai_base.js | 每花色 DP (`solveSuitDP`) + 字牌獨立處理 |
| **役種意識 (Target Yaku)** | ai_base.js | `evaluateTargets` 根據難度與手牌設定目標 (如 Tanyao, Honitsu, Kokushi)。高手在末盤有 **存活模式 (Survival)**。 |
| **捨牌/鳴牌邏輯** | ai_*.js | 參考 `targets` 進行 yaku-aware 評分。存活模式下高手會完全放棄進攻，只打安全牌。 |
| **託管模式** | main.js | 強制使用 `NormalAI` 邏輯 |
| `tileDangerLevel(game, tile, useSuji)` | ai_base.js | 基類方法，高手傳 `useSuji=true` |
| 自動玩捨牌用 `chooseDiscard` | ai_normal.js | 非專家模式捨牌 |
| 暗槓/加槓條件 | game.js | `decideKan` 返回 true 時進行 |
| Pon/Chi 條件 | ai_base.js/ai_*.js | 向聽數減少為基本前提 |
| 鳴牌優先權 | game.js | `ron > kan > pon > chi` |
| 王牌區 dead wall 起始 index 122，嶺上牌從 index 135 往下取 | wall.js | |
| 寶牌最多 5 張，每槓 `addDoraIndicator()` | wall.js | |
| 役種 split：`STANDALONE_YAKU` / `BONUS_YAKU` | yaku.js | 偶然役/ドラ為 bonus，不計入開牌判定 |
| `findDecompositionsWithOpen` 不減去副露牌 | yaku.js | 手牌已不含副露牌，減去會誤扣第 4 張 |
| 振聽判斷 | game.js `isFuriten` | 永久振聽（比對捨牌與待牌 key） |
| **頭跳 (Atama-hane)** | game.js | 多人榮和時僅處理第一位（由 `aiDecisions[0]` 或 `humanCall` 優先級確保） |
| **三家和了流局** | game.js | `wouldTriggerSanchaRon` 檢測，`handleSanchaRon` 執行流局 |
| **沒有人和** | yaku.js | 不實作人和役種 |
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

<!-- CODEGRAPH_START -->
## CodeGraph

This project has a CodeGraph MCP server (`codegraph_*` tools) configured. CodeGraph is a tree-sitter-parsed knowledge graph of every symbol, edge, and file. Reads are sub-millisecond and return structural information grep cannot.

### When to prefer codegraph over native search

Use codegraph for **structural** questions — what calls what, what would break, where is X defined, what is X's signature. Use native grep/read only for **literal text** queries (string contents, comments, log messages) or after you already have a specific file open.

| Question | Tool |
|---|---|
| "Where is X defined?" / "Find symbol named X" | `codegraph_search` |
| "What calls function Y?" | `codegraph_callers` |
| "What does Y call?" | `codegraph_callees` |
| "How does X reach/become Y? / trace the flow from X to Y" | `codegraph_trace` (one call = the whole path, incl. callback/React/JSX dynamic hops) |
| "What would break if I changed Z?" | `codegraph_impact` |
| "Show me Y's signature / source / docstring" | `codegraph_node` |
| "Give me focused context for a task/area" | `codegraph_context` |
| "See several related symbols' source at once" | `codegraph_explore` |
| "What files exist under path/" | `codegraph_files` |
| "Is the index healthy?" | `codegraph_status` |

### Rules of thumb

- **Answer directly — don't delegate exploration.** For "how does X work" / architecture questions, answer with 2-3 codegraph calls: `codegraph_context` first, then ONE `codegraph_explore` for the source of the symbols it surfaces. For a specific **flow** ("how does X reach Y") start with `codegraph_trace` from→to — one call returns the whole path with dynamic hops bridged — then ONE `codegraph_explore` for the bodies; don't rebuild the path with `codegraph_search` + `codegraph_callers`. Codegraph IS the pre-built index, so spawning a separate file-reading sub-task/agent — or running a grep + read loop — repeats work codegraph already did and costs more for the same answer.
- **Trust codegraph results.** They come from a full AST parse. Do NOT re-verify them with grep — that's slower, less accurate, and wastes context.
- **Don't grep first** when looking up a symbol by name. `codegraph_search` is faster and returns kind + location + signature in one call.
- **Don't chain `codegraph_search` + `codegraph_node`** when you just want context — `codegraph_context` is one call.
- **Don't loop `codegraph_node` over many symbols** — one `codegraph_explore` call returns several symbols' source grouped in a single capped call, while each separate node/Read call re-reads the whole context and costs far more.
- **Index lag — check the staleness banner, don't guess a wait.** When a codegraph response starts with "⚠️ Some files referenced below were edited since the last index sync…", the listed files are pending re-index — Read those specific files for accurate content. Files NOT in that banner are fresh and codegraph is authoritative for them. `codegraph_status` also lists pending files under "Pending sync".

### If `.codegraph/` doesn't exist

The MCP server returns "not initialized." Ask the user: *"I notice this project doesn't have CodeGraph initialized. Want me to run `codegraph init -i` to build the index?"*
<!-- CODEGRAPH_END -->
