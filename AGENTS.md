# 日本麻將遊戲 — 開發文件

## 專案概述

單機日本麻將遊戲，純 HTML+JS+CSS 前端架構。
使用 Unicode 麻將牌區段 U+1F000..U+1F02F 渲染牌面。
支援完整日本麻將規則、三位 AI 對手（可分別設定難度）、東風/半莊/一莊三種長度。

## 檔案結構與職責

```
jpmj/
├── index.html      # 入口 HTML，載入所有 CSS/JS
├── styles.css      # 所有樣式（標題畫面、牌桌、牌的動畫、結算畫面）
└── js/
    ├── main.js     # 狀態機、畫面切換、UI 事件綁定、主迴圈
    ├── tiles.js    # Tile 類別、牌面定義、Unicode 對應、排序/分類工具
    ├── wall.js     # 牌山生成、洗牌、配牌、摸牌、王牌/寶牌管理
    ├── yaku.js     # 手牌分解、役種判斷、符數計算、點數計算
    ├── ai.js       # AI 策略（高手/一般人/初學者）、打牌/鳴牌/立直決策
    └── game.js     # Game 類別、局流程（配牌→摸打→鳴牌→和/流局）、勝負判定
```

### 各檔案將產生之內容

#### `main.js` — 進入點與狀態機

```javascript
// 狀態定義
const SCREEN = { TITLE:0, GAME:1, RESULT:2 };

// 全域狀態
let gameState = { screen: SCREEN.TITLE, /* ... */ };

// 主要函數
function init()          // 初始設定、綁定事件
function showTitle()     // 渲染標題畫面
function startGame()     // 讀取選項、初始化 Game、開始第一局
function renderGame()    // 渲染牌桌（手牌、捨牌、副露、點數等）
function updateActions() // 更新操作按鈕狀態
function handleAction()  // 處理玩家動作
function gameLoop()      // 非同步主迴圈（AI 回合自動進行）
function showResult()    // 渲染結算畫面
function backToTitle()   // 回到標題
```

#### `tiles.js` — 牌定義層

**Tile 類別：**
```javascript
class Tile {
  constructor(suit, value)  // suit:'man'|'pin'|'sou'|'honor', value:1-9
  get codePoint()           // 回傳 Unicode 碼點 U+1F000..
  get char()                // 回傳字元 String.fromCodePoint
  get name()                // 回傳文字名稱（例："一萬"）
  get isTerminal()          // 么九牌（1,9 或 honor）
  get isHonor()             // 字牌（風牌/三元牌）
  get isSangen()            // 三元牌
  get isWind()              // 風牌
  equals(other)             // 比較是否同種牌
}
```

**Unicode 對應表（U+1F000 - U+1F021）：**
| 碼點 | 牌 | 碼點 | 牌 | 碼點 | 牌 |
|------|-----|------|-----|------|-----|
| U+1F000 🀀 | 東 | U+1F00B 🀋 | 七萬 | U+1F016 🀖 | 六筒 |
| U+1F001 🀁 | 南 | U+1F00C 🀌 | 八萬 | U+1F017 🀗 | 七筒 |
| U+1F002 🀂 | 西 | U+1F00D 🀍 | 九萬 | U+1F018 🀘 | 八筒 |
| U+1F003 🀃 | 北 | U+1F00E 🀎 | 一筒 | U+1F019 🀙 | 一索 |
| U+1F004 🀄 | 中 | U+1F00F 🀏 | 二筒 | U+1F01A 🀚 | 二索 |
| U+1F005 🀅 | 發 | U+1F010 🀐 | 三筒 | U+1F01B 🀛 | 三索 |
| U+1F006 🀆 | 白 | U+1F011 🀑 | 四筒 | U+1F01C 🀜 | 四索 |
| U+1F007 🀇 | 一萬 | U+1F012 🀒 | 五筒 | U+1F01D 🀝 | 五索 |
| U+1F008 🀈 | 二萬 | U+1F013 🀓 | 六筒 | U+1F01E 🀞 | 六索 |
| U+1F009 🀉 | 三萬 | U+1F014 🀔 | 七筒 | U+1F01F 🀟 | 七索 |
| U+1F00A 🀊 | 四萬 | U+1F015 🀕 | 八筒 | U+1F020 🀠 | 八索 |
|     |     |     |     | U+1F021 🀡 | 九索 |

