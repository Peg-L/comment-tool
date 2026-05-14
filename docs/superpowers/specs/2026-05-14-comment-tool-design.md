# Comment Tool — Design Spec

**Date:** 2026-05-14  
**Status:** Approved MVP Scope

---

## Problem

審核人員需要在任意網頁上對特定 UI 元素留下意見（comment），並能將所有標註匯出為適合餵給 AI 的 Prompt。現有工具（如 UISelector2AI）以 Chrome Extension 形式存在，本工具以 Bookmarklet 形式實作，零安裝即可使用。

---

## Approach

**Bookmarklet + 單一自含 JS bundle**

使用者將一個書籤連結拖到瀏覽器工具列。點擊後，該書籤注入一段 JS（和 CSS）到當前頁面，啟動標註模式。所有狀態存於 `localStorage`，以頁面完整 URL 為 key。

---

## Architecture

```
bookmarklet.js          ← 極小 loader，動態載入 bundle（或 inline all）
  └─ comment-tool.js    ← 主程式（自含，無外部依賴）
       ├─ OverlayManager   — 管理 DOM 高亮 + 徽章
       ├─ PanelUI          — 側邊面板 HTML/CSS
       ├─ CommentStore     — CRUD + localStorage 持久化
       ├─ ElementPicker    — click-to-select 模式
       └─ Exporter         — 格式化為 AI Prompt / JSON
```

整個工具以單一 IIFE（立即執行函式）包裝，避免污染目標頁面的全域命名空間。所有樣式以 Shadow DOM 或唯一 prefix class 隔離。

---

## Components

### 1. ElementPicker

- 啟動後進入「選取模式」：滑鼠 hover 時對應元素加上藍色 outline
- 點擊後退出選取模式，觸發 comment 輸入對話框
- 記錄被選元素的 **CSS selector path**（唯一路徑，用於重新載入時還原高亮）

### 2. CommentStore

資料結構（存於 `localStorage['comment-tool:<url>']`）：

```json
{
  "version": 1,
  "url": "https://example.com/page",
  "comments": [
    {
      "id": "uuid",
      "selector": "div.header > nav > ul > li:nth-child(2)",
      "elementLabel": "nav > li:nth-child(2)",
      "text": "這個按鈕顏色不夠明顯",
      "author": "Reviewer A",
      "createdAt": "2026-05-14T13:00:00Z"
    }
  ]
}
```

操作：`add(selector, text)` / `update(id, text)` / `delete(id)` / `clear()` / `load()` / `save()`

### 3. OverlayManager

- 頁面載入後，從 CommentStore 讀取所有 comment，對每個 selector 找到對應 DOM 元素，加上：
  - 彩色高亮框（`outline`，不影響 layout）
  - 數字徽章（`position: fixed` 計算貼附在元素右上角）
- 監聽 DOM mutation，若元素消失則徽章隱藏

### 4. PanelUI

- 固定在頁面右側的側邊面板（寬 320px，可 toggle 收起）
- 面板內容：
  - **工具列**：「選取元素」按鈕、「清除全部」按鈕、「匯出 Prompt」按鈕、「匯出 JSON」按鈕、「匯入 JSON」按鈕、關閉按鈕
  - **Comment 清單**：每筆顯示徽章號碼、elementLabel、comment 文字、刪除按鈕；點擊可 scroll to element
- 使用 Shadow DOM 確保樣式不被目標頁面覆蓋

### 5. Exporter

**AI Prompt 格式：**

```
以下是審核人員針對 [page URL] 的標註意見，請根據這些意見給出改善建議：

[1] 元素：nav > li:nth-child(2)
    意見：這個按鈕顏色不夠明顯

[2] 元素：.hero-section > h1
    意見：標題文字太小，行動裝置上難以閱讀

...
```

**JSON 匯出**：完整 CommentStore JSON，供其他審核人員匯入。

---

## Data Flow

```
User clicks bookmarklet
  → inject script → init PanelUI + load CommentStore → restore OverlayManager highlights

User clicks "選取元素"
  → ElementPicker 啟動 → user clicks element
  → show input dialog → user types comment → confirm
  → CommentStore.add() → save to localStorage → OverlayManager.addHighlight()
  → PanelUI.refresh()

User clicks "匯出 Prompt"
  → Exporter.toPrompt() → copy to clipboard → toast notification

User clicks "清除全部"
  → confirm dialog → CommentStore.clear() → OverlayManager.clearAll() → PanelUI.refresh()
```

---

## Error Handling

| 情境 | 處理方式 |
|------|----------|
| Selector 找不到對應元素（頁面結構改變） | 在 PanelUI 清單中標記為「元素已不存在」，保留 comment 資料 |
| localStorage 已滿 | 提示使用者先匯出 JSON 後清除 |
| 目標頁面 CSP 阻擋 inline script | 顯示錯誤提示；需改用 Extension 版本（未來功能） |
| Shadow DOM 不支援的舊瀏覽器 | fallback 到 prefixed class 樣式隔離 |

---

## MVP Scope（明確邊界）

**In scope:**
- Bookmarklet loader
- ElementPicker（hover highlight + click to select）
- CommentStore（localStorage CRUD）
- OverlayManager（highlight + badge）
- PanelUI（側邊面板，可收起）
- Export to AI Prompt（clipboard）
- Export / Import JSON（多人共享用）
- Clear all

**Out of scope (post-MVP):**
- 即時多人協作（WebSocket / backend）
- 截圖 / 圖片區塊標註
- Chrome Extension 打包
- Comment 作者權限管理

---

## File Structure

```
comment-tool/
├── src/
│   ├── comment-tool.js    ← 主程式（自含 IIFE）
│   └── comment-tool.css   ← 若需獨立 CSS（Shadow DOM 模式下可 inline）
├── dist/
│   └── comment-tool.min.js  ← 打包後單一檔案
├── bookmarklet.js           ← 生成 bookmarklet 連結用的腳本
└── index.html               ← 說明頁，包含 bookmarklet 拖曳安裝連結
```

---

## Testing

- 手動測試：在至少 3 個不同結構的網站（含 SPA）驗證 selector 準確性
- 測試 localStorage 持久化：重新整理後標註是否還原
- 測試 Shadow DOM 樣式隔離：在有強 CSS reset 的頁面上確認面板外觀正常
- 測試 CSP 受限頁面的錯誤提示
