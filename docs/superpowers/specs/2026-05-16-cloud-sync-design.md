# Cloud Sync Design — Supabase Storage Adapter

**Date:** 2026-05-16  
**Status:** Approved  
**Goal:** 讓非工程師同事不需匯入匯出、不需 git，開啟工具後直接看到審核者的標註。

---

## Problem

標註資料目前存在每個人的 `localStorage`（瀏覽器各自獨立）。  
審核者完成標註後，同事必須手動匯出 JSON → 傳送檔案 → 對方匯入，流程繁瑣。

**目標體驗：**  
> 審核者完成後，只需告知「XX 專案審核完了」。  
> 同事打開工具、選擇專案，直接看到所有標註，不需任何其他操作。

---

## Architecture

### Storage Adapter Pattern

所有標註讀寫透過統一介面，後端可替換：

```
src/
  store.js          → LocalAdapter（localStorage，原有邏輯整理）
  store-cloud.js    → SupabaseAdapter（Supabase REST API）
  store-factory.js  → 依設定選擇 adapter
```

**介面（每個 Adapter 皆實作）：**

```js
class StorageAdapter {
  async listProjects()                                      // → [{id, name}]
  async createProject(name)                                 // → {id, name}
  async deleteProject(id)                                   // → void
  async getAnnotations(projectId, pageUrl)                  // → [annotation]
  async saveAnnotation(projectId, pageUrl, pageTitle, ann)  // → annotation
  async updateAnnotation(id, data)                          // → annotation
  async deleteAnnotation(id)                                // → void
  async getAllAnnotations(projectId)                        // → {[pageUrl]: [annotation]}
}
```

**選擇邏輯（`store-factory.js`）：**

```js
export function getStore() {
  const config = loadConfig()   // 從 localStorage 讀 comment-tool-config
  if (config.supabaseUrl && config.supabaseKey) {
    return new SupabaseAdapter(config)
  }
  return new LocalAdapter()     // 沒設定時 fallback，保持向下相容
}
```

---

## Data Model

### Supabase Tables

**`projects`**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | uuid (PK) | `gen_random_uuid()` |
| `name` | text NOT NULL | 專案名稱 |
| `created_at` | timestamptz | `now()` |

**`annotations`**

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | uuid (PK) | `gen_random_uuid()` |
| `project_id` | uuid (FK → projects.id) | 所屬專案 |
| `page_url` | text NOT NULL | 頁面完整網址 |
| `page_title` | text | 頁面標題 |
| `selector` | text | CSS selector（用於定位元素）|
| `x` | float8 | 相對位置 x（0~1）|
| `y` | float8 | 相對位置 y（0~1）|
| `w` | float8 | 寬度比例 |
| `h` | float8 | 高度比例 |
| `text` | text | 標註文字 |
| `created_at` | timestamptz | `now()` |
| `updated_at` | timestamptz | `now()` |

> **Pages 不獨立成表**：`page_url` 直接存在 annotations，減少 join 複雜度，也讓未來換 DB 更容易。

**Setup SQL（一次執行）：**

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table annotations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  page_url text not null,
  page_title text,
  selector text,
  x float8,
  y float8,
  w float8,
  h float8,
  text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 讓 anon key 可以讀寫（小團隊信任模式）
alter table projects enable row level security;
alter table annotations enable row level security;

create policy "anon full access" on projects for all using (true) with check (true);
create policy "anon full access" on annotations for all using (true) with check (true);
```

---

## Auth & Permissions

**現階段：anon key（無登入）**

- 所有人都能讀取 / 新增 / 修改 / 刪除
- 靠團隊信任維護資料
- 不需要帳號系統

**未來擴充（只動 Adapter，不改其他程式碼）：**

- 開啟 Supabase Auth → SupabaseAdapter 加上 JWT token
- 或換成 CompanyAdapter 對接公司 API + SSO

---

## Configuration UX

設定儲存在本機 `localStorage['comment-tool-config']`：

```json
{
  "supabaseUrl": "https://xxxx.supabase.co",
  "supabaseKey": "eyJ..."
}
```

工具面板新增「⚙ 設定」入口，展開後顯示：
- Supabase Project URL 輸入框
- Supabase Anon Key 輸入框
- 儲存按鈕（儲存後重新整理以載入雲端資料）

**第一次設定流程：**

1. Maintainer 在 Supabase 建免費專案、執行建表 SQL（5 分鐘）
2. 把 URL + Key 透過 Slack/Teams/Email 傳給所有同事
3. 同事開工具 → 設定 → 貼上 → 儲存
4. 完成，之後永遠共享

---

## Migration Path

未來換公司 DB 時，只需：

1. 新增 `src/store-company.js`，實作同一個 `StorageAdapter` 介面
2. 在 `store-factory.js` 加上判斷條件
3. 不改任何 UI、業務邏輯、資料結構

---

## Files Changed

| 檔案 | 變動 |
|------|------|
| `src/store.js` | 整理成 `LocalAdapter` class，export default 不變（向下相容） |
| `src/store-cloud.js` | 新增 `SupabaseAdapter` class |
| `src/store-factory.js` | 新增 `getStore()` factory function |
| `src/index.js` | 改用 `getStore()` 取得 adapter |
| `src/panel.js` | 新增設定 UI（URL + Key 輸入 + 儲存按鈕） |

---

## Out of Scope

- 離線支援（Supabase 無法連線時的 fallback）
- 多人即時同步（Supabase Realtime）
- 衝突解決策略
- 用戶身份識別（標註顯示「由誰建立」）

這些可作為未來版本的功能。