**靜態方法：**
```javascript
Tile.fromString(str)          // "m1" → Tile('man',1), 或 "1z"→ honor 1
Tile.allTiles()               // 生成完整 136 張牌陣列
Tile.sortTiles(tiles)         // 排序（萬→筒→索→字）
Tile.groupBySuit(tiles)       // 按花色分組
```

#### `wall.js` — 牌山與配牌

```javascript
class Wall {
  constructor()
  shuffle()                    // 洗牌
  deal(players)                // 配牌（每人13/14張）
  draw()                       // 摸牌（從牌山取一張）
  getRemainingCount()          // 剩餘張數
  getDoraIndicators()          // 寶牌指示牌（目前有幾張翻開）
  getUraDoraIndicators()       // 裏寶牌指示牌（立直時）
  getDeadWallLength()          // 王牌長度（通常14張）
  isDeadWallEmpty()            // 是否已到海底（剩餘0張）
}
```

**規則細節：**
- 總張數 136（不含花牌）
- 王牌固定保留 14 張，最後 4 張為嶺上牌
- 寶牌指示牌在王牌區左側，隨開槓遞增

#### `yaku.js` — 役種與計分（最複雜模組）

**手牌分解演算法：**
```javascript
function analyzeHand(tiles, melds) {
  // 1. 檢查特殊役（七對子、國士無雙）
  // 2. 標準分解：枚舉所有 4面子+1雀頭 組合
  // 3. 對每個有效分解，檢查適用役種
  // 4. 回傳最高得點組合
}

function findMelds(tiles) { /* 遞迴分解所有可能的面子組合 */ }
function isChi(tiles)       /* 順子判定 */ 
function isPon(tiles)       /* 刻子判定 */ 
function isKan(tiles)       /* 槓子判定 */ 
function isPair(tiles)      /* 雀頭判定 */
```

**役種檢查函數（每個回傳 han 數或 0）：**
```javascript
// 一番
function checkRiichi(hand)            // 立直
function checkIppatsu(hand)           // 一発
function checkMenzenTsumo(hand)       // 門前清自摸和
function checkPinfu(hand)            // 平和
function checkTanyao(hand)           // 断幺九
function checkIipeikou(hand)         // 一盃口
function checkYakuhai(hand)          // 役牌

// 二番
function checkSanshokuDoujun(hand)    // 三色同順
function checkIttsuu(hand)           // 一気通貫
function checkChanta(hand)           // 混全帯么九
function checkToitoi(hand)           // 対々和
function checkSanankou(hand)         // 三暗刻
function checkHonroutou(hand)        // 混老頭
function checkShousangen(hand)       // 小三元
function checkSankantsu(hand)        // 三槓子
function checkChiitoitsu(hand)       // 七対子
function checkHonitsu(hand)          // 混一色

// 三番
function checkJunchan(hand)          // 純全帯么九
function checkRyanpeikou(hand)       // 二盃口

// 六番
function checkChinitsu(hand)         // 清一色

// 特殊
function checkTenhou(hand)           // 天和
function checkChiihou(hand)          // 地和
function checkRenhou(hand)           // 人和
function checkNagashiMangan(hand)    // 流し満貫
```

**符數計算：**
```javascript
function calculateFu(hand, winType, waitType) {
  let fu = 20;                     // 基礎符
  if (menzenRon) fu += 10;         // 門前栄和加符
  fu += pairFu(pair);              // 雀頭加符
  fu += meldFu(melds);             // 面子加符（明刻/暗刻/明槓/暗槓）
  fu += waitFu(waitType);          // 待ち形加符（單騎/嵌張/邊張）
  fu += tsumoFu();                 // 自摸加符（+2，平和例外）
  return Math.ceil(fu / 10) * 10;  // 無條件進位到十位
}
```

**點數計算：**
```javascript
function calculateScore(han, fu, isDealer, isTsumo) {
  // 基本點 = fu × 2^(2+han)
  let base = fu * Math.pow(2, 2 + han);
  
  // 滿貫以上直接對照
  if (han >= 5) {
    if (han >= 13)      base = 8000;  // 役滿
    else if (han >= 11) base = 6000;  // 三倍滿
    else if (han >= 8)  base = 4000;  // 倍滿
    else if (han >= 6)  base = 3000;  // 跳滿
    else                base = 2000;  // 滿貫
  }
  
  if (isDealer) {
    // 親家：支付 = 基本點 × 2 × 人數
    // ツモ：每人支払 base × 2（切り上げ）
    // ロン：放銃者支払 base × 6
  } else {
    // 子家：ツモ→ 親 base×2 + 子 base
    // ロン→ 放銃者支払 base × 4
  }
}
```

