# Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Supabase-backed StorageAdapter so all team members share annotations in real-time without any file export/import.

**Architecture:** A StorageAdapter interface with two implementations — `LocalAdapter` (wraps existing localStorage, unchanged behaviour) and `SupabaseAdapter` (uses Supabase REST API via `fetch`). A factory function reads config from `localStorage['comment-tool-config']` and returns the right adapter. A settings UI in the panel lets users paste Supabase credentials once.

**Tech Stack:** Vanilla JS, no new npm packages, Supabase PostgREST REST API.

---

## File Map

| File | Change |
|------|--------|
| `src/store.js` | Add `LocalAdapter` class; keep all existing named exports |
| `src/store-cloud.js` | **New** — `SupabaseAdapter` |
| `src/store-factory.js` | **New** — `getStore()`, `loadConfig()`, `saveConfig()` |
| `src/index.js` | Use adapter; make `refresh()` + handlers async; wire `saveConfig` |
| `src/panel.js` | Add settings button + settings overlay |

---

## Shared Types (reference for all tasks)

**Comment object shape** (both adapters must return this exact shape):
```js
{
  id:           string,   // local: random+timestamp string; supabase: UUID string
  selector:     string,
  elementLabel: string,
  text:         string,
  meta:         { tagName: string, innerText: string, attrs: object },
  createdAt:    string,   // ISO 8601
}
```

**Project object shape**:
```js
{ id: string, name: string }
// LocalAdapter: id === name
// SupabaseAdapter: id === name (project name is PK in Supabase too)
```

**Config shape** (stored in `localStorage['comment-tool-config']`):
```js
{ supabaseUrl: string, supabaseKey: string }
```

---

## Task 1: Add LocalAdapter to src/store.js

**Files:**
- Modify: `src/store.js`

- [ ] **Step 1: Append LocalAdapter class to end of src/store.js**

Add this class at the bottom of the file (after the existing `CommentStore` class). Do not remove or change any existing exports.

```js
/**
 * LocalAdapter — wraps all localStorage operations behind the async StorageAdapter interface.
 * Falls back to this when no Supabase config is present.
 */
export class LocalAdapter {
  // ── Projects ────────────────────────────────────────────────────────────

  async listProjects() {
    return listProjects().map(name => ({ id: name, name }));
  }

  async createProject(name) {
    createProject(name);
    return { id: name, name };
  }

  async deleteProject(id) {
    deleteProject(id);
  }

  async listProjectPages(projectId) {
    return listProjectPages(projectId);
  }

  // ── Annotations ─────────────────────────────────────────────────────────

  async getAnnotations(projectId, pageUrl) {
    return new CommentStore(projectId, pageUrl).getAll();
  }

  async addAnnotation(projectId, pageUrl, pageTitle, { selector, elementLabel, text, meta }) {
    const cs = new CommentStore(projectId, pageUrl);
    return cs.add(selector, elementLabel, text, meta);
  }

  async updateAnnotation(id, text, projectId, pageUrl) {
    new CommentStore(projectId, pageUrl).update(id, text);
  }

  async deleteAnnotation(id, projectId, pageUrl) {
    new CommentStore(projectId, pageUrl).delete(id);
  }

  async clearAnnotations(projectId, pageUrl) {
    new CommentStore(projectId, pageUrl).clear();
  }

  async exportPageJSON(projectId, pageUrl) {
    return new CommentStore(projectId, pageUrl).exportJSON();
  }

  async importPageJSON(projectId, pageUrl, _pageTitle, jsonString) {
    new CommentStore(projectId, pageUrl).importJSON(jsonString);
  }
}
```

- [ ] **Step 2: Verify file compiles (no syntax errors)**

```
node --input-type=module < src/store.js
```
Expected: no output (no errors). If you see `SyntaxError`, fix the syntax before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/store.js
git commit -m "feat(store): add LocalAdapter class wrapping existing localStorage ops"
```

---

## Task 2: Create src/store-cloud.js (SupabaseAdapter)

**Files:**
- Create: `src/store-cloud.js`

The Supabase schema uses `project_name text` as the identifier in the `annotations` table (no UUID indirection — keeps project switching trivial). Here is the setup SQL the user will run once in Supabase SQL Editor:

```sql
create table if not exists projects (
  name text primary key,
  created_at timestamptz default now()
);

