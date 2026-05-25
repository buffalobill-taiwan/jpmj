# 日本麻將遊戲

單機日本麻將（Riichi Mahjong）。純 HTML+JS+CSS，無任何構建工具或外部依賴。

線上遊玩：<https://buffalobill-taiwan.github.io/jpmj/>

## 快速開始

```bash
python3 -m http.server 8080
open http://localhost:8080
```

## 功能

- 136 張牌（無花牌、無赤牌）
- Unicode U+1F000..U+1F02F 渲染牌面（使用 [Riichi-Mahjong 字型](https://github.com/rutopio/Japanese-Mahjong-Font-with-OpenType/)）
- 完整的標準役種支援：
    - **一般役**：立直、一發、**雙立直**、門前清自摸和、平和、斷幺九、一盃口、二盃口、役牌、**嶺上開花**、**槍槓**、海底、河底、三色同順/同刻、一氣通貫、對對和、三暗刻、混全/純全、混老頭、小三元、三槓子、混一色、清一色。
    - **役滿**：天和、地和、**國士無雙**、**大三元**、**四暗刻**、**字一色**、**綠一色**、**清老頭**、**九蓮寶燈**、**四槓子**。
- 流局（不聽罰符、立直棒分配）
- 連莊／輪莊處理
- AI 對手，可調強度
- 聽牌／防禦提示
- 視覺優化：立直宣告牌自動橫置，穩定的捨牌區佈局。

## 檔案結構

| 檔案 | 內容 |
|------|------|
| `index.html` | 入口，依序載入所有腳本 |
| `js/tiles.js` | Tile 類別、牌生成 |
| `js/wall.js` | 牌山／王牌管理、寶牌指示 |
| `js/yaku.js` | 役種判定、手牌分解、聽牌檢查 |
| `js/ai.js` | AI 決策、捨牌策略、危險度評估 |
| `js/game.js` | 遊戲狀態機、回合流程、計分 |
| `js/main.js` | 渲染、UI 事件處理、自動對戰 |
| `styles.css` | 所有樣式 |

## 架構

全域變數設計（無 import/export）。檔案依 `index.html` 中的順序載入。

詳細慣例與狀態機請見 `AGENTS.md`。