#### `game.js` — 遊戲流程

```javascript
class Game {
  constructor(options)           // options: { length, difficulties[] }
  
  // 狀態
  getOrCreateState()             // 初始化或回存狀態
  reset()                        // 重置
  
  // 流程控制
  startNewRound()                // 開始新一局（配牌、決定親家）
  nextTurn()                     // 前進到下一個玩家回合
  drawPhase()                    // 摸牌階段
  discardPhase(tile)             // 打牌階段
  callPhase(discardedTile)       // 鳴牌階段（檢查其他三家是否喊鳴）
  
  // 玩家操作（由 UI 或 AI 觸發）
  playerDiscard(player, tileIndex)    // 玩家打牌
  playerChi(player, tiles)            // 吃
  playerPon(player, tile)             // 碰
  playerKan(player, tile)             // 槓
  playerRiichi(player)                // 立直
  playerRon(player, tile)             // 榮和
  playerTsumo(player)                 // 自摸
  playerPass(player)                  // 過
  
  // 判定
  checkRonAfterDiscard(discardedTile, discarder)  // 檢查榮和
  checkTsumo(player)                               // 檢查自摸
  checkTenpai(player)                              // 檢查聽牌
  checkExhaustiveDraw()                            // 流局判定
  
  // 局結束
  endRound(winner, hand, winType, tile)  // 結束此局，結算分數
  calculateFinalScores()                 // 遊戲結束最終點數
  isGameOver()                           // 檢查遊戲是否結束
  
  // 資料
  getRoundWind()          // 場風（0=東,1=南,2=西,3=北）
  getGameLength()         // 遊戲長度（最多第幾風）
}
```

**局流程 pseudocode：**
```
startNewRound:
  1. 洗牌 Wall.shuffle()
  2. 親家拿 14 張，子家各拿 13 張
  3. 設定王牌區
  4. 翻寶牌指示牌
  5. 親家回合開始（打出一張牌）
  6. 檢查是否天和/地和

nextTurn:
  1. 摸牌（從牌山）
  2. 檢查自摸
  3. 進入打牌階段

playerDiscard:
  1. 移除手牌中的指定牌
  2. 加入該玩家捨牌區
  3. 如果是立直狀態且沒有一発，標記取消
  4. 檢查其他玩家是否要鳴牌或榮和
     a. 優先級：榮和 > 槓 > 碰 > 吃
     b. 若無叫牌，nextTurn（下一家）
     c. 若有叫牌，處理該動作

endRound:
  1. 計算符數、翻數
  2. 計算支付點數
  3. 更新玩家分數
  4. 如果有本場棒/供託，一併計算
  5. 判斷是否遊戲結束
  6. 若繼續，startNewRound（進一局）
  7. 若結束，回傳最終結果
```

#### `ai.js` — AI 策略

```javascript
class AIPlayer {
  constructor(game, playerIndex, difficulty)
  // difficulty: 'expert' | 'normal' | 'beginner'
  
  // 主要決策
  decideDiscard()              // 打哪一張
  decideCall(callType, tiles)  // 是否鳴牌（吃/碰/槓）
  decideRiichi()               // 是否立直
  decideRon()                  // 是否榮和
  decideKan()                  // 是否加槓/暗槓
}

// 難度差異
const AI_STRATEGY = {
  expert: {
    name: '高手',
    discardFn: 'expertDiscard',
    callRate: 0.7,
    riichiRate: 0.8,
    defenseLevel: 2  // 0=無防守,1=基本,2=完全
  },
  normal: {
    name: '一般人',
    discardFn: 'normalDiscard',
    callRate: 0.4,
    riichiRate: 0.5,
    defenseLevel: 1
  },
  beginner: {
    name: '初學者',
    discardFn: 'beginnerDiscard',
    callRate: 0.9,
    riichiRate: 0.2,
    defenseLevel: 0
  }
}
```

**AI 打牌策略細節：**
- **高手**：牌効率（向聽數最小化）+ 防守（讀牌河、避險牌）+ 好形優先
- **一般人**：牌効率為主 + 偶爾防守 + 基本形聽牌
- **初學者**：隨機打牌（但保留對子/搭子），幾乎不防守

**防守機制：**
- 牌危險度判定（牌河 + 副露 + 立直 + 切牌時機）
- 現物（其他家打過的牌）安全
- 無筋牌高危險
- 防守時只打安全牌或切筋牌