create table if not exists annotations (
  id uuid primary key default gen_random_uuid(),
  project_name text not null references projects(name) on delete cascade,
  page_url text not null,
  page_title text,
  selector text,
  element_label text,
  text text,
  meta jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table projects enable row level security;
alter table annotations enable row level security;
create policy "anon full access" on projects for all using (true) with check (true);
create policy "anon full access" on annotations for all using (true) with check (true);
```

- [ ] **Step 1: Create src/store-cloud.js with SupabaseAdapter**

```js
// src/store-cloud.js

export class SupabaseAdapter {
  /**
   * @param {{ supabaseUrl: string, supabaseKey: string }} config
   */
  constructor({ supabaseUrl, supabaseKey }) {
    this._base = supabaseUrl.replace(/\/$/, '') + '/rest/v1';
    this._key  = supabaseKey;
  }

  _headers(extra = {}) {
    return {
      'apikey':        this._key,
      'Authorization': `Bearer ${this._key}`,
      'Content-Type':  'application/json',
      ...extra,
    };
  }

  async _get(path) {
    const res = await fetch(this._base + path, { headers: this._headers() });
    if (!res.ok) throw new Error(`Supabase GET ${path} → ${res.status}`);
    return res.json();
  }

  async _post(path, body) {
    const res = await fetch(this._base + path, {
      method:  'POST',
      headers: this._headers({ 'Prefer': 'return=representation' }),
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase POST ${path} → ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async _patch(path, body) {
    const res = await fetch(this._base + path, {
      method:  'PATCH',
      headers: this._headers({ 'Prefer': 'return=representation' }),
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase PATCH ${path} → ${res.status}`);
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async _delete(path) {
    const res = await fetch(this._base + path, {
      method:  'DELETE',
      headers: this._headers(),
    });
    if (!res.ok) throw new Error(`Supabase DELETE ${path} → ${res.status}`);
  }

  _q(params) {
    return '?' + new URLSearchParams(params).toString();
  }

  _rowToComment(row) {
    return {
      id:           row.id,
      selector:     row.selector,
      elementLabel: row.element_label,
      text:         row.text,
      meta:         row.meta || {},
      createdAt:    row.created_at,
    };
  }

  // ── Projects ────────────────────────────────────────────────────────────

  async listProjects() {
    const rows = await this._get('/projects?select=name,created_at&order=name.asc');
    return rows.map(r => ({ id: r.name, name: r.name }));
  }

  async createProject(name) {
    try {
      await this._post('/projects', { name });
    } catch (e) {
      // 409 conflict = already exists; treat as success
      if (!String(e.message).includes('409') && !String(e.message).includes('duplicate')) throw e;
    }
    return { id: name, name };
  }

  async deleteProject(id) {
    await this._delete('/projects' + this._q({ name: `eq.${id}` }));
  }

  async listProjectPages(projectId) {
    const rows = await this._get(
      '/annotations' + this._q({ project_name: `eq.${projectId}`, select: 'page_url,page_title' })
    );
    const map = new Map();
    rows.forEach(r => {
      if (!map.has(r.page_url)) map.set(r.page_url, { url: r.page_url, title: r.page_title, count: 0 });
      map.get(r.page_url).count++;
    });
    return Array.from(map.values()).map(({ url, count }) => {
      let path = url;
      try { const u = new URL(url); path = u.pathname + (u.search || ''); } catch { /* keep url */ }
      return { url, path, count };
    }).sort((a, b) => a.path.localeCompare(b.path));
  }

  // ── Annotations ─────────────────────────────────────────────────────────

  async getAnnotations(projectId, pageUrl) {
    const rows = await this._get(
      '/annotations' + this._q({
        project_name: `eq.${projectId}`,
        page_url:     `eq.${pageUrl}`,
        select:       '*',
        order:        'created_at.asc',
      })
    );
    return rows.map(r => this._rowToComment(r));
  }

  async addAnnotation(projectId, pageUrl, pageTitle, { selector, elementLabel, text, meta }) {
    const row = await this._post('/annotations', {
      project_name:  projectId,
      page_url:      pageUrl,
      page_title:    pageTitle,
      selector,
      element_label: elementLabel,
      text,
      meta:          meta || {},
    });
    return this._rowToComment(row);
  }

  async updateAnnotation(id, text) {
    await this._patch(
      '/annotations' + this._q({ id: `eq.${id}` }),
      { text, updated_at: new Date().toISOString() }
    );
  }

  async deleteAnnotation(id) {
    await this._delete('/annotations' + this._q({ id: `eq.${id}` }));
  }

  async clearAnnotations(projectId, pageUrl) {
    await this._delete(
      '/annotations' + this._q({ project_name: `eq.${projectId}`, page_url: `eq.${pageUrl}` })
    );
  }

  async exportPageJSON(projectId, pageUrl) {
    const comments = await this.getAnnotations(projectId, pageUrl);
    return JSON.stringify({ version: 1, url: pageUrl, comments }, null, 2);
  }

  async importPageJSON(projectId, pageUrl, pageTitle, jsonString) {
    const { comments } = JSON.parse(jsonString);
    await this.clearAnnotations(projectId, pageUrl);
    for (const c of comments) {
      await this.addAnnotation(projectId, pageUrl, pageTitle, {
        selector:     c.selector,
        elementLabel: c.elementLabel,
        text:         c.text,
        meta:         c.meta,
      });
    }
  }
}
```

- [ ] **Step 2: Verify no syntax errors**

```
node --input-type=module < src/store-cloud.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/store-cloud.js
git commit -m "feat(store-cloud): add SupabaseAdapter with full CRUD via REST API"
```

---

## Task 3: Create src/store-factory.js

**Files:**
- Create: `src/store-factory.js`

- [ ] **Step 1: Create src/store-factory.js**

```js
// src/store-factory.js
import { LocalAdapter }    from './store.js';
import { SupabaseAdapter } from './store-cloud.js';

const CONFIG_KEY = 'comment-tool-config';

export function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  } catch { return {}; }
}

export function saveConfig({ supabaseUrl, supabaseKey }) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ supabaseUrl, supabaseKey }));
}

/**
 * Returns the appropriate StorageAdapter based on saved config.
 * Returns LocalAdapter if Supabase credentials are not configured.
 */
export function getStore() {
  const { supabaseUrl, supabaseKey } = loadConfig();
  if (supabaseUrl && supabaseKey) {
    return new SupabaseAdapter({ supabaseUrl, supabaseKey });
  }
  return new LocalAdapter();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/store-factory.js
git commit -m "feat(store-factory): add getStore() factory selecting local vs Supabase adapter"
```

---

## Task 4: Update src/index.js

**Files:**
- Modify: `src/index.js`

Key changes:
1. Replace `CommentStore` + project-level imports with `getStore` + keep `getCurrentProject`/`setCurrentProject`/`createProject`/`deleteProject`
2. Replace `let store = new CommentStore(project, url)` with `const store = getStore()`
3. Make `refresh()` async
4. All `store.xxx()` calls become await + pass `project` and `url` as needed
5. Add `saveConfig` handler

- [ ] **Step 1: Replace the import block at the top of src/index.js**

Old (lines 1–6):
```js
import { CommentStore, getCurrentProject, setCurrentProject, listProjects, listProjectPages, createProject, deleteProject } from './store.js';
import { ElementPicker } from './picker.js';
import { OverlayManager } from './overlay.js';
import { Exporter } from './exporter.js';
import { PanelUI } from './panel.js';
```

New:
```js
import { getCurrentProject, setCurrentProject, createProject, deleteProject, listProjects, listProjectPages } from './store.js';
import { getStore, saveConfig, loadConfig } from './store-factory.js';
import { ElementPicker } from './picker.js';
import { OverlayManager } from './overlay.js';
import { Exporter } from './exporter.js';
import { PanelUI } from './panel.js';
```

- [ ] **Step 2: Replace store initialisation and refresh() function**

Old (around lines 44–51):
```js
  // ── Store ─────────────────────────────────────────────────────────────────
  let store = new CommentStore(project, url);
  panel.setProject(project);

  function refresh() {
    const comments = store.getAll();
    overlay.renderAll(comments);
    panel.refresh(comments, (id) => overlay.isMissing(id));
  }
```

New:
```js
  // ── Store ─────────────────────────────────────────────────────────────────
  const store = getStore();
  panel.setProject(project);
  panel.setCloudConfigured(!!(loadConfig().supabaseUrl));

  async function refresh() {
    const comments = await store.getAnnotations(project, url);
    overlay.renderAll(comments);
    panel.refresh(comments, (id) => overlay.isMissing(id));
  }
```

- [ ] **Step 3: Update refreshFlyout() to be async**

Old:
```js
  function refreshFlyout() {
    const projects = listProjects();
    const pagesMap = Object.fromEntries(
      projects.map(p => [p, listProjectPages(p)])
    );
    panel.setFlyoutData(projects, pagesMap);
  }
```

New:
```js
  async function refreshFlyout() {
    const projectObjs = await store.listProjects();
    const projects    = projectObjs.map(p => p.name);
    const pagesMap    = Object.fromEntries(
      await Promise.all(
        projectObjs.map(async p => [p.name, await store.listProjectPages(p.id)])
      )
    );
    panel.setFlyoutData(projects, pagesMap);
  }
```

- [ ] **Step 4: Update openEditDialog() — change store.update / store.delete calls**

Old (inside openEditDialog):
```js
    if (result.action === 'save' && result.text) {
      store.update(id, result.text);
      refresh();
    } else if (result.action === 'delete') {
      store.delete(id);
      refresh();
    }
```

New:
```js
    if (result.action === 'save' && result.text) {
      await store.updateAnnotation(id, result.text, project, url);
      await refresh();
    } else if (result.action === 'delete') {
      await store.deleteAnnotation(id, project, url);
      await refresh();
    }
```

Also update the find-comment line above it to use await:

Old:
```js
    const comment = store.getAll().find(c => c.id === id);
```

New:
```js
    const comment = (await store.getAnnotations(project, url)).find(c => c.id === id);
```

- [ ] **Step 5: Update all panel event handlers that touch store**

Find the `panel.on(...)` chain and update:

**flyoutOpen**:
```js
    .on('flyoutOpen', () => {
      refreshFlyout();
    })
```
→
```js
    .on('flyoutOpen', () => {
      refreshFlyout().catch(console.error);
    })
```

**createProject**:

Old:
```js
    .on('createProject', ({ name }) => {
      if (!name) return;
      createProject(name);
      overlay.clearAll();
      project = name;
      setCurrentProject(project);
      store = new CommentStore(project, url);
      panel.setProject(project);
      refresh();
    })
```

New:
```js
    .on('createProject', async ({ name }) => {
      if (!name) return;
      await store.createProject(name);
      overlay.clearAll();
      project = name;
      setCurrentProject(project);
      panel.setProject(project);
      await refresh();
    })
```

**deleteProject**:

Old:
```js
    .on('deleteProject', ({ name }) => {
      deleteProject(name);

      if (name === project) {
        const remaining = listProjects();
        project = remaining[0] ?? 'default';
        if (!remaining.length) createProject('default');
        setCurrentProject(project);
        store = new CommentStore(project, url);
        overlay.clearAll();
        panel.setProject(project);
        refresh();
      }

      refreshFlyout();
    })
```

New:
```js
    .on('deleteProject', async ({ name }) => {
      await store.deleteProject(name);

      if (name === project) {
        const remaining = (await store.listProjects()).map(p => p.name);
        project = remaining[0] ?? 'default';
        if (!remaining.length) await store.createProject('default');
        setCurrentProject(project);
        overlay.clearAll();
        panel.setProject(project);
        await refresh();
      }

      refreshFlyout().catch(console.error);
    })
```

**pickRequest — existing annotation check**:

Old (inside the onPick callback):
```js
          const existing = store.getAll().find(c => c.selector === selector);
          if (existing) {
            await openEditDialog(existing.id, x, y);
          } else {
            const result = await panel.showDialogAt(x, y, { existing: '', showDelete: false });
            if (result.action === 'save' && result.text) {
              store.add(selector, label, result.text, meta);
              refresh();
            }
          }
```

New:
```js
          const allComments = await store.getAnnotations(project, url);
          const existing = allComments.find(c => c.selector === selector);
          if (existing) {
            await openEditDialog(existing.id, x, y);
          } else {
            const result = await panel.showDialogAt(x, y, { existing: '', showDelete: false });
            if (result.action === 'save' && result.text) {
              const pageTitle = doc.title || url;
              await store.addAnnotation(project, url, pageTitle, { selector, elementLabel: label, text: result.text, meta });
              await refresh();
            }
          }
```

**delete**:

Old:
```js
    .on('delete', (id) => {
      store.delete(id);
      refresh();
    })
```

New:
```js
    .on('delete', async (id) => {
      await store.deleteAnnotation(id, project, url);
      await refresh();
    })
```

**clear**:

Old:
```js
    .on('clear', () => {
      store.clear();
      overlay.clearAll();
      panel.refresh([], () => false);
    })
```

New:
```js
    .on('clear', async () => {
      await store.clearAnnotations(project, url);
      overlay.clearAll();
      panel.refresh([], () => false);
    })
```

**exportPrompt**:

Old:
```js
    .on('exportPrompt', async () => {
      const prompt = Exporter.toPrompt(url, store.getAll());
```

New:
```js
    .on('exportPrompt', async () => {
      const comments = await store.getAnnotations(project, url);
      const prompt = Exporter.toPrompt(url, comments);
```

**exportJSON**:

Old:
```js
    .on('exportJSON', () => {
      const json = store.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `comments-${project}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
```

New:
```js
    .on('exportJSON', async () => {
      const json = await store.exportPageJSON(project, url);
      const blob = new Blob([json], { type: 'application/json' });
      const a = doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `comments-${project}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
```

**importJSON**:

Old:
```js
    .on('importJSON', (jsonString) => {
      try {
        store.importJSON(jsonString);
        refresh();
        panel.showToast('✓ 已匯入標註');
      } catch {
        panel.showToast('✗ JSON 格式錯誤');
      }
    })
```

New:
```js
    .on('importJSON', async (jsonString) => {
      try {
        const pageTitle = doc.title || url;
        await store.importPageJSON(project, url, pageTitle, jsonString);
        await refresh();
        panel.showToast('✓ 已匯入標註');
      } catch {
        panel.showToast('✗ JSON 格式錯誤');
      }
    })
```

**shareLink**:

Old:
```js
    .on('shareLink', async () => {
      const shareUrl = Exporter.toShareURL(url, store.getAll());
```

New:
```js
    .on('shareLink', async () => {
      const comments = await store.getAnnotations(project, url);
      const shareUrl = Exporter.toShareURL(url, comments);
```

- [ ] **Step 6: Add saveConfig event handler** (add before the last semicolons in the `.on()` chain)

```js
    .on('saveConfig', async ({ supabaseUrl, supabaseKey }) => {
      saveConfig({ supabaseUrl, supabaseKey });
      panel.setCloudConfigured(!!(supabaseUrl));
      panel.showToast('✓ 設定已儲存，正在重新連線…');
      await refresh();
      await refreshFlyout();
    })
```

- [ ] **Step 7: Update auto-import shared annotations section**

Old (near bottom of initCommentTool):
```js
  let didImportShared = false;
  if (sharedData?.comments?.length) {
    const existing = store.getAll();
    const doImport = existing.length === 0
      || doc.defaultView.confirm(
           `此連結含有 ${sharedData.comments.length} 筆共享標註。是否匯入？（將覆蓋目前的 ${existing.length} 筆標註）`
         );
    if (doImport) {
      store.importJSON(JSON.stringify({ version: 1, comments: sharedData.comments }));
      didImportShared = true;
    }
  }

  refresh();
  if (didImportShared) panel.showToast(`✓ 已載入 ${store.getAll().length} 筆共享標註`);
```

New:
```js
  let didImportShared = false;
  if (sharedData?.comments?.length) {
    const existing = await store.getAnnotations(project, url);
    const doImport = existing.length === 0
      || doc.defaultView.confirm(
           `此連結含有 ${sharedData.comments.length} 筆共享標註。是否匯入？（將覆蓋目前的 ${existing.length} 筆標註）`
         );
    if (doImport) {
      const pageTitle = doc.title || url;
      await store.importPageJSON(project, url, pageTitle, JSON.stringify({ version: 1, comments: sharedData.comments }));
      didImportShared = true;
    }
  }

  await refresh();
  if (didImportShared) {
    const imported = await store.getAnnotations(project, url);
    panel.showToast(`✓ 已載入 ${imported.length} 筆共享標註`);
  }
```

Note: The `initCommentTool` IIFE must be declared `async` to allow `await` inside it. Change:
```js
(function initCommentTool() {
```
to:
```js
(async function initCommentTool() {
```

- [ ] **Step 8: Commit**

```bash
git add src/index.js
git commit -m "feat(index): wire async StorageAdapter; replace CommentStore with getStore()"
```

---

## Task 5: Add Settings UI to src/panel.js

**Files:**
- Modify: `src/panel.js`

Changes needed:
1. Add CSS for settings overlay (`.settings-overlay`) and form elements (`.settings-form`, `.settings-field`, etc.)
2. Add `_settingsOpen` state flag and `_settingsEl` reference
3. Add `setCloudConfigured(bool)` method (styles the gear button differently when cloud is active)
4. Add `_buildSettings()` method
5. Add gear button to toolbar in `_buildPanel()`
6. Toggle settings overlay on gear click; emit `saveConfig` on save

- [ ] **Step 1: Add settings CSS after the existing `.proj-add-input:focus` rule**

Find this line in the CSS constant (near end of CSS string, before the closing backtick):
```css
.proj-add-input:focus { border-color: #89b4fa; }
```

Add after it:
```css
.settings-overlay {
  display: none;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  background: #1e1e2e;
}
.settings-overlay.open { display: flex; }
.settings-header {
  padding: 10px 12px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #6c7086;
  border-bottom: 1px solid #313244;
  display: flex;
  align-items: center;
  gap: 6px;
}
.settings-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.settings-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.settings-label {
  font-size: 11px;
  font-weight: 600;
  color: #a6adc8;
}
.settings-hint {
  font-size: 10px;
  color: #6c7086;
  font-style: italic;
  line-height: 1.4;
}
.settings-input {
  background: #313244;
  border: 1px solid #45475a;
  border-radius: 5px;
  color: #cdd6f4;
  font-size: 12px;
  padding: 6px 8px;
  outline: none;
  font-family: monospace;
  width: 100%;
  box-sizing: border-box;
}
.settings-input:focus { border-color: #89b4fa; }
.settings-actions {
  display: flex;
  gap: 6px;
  padding-top: 4px;
}
.settings-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #cdd6f4;
  padding: 0 0 4px;
  border-bottom: 1px solid #313244;
}
.settings-sql-block {
  background: #181825;
  border: 1px solid #313244;
  border-radius: 5px;
  padding: 8px;
  font-size: 10px;
  font-family: monospace;
  color: #a6adc8;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 160px;
  overflow-y: auto;
  line-height: 1.5;
}
.settings-status {
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.settings-status.connected    { background: rgba(166,227,161,0.1); color: #a6e3a1; }
.settings-status.disconnected { background: rgba(88,88,105,0.15);  color: #6c7086; }
```

- [ ] **Step 2: Add `_settingsOpen`, `_settingsEl`, `_settingsBtn`, `_cloudConfigured` to the constructor**

Find constructor in `PanelUI`:
```js
  constructor(doc) {
    this._doc = doc;
    this._host = null;
    this._shadow = null;
    this._panel = null;
    this._listEl = null;
    this._collapsed = false;
    this._pickActive = false;
    this._cbs = {};
    this._project = '';
    this._flyoutOpen = false;
    this._flyoutExpandedProject = null;
    this._flyoutEl = null;
    this._projFlyoutBtn = null;
    this._flyoutOutsideHandler = null;
  }
```

Add 4 lines after `this._flyoutOutsideHandler = null;`:
```js
    this._settingsOpen = false;
    this._settingsEl = null;
    this._settingsBtn = null;
    this._cloudConfigured = false;
```

- [ ] **Step 3: Add `setCloudConfigured(bool)` public method** (add near the `setPickActive` method):

```js
  setCloudConfigured(active) {
    this._cloudConfigured = active;
    if (this._settingsBtn) {
      this._settingsBtn.classList.toggle('active', active);
      this._settingsBtn.title = active ? '設定（雲端已連線）' : '設定（本機模式）';
    }
  }
```

- [ ] **Step 4: Add `_buildSettings()` method** (add before `_buildPanel()` or after `setFlyoutData()`):

```js
  _buildSettings() {
    const overlay = this._el('div', 'settings-overlay');

    const hdr  = this._el('div', 'settings-header');
    const back = this._btn('mdi:arrow-left', '返回', 'btn-neutral', () => this._toggleSettings());
    back.style.cssText = 'padding:3px 8px; font-size:11px;';
    hdr.append(this._icon('mdi:cog'), this._el('span', null, '設定'), back);
    overlay.appendChild(hdr);

    const body = this._el('div', 'settings-body');

    // Status indicator
    const statusEl = this._el('div', 'settings-status ' + (this._cloudConfigured ? 'connected' : 'disconnected'));
    statusEl.appendChild(this._icon(this._cloudConfigured ? 'mdi:cloud-check' : 'mdi:cloud-off-outline'));
    statusEl.appendChild(this._el('span', null, this._cloudConfigured ? '雲端模式（共享資料）' : '本機模式（資料僅在此瀏覽器）'));
    body.appendChild(statusEl);

    // Section title
    body.appendChild(this._el('div', 'settings-section-title', 'Supabase 設定'));

    // URL input
    const urlField = this._el('div', 'settings-field');
    urlField.appendChild(this._el('div', 'settings-label', 'Project URL'));
    const urlInput = this._doc.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'settings-input';
    urlInput.placeholder = 'https://xxxx.supabase.co';
    try {
      const cfg = JSON.parse(localStorage.getItem('comment-tool-config') || '{}');
      urlInput.value = cfg.supabaseUrl || '';
    } catch { /* ignore */ }
    urlField.appendChild(urlInput);
    body.appendChild(urlField);

    // Key input
    const keyField = this._el('div', 'settings-field');
    keyField.appendChild(this._el('div', 'settings-label', 'Anon Key'));
    const keyInput = this._doc.createElement('input');
    keyInput.type = 'password';
    keyInput.className = 'settings-input';
    keyInput.placeholder = 'eyJ…';
    try {
      const cfg = JSON.parse(localStorage.getItem('comment-tool-config') || '{}');
      keyInput.value = cfg.supabaseKey || '';
    } catch { /* ignore */ }
    keyField.appendChild(keyInput);
    body.appendChild(keyField);

    // Save + Clear buttons
    const actions = this._el('div', 'settings-actions');
    const saveBtn = this._btn('mdi:content-save', '儲存', 'btn-primary', () => {
      const supabaseUrl = urlInput.value.trim();
      const supabaseKey = keyInput.value.trim();
      this._emit('saveConfig', { supabaseUrl, supabaseKey });
    });
    const clearBtn = this._btn('mdi:link-off', '清除（用本機）', 'btn-neutral', () => {
      urlInput.value = '';
      keyInput.value = '';
      this._emit('saveConfig', { supabaseUrl: '', supabaseKey: '' });
    });
    actions.append(saveBtn, clearBtn);
    body.appendChild(actions);

    // Setup SQL section
    body.appendChild(this._el('div', 'settings-section-title', '首次使用 — 在 Supabase SQL Editor 執行'));
    const hint = this._el('div', 'settings-hint', '到 Supabase 專案 → SQL Editor → 貼上以下 SQL → Run');
    body.appendChild(hint);
    const sql = this._el('div', 'settings-sql-block',
`create table if not exists projects (
  name text primary key,
  created_at timestamptz default now()
);
create table if not exists annotations (
  id uuid primary key default gen_random_uuid(),
  project_name text not null references projects(name) on delete cascade,
  page_url text not null,
  page_title text,
  selector text,
  element_label text,
  text text,
  meta jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table projects enable row level security;
alter table annotations enable row level security;
create policy "anon full access" on projects for all using (true) with check (true);
create policy "anon full access" on annotations for all using (true) with check (true);`
    );
    body.appendChild(sql);

    overlay.appendChild(body);
    this._settingsEl = overlay;
    return overlay;
  }
```

- [ ] **Step 5: Add `_toggleSettings()` method**:

```js
  _toggleSettings() {
    this._settingsOpen = !this._settingsOpen;
    if (this._settingsEl) this._settingsEl.classList.toggle('open', this._settingsOpen);
  }
```

- [ ] **Step 6: Add gear button to toolbar in `_buildPanel()`**

Find where the toolbar buttons are appended:
```js
    tb.append(this._pickBtn, exportBtn, clearBtn, dlBtn, ulBtn, shareBtn);
```

Replace with:
```js
    this._settingsBtn = this._btn('mdi:cog', '設定', 'btn-neutral', () => this._toggleSettings());
    this._settingsBtn.title = this._cloudConfigured ? '設定（雲端已連線）' : '設定（本機模式）';
    if (this._cloudConfigured) this._settingsBtn.classList.add('active');
    tb.append(this._pickBtn, exportBtn, clearBtn, dlBtn, ulBtn, shareBtn, this._settingsBtn);
```

- [ ] **Step 7: Add settings overlay to panel in `_buildPanel()`**

Find where the flyout is added:
```js
    // Flyout (hidden until toggled open)
    this._flyoutEl = this._el('div', 'proj-flyout');
    p.appendChild(this._flyoutEl);
```

After it (or after the list element), add:
```js
    // Settings overlay (hidden until gear is clicked)
    p.appendChild(this._buildSettings());
```

- [ ] **Step 8: Commit**

```bash
git add src/panel.js
git commit -m "feat(panel): add settings overlay with Supabase URL/key inputs and SQL setup guide"
```

---

## Task 6: Build, verify, final commit

**Files:**
- Run: `npm run generate`
- Verify: `index.html`

- [ ] **Step 1: Run build**

```
npm run generate
```
Expected: `✓ bookmarklet injected` (or similar success message). If errors appear, fix and re-run.

- [ ] **Step 2: Check index.html was updated**

```
node -e "const h = require('fs').readFileSync('index.html','utf8'); console.log('href count:', (h.match(/href=\"javascript:/g)||[]).length);"
```
Expected: `href count: 1` (or 2 if loader bookmarklet section exists).

- [ ] **Step 3: Quick sanity check — load the built file**

```
node -e "
const fs = require('fs');
const code = fs.readFileSync('dist/comment-tool.js', 'utf8');
console.log('size:', code.length, 'bytes');
console.log('has getStore:', code.includes('getStore'));
console.log('has SupabaseAdapter:', code.includes('SupabaseAdapter'));
console.log('has LocalAdapter:', code.includes('LocalAdapter'));
"
```
Expected:
```
size: <number> bytes
has getStore: true
has SupabaseAdapter: true
has LocalAdapter: true
```

- [ ] **Step 4: Commit build output**

```bash
git add index.html dist/comment-tool.js
git commit -m "build: regenerate bookmarklet with cloud sync support"
```

---

## Setup Instructions for the User (not a code task)

After implementation is complete, share these instructions with the team:

**One-time setup (done once by the maintainer):**
1. Create a free Supabase project at https://supabase.com
2. In the Supabase dashboard → SQL Editor → paste and run the SQL from the settings panel
3. Copy the Project URL and anon key from Settings → API
4. Share those two values with all team members via Slack/Teams

**Per-person setup (done once per browser):**
1. Install the bookmarklet (as before)
2. Open the tool on any page → click ⚙ → paste URL and Key → Save
3. Done — all annotations are now shared automatically
