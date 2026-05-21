# 日本麻將遊戲 — 開發狀態 (2026-05-21)

## 專案概述

單機日本麻將遊戲，純 HTML+JS+CSS 前端。使用 Unicode 麻將牌 U+1F000..U+1F02F 渲染牌面。支援完整日本麻將規則、三位 AI 對手、東風/半莊/一莊三種長度。

## 檔案結構

```
jpmj/
├── index.html      # 入口 HTML（139 行）
├── styles.css      # 所有樣式（695 行）
├── SESSION.md      # 本文件
├── AGENTS.md       # 開發架構文件（參考用）
└── js/
    ├── tiles.js    # Tile 類別、牌面定義、Unicode 對應（107 行）
    ├── wall.js     # 牌山生成、洗牌、配牌、王牌/寶牌管理（66 行）
    ├── yaku.js     # 手牌分解、役種判斷、符數/點數計算（879 行）
    ├── ai.js       # AI 策略（高手/一般人/初學者）（378 行）
    ├── game.js     # Game 類別、局流程、鳴牌、勝負判定（783 行）
    └── main.js     # 狀態機、畫面切換、UI 事件、主迴圈（559 行）
```

## 已實作功能

### 核心機制
- Tile 類別與 Unicode 對應（U+1F000–U+1F021）
- 完整 136 張牌山（無花牌）
- 洗牌、配牌、摸牌、王牌（14 張）
- 四面子+雀頭的手牌分解演算法
- 21 種役種判定（含符數計算）
- 點數計算（含滿貫以上、役滿）
- 連莊、本場棒、供託
- 寶牌（含槓寶牌）
- 裏寶牌（立直者適用）

### 遊戲流程
- 狀態機：NEW_ROUND → DRAW → DISCARD → CALL_CHECK → 循環
- 天和/地和/人和檢查
- 立直（含一発、立直後摸切）
- 門前清自摸和
- 榮和、自摸
- 流局（含途中流局選項）
- 聽牌/不聽判定
- 暗槓、加槓、大明槓、嶺上牌

### AI（3 種難度）
- 高手：向聽數最小化 + 防守（讀牌河、避險牌）+ 好形優先
- 一般人：向聽數為主 + 基本防守 + 隨機選同等級捨牌
- 初學者：隨機打牌（保留對子/搭子），幾乎不防守
- 鳴牌決策：計算鳴牌前後的向聽數進步，不進步則跳過
- 立直決策、自摸決策、槓決策

### UI
- 標題畫面（三種長度、三種難度設定）
- 牌桌四方佈局（玩家左向標準排列）
  - 玩家（P0）底部，手牌橫向排列
  - 上家（P2）頂部
  - 下家（P1）右側（270°旋轉）
  - 對家（P3）左側（90°旋轉）
- 副露置於手牌旁
  - 玩家：副露在左，手牌在右
  - 對手：手牌在左，副露在右
- 捨牌區固定 12×2 格（CSS Grid，`1fr` + 明確 `width`）
- 被叫走的捨牌半透明顯示（`.called`）
- 摸牌後新牌右側分離（金色邊框）
- 狀態列（東/南/西/北、點數、局數、殘牌數）
- 寶牌指示牌顯示
- 操作按鈕（ロン/ポン/チー/カン/立直/ツモ/スルー）
- 吃牌選擇對話框（多組合時彈窗，單一組合直接吃）
- 遊戲日誌（右下角半透明面板）
- 結算畫面（役種列表含ドラ、點數明細）
- 最終結果畫面（排名）

### 牌背
- 對手手牌使用 🀫（U+1F02B）
- 一局結束後揭露對手手牌內容

## 最近修正