#### `styles.css` — 樣式

**主題變數：**
```css
:root {
  --table-green: #0a5c2a;
  --table-dark: #064d22;
  --tile-back: #f5f0e0;
  --tile-border: #8b7355;
  --gold: #c9a84c;
  --red: #cc3333;
  --blue: #2255aa;
  --text-light: #f0f0e0;
  --shadow: rgba(0,0,0,0.5);
}
```

**主要區塊 layout：**
- 標題畫面：全螢幕置中，背景麻將牌裝飾
- 牌桌：四方位佈局（東西南北），中間為牌山/寶牌
- 玩家手牌：底部，橫向排列，可點擊
- 捨牌區：各玩家右側（或對應方位）
- 副露區：各玩家左側
- 操作按鈕：底部或手牌上方
- 結算畫面：全螢幕覆蓋，排名列表

**響應式設計：**
- 使用 vw/vh/flex 相對單位
- 最小支援 1024x768 解析度
- 牌的尺寸：約 4.5vw x 6vw（桌面端），可點擊區域足夠大

#### `index.html` — 入口

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>日本麻將</title>
  <link rel="stylesheet" href="styles.css">
  <style>
    /* 或在 styles.css 定義 */
  </style>
</head>
<body>
  <!-- 標題畫面 -->
  <div id="title-screen">...</div>
  
  <!-- 遊戲畫面 -->
  <div id="game-screen" style="display:none">
    <div id="table">...</div>
    <div id="controls">...</div>
  </div>
  
  <!-- 結算畫面 -->
  <div id="result-screen" style="display:none">...</div>
  
  <script src="js/tiles.js"></script>
  <script src="js/wall.js"></script>
  <script src="js/yaku.js"></script>
  <script src="js/ai.js"></script>
  <script src="js/game.js"></script>
  <script src="js/main.js"></script>
</body>
</html>
```

---

## 狀態機

```
        startGame()
TITLE ────────────→ GAME
  ↑                  │
  │                  │ round over & game not over
  │                  ↓
  │               (continue round)
  │                  │
  │                  │ game over
  │                  ↓
  │               RESULT
  └── backToTitle ←──┘
```

### 子狀態（GAME 畫面中）

```
NEW_ROUND → DRAW → ACTION_CHECK → DISCARD → CALL_CHECK
                ↑       ↓                         │
                └── (tsumo)                        │
              ROUND_END ←──────────────────────────┘
                         ↑  (ron/call & game end)
                         ↓
              (or exhaustive draw)
```

## 資料結構

### Tile
```javascript
// { suit: 'man'|'pin'|'sou'|'honor', value: 1-9 }
// suit='honor' 時 value 1=東 2=南 3=西 4=北 5=白 6=發 7=中
```

### Meld
```javascript
// { type: 'chi'|'pon'|'kan'|'chakan'|'ankan',
//   tiles: [Tile, Tile, Tile],
//   from: playerIndex|null }
```

### Hand 分析結果
```javascript
// { melds: [meld, ...], pair: Tile, yaku: [ {name, han} ],
//   totalHan, fu, score, isYakuman, winType, waitType }
```

## 開發順序

1. **`tiles.js`** — Tile 類別與牌面定義（無相依）
2. **`wall.js`** — 牌山與配牌（相依 tiles）
3. **`yaku.js`** — 役種判定與計分（相依 tiles，最核心）
4. **`game.js`** — 遊戲流程控制（相依 tiles, wall, yaku）
5. **`ai.js`** — AI 策略（相依 game, tiles）
6. **`styles.css`** — 完整樣式
7. **`main.js`** — 狀態機與 UI 整合（相依全部）
8. **`index.html`** — 入口點

## 規則注意事項

- 採用一般日本麻將規則（無花牌、無赤牌）
- 懸賞牌（ドラ）：表ドラ + 槓ドラ、裏ドラ僅限立直者
- 一発：立直後第一巡內和牌（若期間有鳴牌則取消）
- 途中流局（九種九牌、四風連打、四槓散了、四家立直、三家和了）：可選支援
- 連莊條件：親家和牌或流局聽牌（聽牌連莊）
- 供託：立直時千點棒
- 300/500 點等低點數精算

## 開發命令

本專案為純前端，無需建置工具。直接使用瀏覽器開啟 `index.html` 即可遊玩。
若要測試，使用 `python3 -m http.server 8080` 或同類靜態伺服器後瀏覽。
