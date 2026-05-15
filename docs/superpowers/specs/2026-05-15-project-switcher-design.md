# Project Switcher — Design Spec

**Date:** 2026-05-15  
**Status:** Approved

## Problem

目前的專案切換介面使用全頁 modal dialog，操作步驟多，且：

- 沒有辦法看到一個專案裡有哪些頁面（URL）
- 無法從面板直接導航到某個已標註的頁面
- 手動建立的空專案（沒有任何標註）無法被儲存

## Design

### 行為邏輯

1. 面板 `proj-bar` 改為一個按鈕，顯示目前專案名稱，點擊展開 flyout
2. Flyout 為 accordion 式的專案清單：
   - 每個專案可展開，顯示該專案的所有已標註頁面（URL path + 標註數）
   - 目前專案預設展開
   - 點擊其他專案 → 展開該專案的頁面清單（不切換）
   - 點擊頁面連結 → 導航到該 URL 並切換到該專案（`window.location.href = url`）
   - 每個非目前專案旁有「刪除」按鈕（含確認）
3. Flyout 底部有「新增專案」輸入框：
   - 輸入名稱 → 按建立 → 建立空專案 + 立即切換到新專案（停留在目前頁面）
4. 點擊 flyout 外部或按 Escape → 關閉 flyout，不做任何切換

### 切換規則

- **切換 = 點頁面連結**（navigate + switch）
- **新增專案 = 建立 + 立即切換**（唯一例外，因為沒有頁面可選）
- 只展開專案（不點頁面）= 不切換

### URL 顯示

- 列表中顯示 `pathname + search`（例如 `/dashboard?tab=overview`），不顯示 origin
- 導航時使用完整儲存的 URL（包含 origin）

---

## Data Layer (`store.js`)

### 新增：專案名稱清單

新增 key：`comment-tool:__project-list__`

存放手動建立的空專案名稱（JSON array of strings）。
與從 annotation keys 推導出的專案合併，確保空專案也能被列出。

### 新增函式

```js
createProject(name)
// 將 name 加入 __project-list__（若不存在）

listProjectPages(projectName)
// 掃描 localStorage，找出所有 comment-tool:<projectName>:<url> 的 key
// 回傳 Array<{ url: string, path: string, count: number }>
// path = new URL(url).pathname + new URL(url).search
```

### 更新函式

```js
listProjects()
// 合併：__project-list__ 中的名稱 + 從 annotation keys 推導的名稱
// 去重、排序後回傳

deleteProject(name)
// 現有：刪除所有 comment-tool:<name>:<url> 的 key
// 新增：同時從 __project-list__ 移除該名稱
```

---

## UI Layer (`panel.js`)

### 移除

- `.proj-bar` 的 `切換` button
- `showProjectDialog()` method（整個刪除）
- 對應的 `.proj-overlay`, `.proj-mgr` 等 modal CSS

### 新增

**`.proj-flyout-btn`**：取代 `proj-bar` 的切換按鈕，顯示 `📁 <project-name> ▾`，點擊 toggle flyout

**`.proj-flyout`**：inline flyout div，包含：

```
[ 專案 accordion 清單 ]
  ├ [ ✓ current-project ]  ← 預設展開
  │     ↗ /page-a  N 筆
  │     ↗ /page-b  N 筆
  ├ [ other-project ]  ▶  [刪]  ← 點擊展開
  │     ↗ /page-c  N 筆
  └ [ another-project ]  ▶  [刪]
[ 新增專案輸入列 ]
  [ input: 新專案名稱… ] [ 建立 ]
```

**事件**：
- 點頁面連結 → emit `navigateToPage` with `{ url, project }`
- 按「建立」→ emit `createProject` with `{ name }`
- 按「刪除」→ emit `deleteProject` with `{ name }`（同現有流程，panel 內 confirm）

### 公開 API 變更

移除：`showProjectDialog(projects, current, opts)`  
新增：`setFlyoutData(projects, pagesMap)` — 用於重新渲染 flyout 內容（在 flyout 開啟時）

---

## Orchestration (`index.js`)

### 移除

- `switchProject()` 整個 async function（flyout 取代其功能）
- `panel.on('switchProject', ...)` handler

### 新增 handlers

```js
panel.on('navigateToPage', ({ url, project }) => {
  setCurrentProject(project);
  window.location.href = url;
});

panel.on('createProject', ({ name }) => {
  if (!name) return;
  createProject(name);       // store.js
  project = name;
  setCurrentProject(name);
  store = new CommentStore(project, url);
  panel.setProject(project);
  refresh();
});

panel.on('deleteProject', ({ name }) => {
  deleteProject(name);
  // flyout re-renders automatically via panel
});
```

### Flyout 開啟時的資料更新

flyout 開啟時（`panel.on('flyoutOpen')`），重新計算並傳入：

```js
panel.on('flyoutOpen', () => {
  const projects = listProjects();
  const pagesMap = Object.fromEntries(
    projects.map(p => [p, listProjectPages(p)])
  );
  panel.setFlyoutData(projects, pagesMap);
});
```

---

## 首次啟動流程

當 `getCurrentProject()` 為空（第一次使用）：

- 不顯示任何 dialog
- 自動建立並切換到預設專案 `"default"`
- 面板正常開啟，flyout 可用（顯示唯一的 `"default"` 專案）
- 使用者之後可透過 flyout 的「新增專案」建立其他專案並切換

---

## Out of Scope

- URL 正規化（query params / hash fragments）：維持現狀，完整 URL 作為 key
- 跨網站的專案隔離（domain scope）：維持現狀，全域共用
- 標註搜尋 / 篩選
- 專案重新命名