### 規則修正（this commit）
- **連莊（renchan）**：親家和牌時只加本場，不進局、不換莊。`endRound()` 依 `roundResult` 判斷連莊，決定是否遞增 `roundNumber` 與更換莊家
- **局數計算**：`checkGameOver()` 改為 `roundNumber >= maxRounds`，修正 off-by-one 導致提前結束（原本少一局）
- **本場棒支付**：榮和時放銃者多付 `honba × 300`，自摸時各家多付 `honba × 100`；修正原本 winner 憑空獲得點數的 bug
- **立直棒重複計算**：移除 `p.score += this.riichiSticks * 1000` 該行，改為只透過各家 `riichiBet` 發放，修正 winner 雙倍領取的 bug
- **AI 立直**：在 `advance()` 的 discard phase 中，AI 打牌前呼叫 `aiDecideRiichi()`（原本從未被呼叫）
- **AI 鳴牌評估**：`estimateShanten()` 傳入的 melds 陣列包含新形成的面子，修正原本向聽數高估導致拒絕有利鳴牌的 bug

## 已知限制

- 無赤牌（規則正常）
- 無花牌
- 裡懸賞牌僅限立直者
- 途中流局（九種九牌、四風連打、四槓散了、四家立直、三家和了）尚未實作 UI 選項
- 無音效
- 無觸控裝置最佳化（最小支援 1024×768）

## 開發指令

```bash
# 啟動靜態伺服器
python3 -m http.server 8080
# 瀏覽器開啟 http://localhost:8080
# 無需建置工具
```

---

## 下一項功能：託管（Auto-Play）按鈕

### 目標
加入「託管」鈕，按下後進入自動遊玩狀態，由 AI 代為決定打牌/鳴牌/立直/和牌等所有操作，直到該局結束或玩家按下「中止」鈕。

### 實作範圍
僅修改 `main.js`，不變動 `game.js` / `ai.js`。重用現有 AI 函數（`aiChooseDiscard`、`aiDecideRiichi`、`aiDecideTsumo`、`handleAIKan`）。

### 新增／修改

#### 1. 全域變數 `autoPlay`（布林，預設 `false`）

#### 2. `renderControls()` 加入「託管」/「中止」按鈕
- `autoPlay === false`：顯示「託管」，點擊 → `autoPlay = true`，重繪，若 game 正在等人則呼叫 `continueGame()`
- `autoPlay === true`：顯示「中止」，點擊 → `autoPlay = false`，重繪
- 按鈕固定在控制區最左側或獨立一行，不與其他操作按鈕混淆

#### 3. `continueGame()` 加入 auto-play 分支
```
if (needHuman && autoPlay) {
  processAutoPlay()     // 以 AI 邏輯做出決策
  renderGame()          // 即時顯示結果
  setTimeout(continueGame, 500)  // 繼續循環
  return
}
```
- `gameOver` / `roundOver` 頂端檢查處設 `autoPlay = false`

#### 4. 新函數 `processAutoPlay()`
處理四種需要人類輸入的情境：

**A. 捨牌階段（`dealer_first_discard` / `discard`）**
```
1. handleAIKan(0)  // 暗槓與加槓
2. aiDecideRiichi(game, 0) → 找到打出能聽牌的牌，humanRiichi(idx)
3. aiChooseDiscard(game, 0) → humanDiscard(idx)
```

**B. 鳴牌階段（`call_pending`）**
```
篩選 game.availableActions 中屬於 P0 的 call（非 pass）
1. ron 優先 → humanCall(ronCall)
2. pon/chi → 擲骰（機率依預設難度，約 0.5），接受則 humanCall(call)
3. 其餘 → humanCall({type:'pass'})
```

**C. ツモ判斷（`availableActions` 含 `'tsumo'`）**
```
aiDecideTsumo(game, 0) → true：executeWin(0, 'tsumo', tile)
                        → false：availableActions=[], phase='discard'
```

**D. スルー（`availableActions` 含 `'pass'` 字串，非 call 結構）**
```
availableActions=[], phase='discard'
```

### 自動重設時機
- 該局結束（`roundOver`）→ `autoPlay = false`
- 遊戲結束（`gameOver`）→ `autoPlay = false`
- 玩家點擊「中止」→ `autoPlay = false`

### 不處理的邊界情況
- 不記憶託管前的選牌狀態（selectedTile 自然清空）
- 不吃牌選擇對話框（chi modal）：auto-play 一律選第一個 chiSet
- 不改變 game.js 邏輯；託管只是模擬 P0 的 UI 操作
